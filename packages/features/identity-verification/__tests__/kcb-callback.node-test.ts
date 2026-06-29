import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type DrizzleDB,
  identityVerificationAttempts,
  identityVerificationRequests,
  identityVerifications,
} from "@repo/drizzle";
import { type KcbAdapterClient, type KcbAdapterVerifyResponse } from "../kcb";
import { KcbIdentityVerificationError } from "../kcb/errors";
import { IdentityVerificationService } from "../service";

// ---------------------------------------------------------------------------
// In-memory fake covering the callback path: select (loadRequest / nextAttemptNo /
// module-token lookup), insert (request / attempt / verification) and update (status
// transition). Each test uses a single request, so the WHERE clause is ignored and
// operations apply to the whole bucket — same simplification as the session test.
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
      limit: (n: number) => Promise.resolve(rows.slice(0, n)),
      returning: () => Promise.resolve(rows),
    });
  }

  const db = {
    select() {
      return {
        from(table: unknown) {
          const rows = bucket(table);
          return {
            where: () => awaitable(rows),
          };
        },
      };
    },
    insert(table: unknown) {
      return {
        values(values: Row) {
          const now = new Date();
          const row = { id: `row-${++idSeq}`, createdAt: now, ...values };
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

const STATE = "state-state-state-state";
const NONCE = "nonce-nonce-nonce-nonce";

function seedRedirectedRequest(store: ReturnType<typeof createFakeDb>["store"], overrides: Row = {}) {
  const now = new Date();
  const request: Row = {
    id: "11111111-1111-4111-8111-111111111111",
    userId: null,
    clientIp: "5.6.7.8",
    provider: "kcb",
    mode: "standard",
    targetAction: "purchase",
    status: "redirected",
    moduleTokenHash: sha256("MODULE-TOKEN"),
    stateHash: sha256(STATE),
    nonceHash: sha256(NONCE),
    providerTransactionId: "tx-1",
    resultCode: null,
    failureCode: null,
    consentVersion: "v1",
    consentScope: "name,phone,ci",
    consentedAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  store.requests.push(request);
  // The session flow always records a first `redirected` attempt; seed it so callback
  // attempt numbers continue from 2.
  store.attempts.push({ id: "att-0", requestId: request.id, attemptNo: 1, outcome: "redirected" });
  return request;
}

function verifyResponse(overrides: Partial<KcbAdapterVerifyResponse> = {}): KcbAdapterVerifyResponse {
  return {
    providerTransactionId: "tx-1",
    resultCode: "B000",
    resultMessage: "ok",
    verified: true,
    ciHash: "sha256:ci",
    diHash: "sha256:di",
    nameMasked: "홍*동",
    phoneMasked: "010****1234",
    birthYear: "1990",
    ...overrides,
  } as KcbAdapterVerifyResponse;
}

function fakeAdapter(response: KcbAdapterVerifyResponse | Error) {
  const calls = { verifyStandard: 0, verifyCustom: 0 };
  const adapter = {
    async verifyStandard() {
      calls.verifyStandard += 1;
      if (response instanceof Error) throw response;
      return response;
    },
    async verifyCustom() {
      calls.verifyCustom += 1;
      if (response instanceof Error) throw response;
      return response;
    },
  } as unknown as KcbAdapterClient;
  return { adapter, calls };
}

const callbackInput = { sessionId: "11111111-1111-4111-8111-111111111111", state: STATE, nonce: NONCE };

describe("KCB callback / result verification (PB-IDV-KCB-CALLBACK-001)", () => {
  it("verifies a result, persists only hashes/masked fields, and audits a 'verified' attempt", async () => {
    const { db, store } = createFakeDb();
    seedRedirectedRequest(store);
    const { adapter } = fakeAdapter(verifyResponse());
    const service = new IdentityVerificationService({ db, adapter });

    const result = await service.handleProviderResult({ ...callbackInput, providerPayload: {} });

    assert.equal(result.status, "verified");
    assert.equal(result.resultCode, "B000");
    // A verification row is created with hashed/masked identity only — never raw payload.
    assert.equal(store.verifications.length, 1);
    const verification = store.verifications[0];
    assert.equal(verification?.ciHash, "sha256:ci");
    assert.equal(verification?.nameMasked, "홍*동");
    // Attempt audit continues from the seeded redirect (#1) → verified (#2), no secrets.
    const verifiedAttempt = store.attempts.find((a) => a.outcome === "verified");
    assert.ok(verifiedAttempt);
    assert.equal(verifiedAttempt?.attemptNo, 2);
    assert.equal(verifiedAttempt?.resultCode, "B000");
    assert.equal(verifiedAttempt?.failureCode, null);
    // The attempt row never carries CI/DI/name.
    assert.equal(Object.hasOwn(verifiedAttempt as Row, "ciHash"), false);
  });

  it("is idempotent: a duplicate callback returns the stored result without re-verifying", async () => {
    const { db, store } = createFakeDb();
    seedRedirectedRequest(store);
    const { adapter, calls } = fakeAdapter(verifyResponse());
    const service = new IdentityVerificationService({ db, adapter });

    const first = await service.handleProviderResult({ ...callbackInput, providerPayload: {} });
    const second = await service.handleProviderResult({ ...callbackInput, providerPayload: {} });

    assert.equal(first.status, "verified");
    assert.equal(second.status, "verified");
    // The provider was called exactly once; no duplicate verification row or attempt.
    assert.equal(calls.verifyStandard, 1);
    assert.equal(store.verifications.length, 1);
    assert.equal(store.attempts.filter((a) => a.outcome === "verified").length, 1);
  });

  it("maps a provider cancellation to the 'canceled' state (distinct from a failure)", async () => {
    const { db, store } = createFakeDb();
    seedRedirectedRequest(store);
    const { adapter } = fakeAdapter(
      verifyResponse({ verified: false, canceled: true, resultCode: "USER_CANCEL" }),
    );
    const service = new IdentityVerificationService({ db, adapter });

    const result = await service.handleProviderResult({ ...callbackInput, providerPayload: {} });

    assert.equal(result.status, "canceled");
    assert.equal(result.failureCode, "canceled");
    assert.equal(store.verifications.length, 0);
    const attempt = store.attempts.find((a) => a.outcome === "canceled");
    assert.equal(attempt?.attemptNo, 2);
    assert.equal(attempt?.resultCode, "USER_CANCEL");
  });

  it("maps a non-verified, non-canceled result to 'failed' with a stable code", async () => {
    const { db, store } = createFakeDb();
    seedRedirectedRequest(store);
    const { adapter } = fakeAdapter(verifyResponse({ verified: false, resultCode: "B999" }));
    const service = new IdentityVerificationService({ db, adapter });

    const result = await service.handleProviderResult({ ...callbackInput, providerPayload: {} });

    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "provider_rejected");
    assert.ok(store.attempts.some((a) => a.outcome === "failed" && a.resultCode === "B999"));
  });

  it("separates a provider/adapter error into a 'failed' state without leaking detail", async () => {
    const { db, store } = createFakeDb();
    seedRedirectedRequest(store);
    const { adapter } = fakeAdapter(
      new KcbIdentityVerificationError("jar_required", "internal adapter detail"),
    );
    const service = new IdentityVerificationService({ db, adapter });

    const result = await service.handleProviderResult({ ...callbackInput, providerPayload: {} });

    assert.equal(result.status, "failed");
    // The internal adapter message is never surfaced; only the stable code is stored.
    assert.equal(result.failureCode, "jar_required");
    assert.ok(store.attempts.some((a) => a.outcome === "failed" && a.failureCode === "jar_required"));
  });

  it("marks an expired session 'expired' (a separated state) and audits it, without calling the provider", async () => {
    const { db, store } = createFakeDb();
    seedRedirectedRequest(store, { expiresAt: new Date(Date.now() - 1000) });
    const { adapter, calls } = fakeAdapter(verifyResponse());
    const service = new IdentityVerificationService({ db, adapter });

    const result = await service.handleProviderResult({ ...callbackInput, providerPayload: {} });

    assert.equal(result.status, "expired");
    assert.equal(result.failureCode, "session_expired");
    assert.equal(calls.verifyStandard, 0);
    assert.ok(store.attempts.some((a) => a.outcome === "expired"));
  });

  it("rejects a state/nonce mismatch as a replay (the provider is never called)", async () => {
    const { db, store } = createFakeDb();
    seedRedirectedRequest(store);
    const { adapter, calls } = fakeAdapter(verifyResponse());
    const service = new IdentityVerificationService({ db, adapter });

    await assert.rejects(
      () =>
        service.handleProviderResult({
          ...callbackInput,
          state: "wrong-wrong-wrong-wrong",
          providerPayload: {},
        }),
      (error) =>
        error instanceof KcbIdentityVerificationError && error.code === "replay_detected",
    );
    assert.equal(calls.verifyStandard, 0);
  });

  it("throws session_not_found when the request id is unknown", async () => {
    const { db } = createFakeDb();
    const { adapter } = fakeAdapter(verifyResponse());
    const service = new IdentityVerificationService({ db, adapter });

    await assert.rejects(
      () => service.handleProviderResult({ ...callbackInput, providerPayload: {} }),
      (error) =>
        error instanceof KcbIdentityVerificationError && error.code === "session_not_found",
    );
  });

  it("resolves the popup-return path by module token and is idempotent there too", async () => {
    const { db, store } = createFakeDb();
    seedRedirectedRequest(store);
    const { adapter, calls } = fakeAdapter(verifyResponse());
    const service = new IdentityVerificationService({ db, adapter });

    const first = await service.handleProviderResultByModuleToken("MODULE-TOKEN", {});
    const second = await service.handleProviderResultByModuleToken("MODULE-TOKEN", {});

    assert.equal(first.status, "verified");
    assert.equal(second.status, "verified");
    assert.equal(calls.verifyStandard, 1);
    assert.equal(store.verifications.length, 1);
  });
});
