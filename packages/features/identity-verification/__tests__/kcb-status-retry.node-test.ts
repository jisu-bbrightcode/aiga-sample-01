import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException, HttpException, HttpStatus, NotFoundException } from "@nestjs/common";
import {
  type DrizzleDB,
  identityVerificationAttempts,
  identityVerificationRequests,
  identityVerifications,
} from "@repo/drizzle";
import { type KcbAdapterClient, type KcbHealth } from "../kcb";
import {
  canRetryFromStatus,
  resolveUserVerificationStatus,
  userVerificationStatusMessage,
} from "../kcb/user-status";
import { type RateLimitGuard, IdentityVerificationService } from "../service";

// ---------------------------------------------------------------------------
// In-memory fake covering the status/retry paths: select (latest request / latest
// verification / loadRequest) with orderBy + limit, plus insert/update for the retry's
// createSession hand-off. Each test seeds a single user's rows directly and asserts on
// the store + return value; WHERE clauses are ignored (one user per test).
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;

function createFakeDb() {
  const store = {
    requests: [] as Row[],
    attempts: [] as Row[],
    verifications: [] as Row[],
  };
  let idSeq = 0;

  function bucket(table: unknown): Row[] {
    if (table === identityVerificationRequests) return store.requests;
    if (table === identityVerificationAttempts) return store.attempts;
    if (table === identityVerifications) return store.verifications;
    throw new Error("unexpected table in fake db");
  }

  function awaitable(rows: Row[]) {
    return Object.assign(Promise.resolve(rows), {
      orderBy: () => awaitable(rows),
      limit: (n: number) => Promise.resolve(rows.slice(0, n)),
      returning: () => Promise.resolve(rows),
    });
  }

  const db = {
    select() {
      return {
        from(table: unknown) {
          const rows = bucket(table);
          return { where: () => awaitable(rows) };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: Row) {
          const now = new Date();
          const row = { id: `row-${++idSeq}`, createdAt: now, updatedAt: now, ...values };
          bucket(table).push(row);
          return awaitable([row]);
        },
      };
    },
    update(table: unknown) {
      return {
        set(patch: Row) {
          const apply = () => {
            const rows = bucket(table).map((r) => ({ ...r, ...patch }));
            if (table === identityVerificationRequests) store.requests = rows;
            else if (table === identityVerificationAttempts) store.attempts = rows;
            else store.verifications = rows;
            return rows;
          };
          return { where: () => awaitable(apply()) };
        },
      };
    },
  };

  return { db: db as unknown as DrizzleDB, store };
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

const USER_ID = "user-123";

function seedRequest(store: ReturnType<typeof createFakeDb>["store"], overrides: Row = {}): Row {
  const now = new Date();
  const request: Row = {
    id: "11111111-1111-4111-8111-111111111111",
    userId: USER_ID,
    clientIp: "5.6.7.8",
    provider: "kcb",
    mode: "standard",
    targetAction: "purchase",
    status: "failed",
    moduleTokenHash: sha256("MODULE-TOKEN"),
    stateHash: sha256("state-state-state-state"),
    nonceHash: sha256("nonce-nonce-nonce-nonce"),
    providerTransactionId: "tx-1",
    resultCode: null,
    failureCode: "provider_rejected",
    consentVersion: "v1",
    consentScope: "name,phone,ci",
    consentedAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  store.requests.push(request);
  return request;
}

function seedVerification(store: ReturnType<typeof createFakeDb>["store"]): void {
  const now = new Date();
  store.verifications.push({
    id: "ver-1",
    requestId: "11111111-1111-4111-8111-111111111111",
    userId: USER_ID,
    provider: "kcb",
    ciHash: sha256("ci"),
    diHash: sha256("di"),
    nameMasked: "홍*동",
    phoneMasked: "010-****-1234",
    birthYear: "1990",
    verifiedAt: now,
    retainedUntil: null,
    anonymizedAt: null,
    deletedAt: null,
    createdAt: now,
  });
}

function okHealth(): KcbHealth {
  return { ok: true, blockers: [] } as unknown as KcbHealth;
}

function fakeAdapter(): KcbAdapterClient {
  return {
    async health() {
      return okHealth();
    },
    async createStandardRequest() {
      return {
        providerTransactionId: "tx-retry",
        redirectUrl: "https://kcb.example/redirect",
        redirectMethod: "POST" as const,
        redirectForm: { mdl_tkn: "MODULE-TOKEN-2" },
      };
    },
  } as unknown as KcbAdapterClient;
}

// A rate limiter that records its calls and optionally rejects with HTTP 429.
function fakeRateLimit(reject = false): RateLimitGuard & { calls: Array<{ id: string; action: string }> } {
  const calls: Array<{ id: string; action: string }> = [];
  return {
    calls,
    async assertRateLimit(identifier, config) {
      calls.push({ id: identifier, action: config.action });
      if (reject) {
        throw new HttpException(
          { message: "요청이 너무 많습니다.", errorCode: "RATE_LIMITED" },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Pure status mapper (AC1 + AC4): five coarse states, friendly copy, retry policy.
// ---------------------------------------------------------------------------
describe("resolveUserVerificationStatus (PB-IDV-KCB-API-STATUS-001)", () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);

  it("returns 'verified' whenever a verified identity exists, regardless of request", () => {
    assert.equal(resolveUserVerificationStatus(null, true), "verified");
    assert.equal(resolveUserVerificationStatus({ status: "failed", expiresAt: past }, true), "verified");
  });

  it("returns 'required' when there is no request and no identity", () => {
    assert.equal(resolveUserVerificationStatus(null, false), "required");
  });

  it("maps in-flight requests within the window to 'in_progress'", () => {
    for (const status of ["created", "redirected", "pending"]) {
      assert.equal(resolveUserVerificationStatus({ status, expiresAt: future }, false), "in_progress");
    }
  });

  it("treats an elapsed in-flight window as 'expired'", () => {
    assert.equal(resolveUserVerificationStatus({ status: "redirected", expiresAt: past }, false), "expired");
  });

  it("folds canceled and failed into 'failed', and 'expired' stays expired", () => {
    assert.equal(resolveUserVerificationStatus({ status: "failed", expiresAt: future }, false), "failed");
    assert.equal(resolveUserVerificationStatus({ status: "canceled", expiresAt: future }, false), "failed");
    assert.equal(resolveUserVerificationStatus({ status: "expired", expiresAt: future }, false), "expired");
  });

  it("offers retry only from failed/expired and gives non-technical copy", () => {
    assert.equal(canRetryFromStatus("failed"), true);
    assert.equal(canRetryFromStatus("expired"), true);
    assert.equal(canRetryFromStatus("required"), false);
    assert.equal(canRetryFromStatus("in_progress"), false);
    assert.equal(canRetryFromStatus("verified"), false);
    // User copy never carries a provider/failure code.
    for (const status of ["required", "in_progress", "verified", "failed", "expired"] as const) {
      const message = userVerificationStatusMessage(status);
      assert.ok(message.length > 0);
      assert.doesNotMatch(message, /provider_rejected|B0\d\d|null|code/i);
    }
  });
});

// ---------------------------------------------------------------------------
// getUserStatus (AC1 + AC2 + AC4)
// ---------------------------------------------------------------------------
describe("IdentityVerificationService.getUserStatus", () => {
  it("reports 'required' with no resume context when the user has never verified", async () => {
    const { db } = createFakeDb();
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter() });

    const status = await service.getUserStatus(USER_ID);

    assert.equal(status.status, "required");
    assert.equal(status.canRetry, false);
    assert.equal(status.identity, null);
    assert.equal(status.resume, null);
  });

  it("reports 'failed' + retry + resume context (no raw codes) for a failed request", async () => {
    const { db, store } = createFakeDb();
    seedRequest(store, { status: "failed" });
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter() });

    const status = await service.getUserStatus(USER_ID);

    assert.equal(status.status, "failed");
    assert.equal(status.canRetry, true);
    // Resume context preserved so the client can return to the original action (AC2).
    assert.equal(status.resume?.targetAction, "purchase");
    assert.equal(status.resume?.sessionId, "11111111-1111-4111-8111-111111111111");
    // AC4: the user view exposes no provider/failure code.
    assert.equal((status as Record<string, unknown>).failureCode, undefined);
    assert.equal((status as Record<string, unknown>).resultCode, undefined);
  });

  it("reports 'verified' with the masked identity when an identity exists", async () => {
    const { db, store } = createFakeDb();
    seedVerification(store);
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter() });

    const status = await service.getUserStatus(USER_ID);

    assert.equal(status.status, "verified");
    assert.equal(status.canRetry, false);
    assert.ok(status.verifiedAt);
    assert.equal(status.identity?.nameMasked, "홍*동");
    // Masked/coarse only — never the CI/DI hashes themselves.
    assert.equal((status.identity as Record<string, unknown>)?.ciHash, undefined);
  });
});

// ---------------------------------------------------------------------------
// retrySession (AC2 + AC3)
// ---------------------------------------------------------------------------
describe("IdentityVerificationService.retrySession", () => {
  it("checks the per-user retry rate limit first and surfaces 429", async () => {
    const { db } = createFakeDb();
    const rateLimit = fakeRateLimit(true);
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter(), rateLimit });

    await assert.rejects(
      () => service.retrySession(USER_ID, {}),
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS,
    );
    assert.deepEqual(rateLimit.calls, [{ id: USER_ID, action: "identity_verification:retry" }]);
  });

  it("creates a fresh session reusing target + consent on a failed request (AC2)", async () => {
    const { db, store } = createFakeDb();
    seedRequest(store, { status: "failed" });
    const rateLimit = fakeRateLimit(false);
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter(), rateLimit });

    const result = await service.retrySession(USER_ID, {});

    assert.equal(result.status, "redirected");
    assert.equal(result.blocked, null);
    assert.ok(result.state && result.nonce);
    // A brand-new user-scoped request was inserted, reusing the source's context.
    assert.equal(store.requests.length, 2);
    const created = store.requests[1];
    assert.ok(created);
    assert.equal(created.userId, USER_ID);
    assert.equal(created.targetAction, "purchase");
    assert.equal(created.consentVersion, "v1");
    assert.equal(created.consentScope, "name,phone,ci");
    assert.equal(rateLimit.calls.length, 1);
  });

  it("honors a target override for the resumed action", async () => {
    const { db, store } = createFakeDb();
    seedRequest(store, { status: "expired" });
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter() });

    await service.retrySession(USER_ID, { target: { action: "checkout" } });

    assert.equal(store.requests[1]?.targetAction, "checkout");
  });

  it("rejects retry with 409 when the user is already verified", async () => {
    const { db, store } = createFakeDb();
    seedVerification(store);
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter() });

    await assert.rejects(
      () => service.retrySession(USER_ID, {}),
      (error: unknown) =>
        error instanceof ConflictException &&
        (error.getResponse() as Record<string, unknown>).errorCode === "ALREADY_VERIFIED",
    );
  });

  it("rejects retry with 409 while a verification is still in progress", async () => {
    const { db, store } = createFakeDb();
    seedRequest(store, { status: "redirected", expiresAt: new Date(Date.now() + 60_000) });
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter() });

    await assert.rejects(
      () => service.retrySession(USER_ID, {}),
      (error: unknown) =>
        error instanceof ConflictException &&
        (error.getResponse() as Record<string, unknown>).errorCode === "VERIFICATION_IN_PROGRESS",
    );
  });

  it("rejects retry with 404 when there is nothing to retry", async () => {
    const { db } = createFakeDb();
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter() });

    await assert.rejects(
      () => service.retrySession(USER_ID, {}),
      (error: unknown) =>
        error instanceof NotFoundException &&
        (error.getResponse() as Record<string, unknown>).errorCode === "NO_RETRYABLE_VERIFICATION",
    );
  });
});
