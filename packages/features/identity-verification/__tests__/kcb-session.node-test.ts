import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  type DrizzleDB,
  identityVerificationAttempts,
  identityVerificationRequests,
  identityVerifications,
} from "@repo/drizzle";
import { type KcbAdapterClient, type KcbHealth } from "../kcb";
import { IdentityVerificationService } from "../service";

// ---------------------------------------------------------------------------
// Minimal in-memory fakes. The session-creation path touches only insert(...).
// values(...).returning() (request + attempt rows) and update(...).set(...).
// where(...).returning() (status transition), so the fake implements just that
// chain. Tables are matched by reference identity against the real Drizzle tables.
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

  function buildRow(table: unknown, values: Row): Row {
    const now = new Date();
    if (table === identityVerificationRequests) {
      return {
        id: `req-${++idSeq}`,
        status: "created",
        moduleTokenHash: null,
        providerTransactionId: null,
        resultCode: null,
        failureCode: null,
        consentVersion: null,
        consentScope: null,
        consentedAt: null,
        createdAt: now,
        updatedAt: now,
        ...values,
      };
    }
    return { id: `row-${++idSeq}`, createdAt: now, ...values };
  }

  const db = {
    insert(table: unknown) {
      return {
        values(values: Row) {
          const row = buildRow(table, values);
          bucket(table).push(row);
          const result = [row];
          return Object.assign(Promise.resolve(result), {
            returning: () => Promise.resolve(result),
          });
        },
      };
    },
    update(table: unknown) {
      return {
        set(patch: Row) {
          const apply = () => {
            const rows = bucket(table);
            const updated = rows.map((r) => ({ ...r, ...patch }));
            if (table === identityVerificationRequests) store.requests = updated;
            return updated;
          };
          return {
            where() {
              return Object.assign(Promise.resolve(apply()), {
                returning: () => Promise.resolve(apply()),
              });
            },
          };
        },
      };
    },
  };

  return { db: db as unknown as DrizzleDB, store };
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function okHealth(): KcbHealth {
  return { ok: true, blockers: [] } as unknown as KcbHealth;
}

function blockedHealth(): KcbHealth {
  return { ok: false, blockers: ["configuration_required"] } as unknown as KcbHealth;
}

function fakeAdapter(health: KcbHealth, redirect = true): KcbAdapterClient {
  return {
    async health() {
      return health;
    },
    async createStandardRequest() {
      return {
        providerTransactionId: "tx-1",
        redirectUrl: "https://kcb.example/redirect",
        redirectMethod: "POST" as const,
        redirectForm: redirect ? { mdl_tkn: "MODULE-TOKEN" } : undefined,
      };
    },
  } as unknown as KcbAdapterClient;
}

const baseInput = {
  mode: "standard" as const,
  target: { action: "purchase" },
  consent: { version: "v1", scope: "name,phone,ci" },
};

describe("KCB session creation (PB-IDV-KCB-API-SESSION-001)", () => {
  it("issues a redirect, stores state/nonce as hashes only, and returns the secrets once", async () => {
    const { db, store } = createFakeDb();
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter(okHealth()) });

    const result = await service.createSession(null, baseInput, "1.2.3.4");

    assert.equal(result.status, "redirected");
    assert.equal(result.redirectUrl, "https://kcb.example/redirect");
    assert.equal(result.blocked, null);
    // Secrets are returned to the caller exactly once...
    assert.ok(result.state && result.nonce);
    // ...but only their hashes are persisted (never the plaintext, never the raw mdl_tkn).
    const stored = store.requests[0];
    assert.ok(stored);
    assert.equal(stored.stateHash, sha256(result.state as string));
    assert.equal(stored.nonceHash, sha256(result.nonce as string));
    assert.notEqual(stored.stateHash, result.state);
    assert.equal(stored.moduleTokenHash, sha256("MODULE-TOKEN"));
  });

  it("captures consent (version/scope/time) on the request", async () => {
    const { db, store } = createFakeDb();
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter(okHealth()) });

    const result = await service.createSession(null, baseInput);

    assert.equal(result.consentVersion, "v1");
    assert.equal(result.consentScope, "name,phone,ci");
    assert.ok(result.consentedAt, "consentedAt should be set when consent is provided");
    assert.equal(store.requests[0]?.consentVersion, "v1");
  });

  it("leaves consent null when the caller provides none", async () => {
    const { db } = createFakeDb();
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter(okHealth()) });

    const result = await service.createSession(null, { mode: "standard", target: { action: "x" } });

    assert.equal(result.consentVersion, null);
    assert.equal(result.consentScope, null);
    assert.equal(result.consentedAt, null);
  });

  it("records a 'redirected' attempt audit row with the client IP and no secrets", async () => {
    const { db, store } = createFakeDb();
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter(okHealth()) });

    await service.createSession(null, baseInput, "9.9.9.9");

    assert.equal(store.attempts.length, 1);
    const attempt = store.attempts[0];
    assert.ok(attempt);
    assert.equal(attempt.attemptNo, 1);
    assert.equal(attempt.outcome, "redirected");
    assert.equal(attempt.clientIp, "9.9.9.9");
    // Audit rows never carry verification secrets.
    assert.equal(attempt.resultCode, null);
  });

  it("separates an adapter health failure into a blocked user response + failed audit row", async () => {
    const { db, store } = createFakeDb();
    const service = new IdentityVerificationService({ db, adapter: fakeAdapter(blockedHealth()) });

    const result = await service.createSession(null, baseInput, "1.1.1.1");

    // User-facing: a stable blocked code, no redirect, no leaked secrets.
    assert.equal(result.status, "failed");
    assert.equal(result.redirectUrl, null);
    assert.equal(result.state, null);
    assert.deepEqual(result.blocked, {
      code: "configuration_required",
      message: result.blocked?.message,
    });
    // Consent is still retained even though verification never started.
    assert.equal(result.consentVersion, "v1");
    // Operational: the failure is logged as a per-attempt audit row.
    assert.equal(store.attempts.length, 1);
    const failedAttempt = store.attempts[0];
    assert.ok(failedAttempt);
    assert.equal(failedAttempt.outcome, "failed");
    assert.equal(failedAttempt.failureCode, "configuration_required");
  });
});
