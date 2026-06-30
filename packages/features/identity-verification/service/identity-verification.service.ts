import { createHash, randomBytes } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import {
  type DrizzleDB,
  identityVerificationAttempts,
  identityVerificationRequests,
  identityVerifications,
} from "@repo/drizzle";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  type CreateKcbSessionInput,
  KcbAdapterClient,
  type KcbAdapterVerifyResponse,
  type KcbCallbackInput,
  type KcbHealth,
  type RetryKcbVerificationInput,
  canRetryFromStatus,
  resolveUserVerificationStatus,
  userVerificationStatusMessage,
} from "../kcb";
import { KcbIdentityVerificationError, toPublicKcbError } from "../kcb/errors";

// Minimal structural contract for the rate limiter so the service stays framework-light
// and unit-testable without a DB. @repo/core/rate-limit's RateLimitService satisfies it.
export interface RateLimitGuard {
  assertRateLimit(
    identifier: string,
    config: { action: string; maxRequests: number; windowSeconds: number },
  ): Promise<void>;
}

// Retry abuse guard: at most 5 retries per user per 10 minutes (the underlying sliding
// window is shared across the user's retries; exceeding it yields HTTP 429).
const RETRY_RATE_LIMIT = {
  action: "identity_verification:retry",
  maxRequests: 5,
  windowSeconds: 600,
} as const;

export interface IdentityVerificationServiceOptions {
  db: DrizzleDB;
  adapter: KcbAdapterClient;
  standardReturnUrl?: string;
  standardCallbackUrl?: string;
  customModeEnabled?: boolean;
  retentionDays?: number;
  rateLimit?: RateLimitGuard;
}

export class IdentityVerificationService {
  private readonly db: DrizzleDB;
  private readonly adapter: KcbAdapterClient;
  private readonly standardReturnUrl?: string;
  private readonly standardCallbackUrl?: string;
  private readonly customModeEnabled: boolean;
  private readonly retentionDays: number;
  private readonly rateLimit?: RateLimitGuard;

  constructor(options: IdentityVerificationServiceOptions) {
    this.db = options.db;
    this.adapter = options.adapter;
    this.standardReturnUrl = options.standardReturnUrl;
    this.standardCallbackUrl = options.standardCallbackUrl;
    this.customModeEnabled = options.customModeEnabled ?? false;
    this.retentionDays = options.retentionDays ?? 365;
    this.rateLimit = options.rateLimit;
  }

  async health(): Promise<KcbHealth> {
    const health = await this.adapter.health();
    if (this.customModeEnabled && !health.customModeEnabled) {
      return {
        ...health,
        blockers: [...new Set([...health.blockers, "official_documents_required" as const])],
      };
    }
    return health;
  }

  // biome-ignore lint/complexity/noExcessiveLinesPerFunction: the request lifecycle is kept linear so blocked states and provider hand-off read top to bottom.
  async createSession(
    userId: string | null,
    input: CreateKcbSessionInput,
    clientIp: string | null = null,
  ) {
    const state = createSecret();
    const nonce = createSecret();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const forcedBlocker =
      input.mode === "custom" && !this.customModeEnabled ? "custom_mode_not_enabled" : null;

    const [request] = await this.db
      .insert(identityVerificationRequests)
      .values({
        userId,
        clientIp,
        provider: "kcb",
        mode: input.mode,
        targetAction: input.target.action,
        stateHash: hashSecret(state),
        nonceHash: hashSecret(nonce),
        // Consent evidence captured by the service before the provider popup. Stored
        // verbatim (non-sensitive: agreement version + consented scope), with the
        // server clock as the authoritative consent time.
        consentVersion: input.consent?.version ?? null,
        consentScope: input.consent?.scope ?? null,
        consentedAt: input.consent ? now : null,
        expiresAt,
      })
      .returning();

    if (!request) {
      throw new KcbIdentityVerificationError("provider_rejected", "Could not create request");
    }

    try {
      if (forcedBlocker) {
        throw new KcbIdentityVerificationError(
          forcedBlocker,
          "KCB custom mode is disabled until official documents and fixtures are available",
        );
      }

      const health = await this.health();
      if (!health.ok) {
        throw new KcbIdentityVerificationError(
          health.blockers[0] ?? "configuration_required",
          "KCB adapter is not ready",
        );
      }

      const adapterResponse = await this.adapter.createStandardRequest({
        requestId: request.id,
        sessionId: request.id,
        state,
        nonce,
        returnUrl: this.standardReturnUrl,
        callbackUrl: this.standardCallbackUrl,
        targetAction: input.target.action,
      });

      const moduleToken = adapterResponse.redirectForm?.mdl_tkn;
      const [updated] = await this.db
        .update(identityVerificationRequests)
        .set({
          status: "redirected",
          providerTransactionId: adapterResponse.providerTransactionId,
          moduleTokenHash: moduleToken ? hashSecret(moduleToken) : null,
          updatedAt: new Date(),
        })
        .where(eq(identityVerificationRequests.id, request.id))
        .returning();

      // First attempt audit row: the redirect hand-off is the only place a `redirected`
      // outcome originates (subsequent verified/failed/canceled/expired attempts are
      // recorded by the callback flow). Non-sensitive — no CI/DI, RRN, or raw payload.
      await this.recordAttempt(request.id, 1, "redirected", clientIp);

      return {
        ...serializeRequest(updated ?? request),
        redirectUrl: adapterResponse.redirectUrl,
        redirectMethod: adapterResponse.redirectMethod,
        redirectForm: adapterResponse.redirectForm ?? null,
        state,
        nonce,
        blocked: null,
      };
    } catch (error) {
      const publicError = toPublicKcbError(error);
      const [updated] = await this.db
        .update(identityVerificationRequests)
        .set({
          status: "failed",
          failureCode: publicError.code,
          resultCode: publicError.code,
          updatedAt: new Date(),
        })
        .where(eq(identityVerificationRequests.id, request.id))
        .returning();

      // Audit the blocked/failed hand-off as the first attempt so adapter health/JAR
      // failures are visible in the per-attempt log, separate from the user-facing
      // `blocked` response below.
      await this.recordAttempt(request.id, 1, "failed", clientIp, {
        failureCode: publicError.code,
      });

      return {
        ...serializeRequest(updated ?? request),
        redirectUrl: null,
        redirectMethod: null,
        redirectForm: null,
        state: null,
        nonce: null,
        blocked: publicError,
      };
    }
  }

  async getSession(sessionId: string) {
    const request = await this.loadRequest(sessionId);
    return request ? serializeRequest(request) : null;
  }

  /**
   * Verify via the sessionId + state/nonce carried on the return URL query. Used by the
   * legacy /callback and /return JSON endpoints.
   */
  async handleProviderResult(input: KcbCallbackInput) {
    const request = await this.loadRequest(input.sessionId);
    if (!request) {
      throw new KcbIdentityVerificationError("session_not_found", "KCB request not found");
    }
    if (
      request.stateHash !== hashSecret(input.state) ||
      request.nonceHash !== hashSecret(input.nonce)
    ) {
      throw new KcbIdentityVerificationError("replay_detected", "KCB state or nonce mismatch");
    }
    return this.finalizeVerification(request, input.providerPayload);
  }

  /**
   * Verify by resolving the request from the KCB module token (mdl_tkn), which KCB always
   * returns on the redirect. This does not depend on the return URL query string surviving
   * KCB's redirect (state/nonce can be lost there); the single-use mdl_tkn is itself the
   * correlation secret. Used by the browser popup-return endpoint.
   */
  async handleProviderResultByModuleToken(
    moduleToken: string,
    providerPayload: Record<string, unknown>,
  ) {
    const tokenHash = hashSecret(moduleToken);
    const [request] = await this.db
      .select()
      .from(identityVerificationRequests)
      .where(eq(identityVerificationRequests.moduleTokenHash, tokenHash))
      .limit(1);
    if (!request) {
      throw new KcbIdentityVerificationError("session_not_found", "KCB request not found");
    }
    return this.finalizeVerification(request, providerPayload);
  }

  // Verify-and-persist a provider result. Each terminal outcome (verified / canceled /
  // failed / expired / provider-error) maps to a distinct internal status and records an
  // immutable attempt audit row. Duplicate callbacks are idempotent: an already-finalized
  // request returns its stored result without re-calling the provider or re-inserting a
  // verification.
  private async finalizeVerification(
    request: RequestRow,
    providerPayload: Record<string, unknown>,
  ) {
    if (isTerminalStatus(request.status)) {
      return serializeRequest(request);
    }
    if (request.expiresAt.getTime() < Date.now()) {
      return this.finalizeExpired(request);
    }

    let result: KcbAdapterVerifyResponse;
    try {
      result =
        request.mode === "custom"
          ? await this.adapter.verifyCustom(providerPayload)
          : await this.adapter.verifyStandard(providerPayload);
    } catch (error) {
      return this.finalizeProviderError(request, error);
    }

    if (result.canceled) {
      return this.finalizeCanceled(request, result);
    }
    if (!result.verified) {
      return this.finalizeFailed(request, result);
    }
    return this.finalizeVerified(request, result);
  }

  private async finalizeExpired(request: RequestRow) {
    const now = new Date();
    const [updated] = await this.db
      .update(identityVerificationRequests)
      .set({ status: "expired", failureCode: "session_expired", updatedAt: now })
      .where(eq(identityVerificationRequests.id, request.id))
      .returning();
    await this.recordCallbackAttempt(request, "expired", { failureCode: "session_expired" });
    return serializeRequest(updated ?? request);
  }

  private async finalizeProviderError(request: RequestRow, error: unknown) {
    const publicError = toPublicKcbError(error);
    const now = new Date();
    const [updated] = await this.db
      .update(identityVerificationRequests)
      .set({
        status: "failed",
        resultCode: publicError.code,
        failureCode: publicError.code,
        updatedAt: now,
      })
      .where(eq(identityVerificationRequests.id, request.id))
      .returning();
    await this.recordCallbackAttempt(request, "failed", { failureCode: publicError.code });
    return serializeRequest(updated ?? request);
  }

  private async finalizeCanceled(request: RequestRow, result: KcbAdapterVerifyResponse) {
    const now = new Date();
    const [updated] = await this.db
      .update(identityVerificationRequests)
      .set({
        status: "canceled",
        providerTransactionId: result.providerTransactionId ?? request.providerTransactionId,
        resultCode: result.resultCode,
        failureCode: "canceled",
        updatedAt: now,
      })
      .where(eq(identityVerificationRequests.id, request.id))
      .returning();
    await this.recordCallbackAttempt(request, "canceled", {
      resultCode: result.resultCode,
      failureCode: "canceled",
    });
    return serializeRequest(updated ?? request);
  }

  private async finalizeFailed(request: RequestRow, result: KcbAdapterVerifyResponse) {
    const now = new Date();
    const [updated] = await this.db
      .update(identityVerificationRequests)
      .set({
        status: "failed",
        providerTransactionId: result.providerTransactionId ?? request.providerTransactionId,
        resultCode: result.resultCode,
        failureCode: "provider_rejected",
        updatedAt: now,
      })
      .where(eq(identityVerificationRequests.id, request.id))
      .returning();
    await this.recordCallbackAttempt(request, "failed", {
      resultCode: result.resultCode,
      failureCode: "provider_rejected",
    });
    return serializeRequest(updated ?? request);
  }

  private async finalizeVerified(request: RequestRow, result: KcbAdapterVerifyResponse) {
    const now = new Date();
    await this.db.insert(identityVerifications).values({
      requestId: request.id,
      userId: request.userId,
      provider: "kcb",
      ciHash: result.ciHash,
      diHash: result.diHash,
      nameMasked: result.nameMasked,
      phoneMasked: result.phoneMasked,
      birthYear: result.birthYear,
      verifiedAt: now,
      retainedUntil: retentionDate(now, this.retentionDays),
    });

    const [updated] = await this.db
      .update(identityVerificationRequests)
      .set({
        status: "verified",
        providerTransactionId: result.providerTransactionId ?? request.providerTransactionId,
        resultCode: result.resultCode,
        updatedAt: now,
      })
      .where(eq(identityVerificationRequests.id, request.id))
      .returning();

    await this.recordCallbackAttempt(request, "verified", { resultCode: result.resultCode });
    return serializeRequest(updated ?? request);
  }

  /**
   * Attach an (anonymous) verification to a user. Used when the builder composes this
   * feature with an authenticated flow (verify-then-signup).
   *
   * Requires proof of ownership: the caller must present the `state` secret returned in
   * the create response (only the verifying browser holds it). This prevents an
   * authenticated user from claiming another person's verification by its request id
   * (IDOR). Any unauthorized case returns null without revealing whether the request
   * exists or its state.
   */
  async linkVerification(userId: string, requestId: string, state: string) {
    const request = await this.loadRequest(requestId);
    if (!request) return null;
    if (request.status !== "verified") return null;
    if (request.stateHash !== hashSecret(state)) return null;
    if (request.userId && request.userId !== userId) return null;

    await this.db
      .update(identityVerificationRequests)
      .set({ userId, updatedAt: new Date() })
      .where(eq(identityVerificationRequests.id, requestId));
    await this.db
      .update(identityVerifications)
      .set({ userId })
      .where(eq(identityVerifications.requestId, requestId));
    const linked = await this.loadRequest(requestId);
    return linked ? serializeRequest(linked) : null;
  }

  /** Latest verified identity for a user (for gating). Null if not verified. */
  async getUserVerification(userId: string) {
    const verification = await this.loadUserVerification(userId);
    return verification ? serializeVerification(verification) : null;
  }

  private async loadUserVerification(userId: string) {
    const [verification] = await this.db
      .select()
      .from(identityVerifications)
      .where(and(eq(identityVerifications.userId, userId), isNull(identityVerifications.deletedAt)))
      .orderBy(desc(identityVerifications.verifiedAt))
      .limit(1);
    return verification ?? null;
  }

  private async loadLatestUserRequest(userId: string) {
    const [request] = await this.db
      .select()
      .from(identityVerificationRequests)
      .where(eq(identityVerificationRequests.userId, userId))
      .orderBy(desc(identityVerificationRequests.createdAt))
      .limit(1);
    return request ?? null;
  }

  /**
   * User-facing verification status (PB-IDV-KCB-API-STATUS-001, AC1 + AC2 + AC4).
   * Returns exactly one of five coarse states + a friendly message — never raw provider
   * or failure codes (those stay on the admin controller). `resume` carries the protected
   * action context so the client can return to the original action after completion.
   */
  async getUserStatus(userId: string) {
    const [request, verification] = await Promise.all([
      this.loadLatestUserRequest(userId),
      this.loadUserVerification(userId),
    ]);
    const status = resolveUserVerificationStatus(
      request ? { status: request.status, expiresAt: request.expiresAt } : null,
      Boolean(verification),
    );
    return {
      status,
      message: userVerificationStatusMessage(status),
      canRetry: canRetryFromStatus(status),
      verifiedAt: verification?.verifiedAt.toISOString() ?? null,
      identity: verification ? serializeVerification(verification) : null,
      // Protected-action resume context (AC2). The owner may pass `sessionId` back to
      // /retry; `targetAction` tells the client which action to resume on completion.
      resume: request
        ? {
            sessionId: request.id,
            targetAction: request.targetAction,
            expiresAt: request.expiresAt.toISOString(),
          }
        : null,
    };
  }

  /**
   * Retry a failed/canceled/expired verification (PB-IDV-KCB-API-STATUS-001, AC3).
   * Rate-limited per user (HTTP 429 on abuse). Policy:
   *   - already verified            → 409 (nothing to retry)
   *   - in progress (within window) → 409 (finish the open session first)
   *   - no prior request            → 404 (start a fresh session instead)
   *   - failed / expired            → create a NEW user-scoped session, reusing the
   *                                   source request's target + consent context.
   */
  async retrySession(
    userId: string,
    input: RetryKcbVerificationInput,
    clientIp: string | null = null,
  ) {
    if (this.rateLimit) {
      await this.rateLimit.assertRateLimit(userId, RETRY_RATE_LIMIT);
    }

    if (await this.loadUserVerification(userId)) {
      throw new ConflictException({
        message: "이미 본인확인이 완료되었습니다.",
        errorCode: "ALREADY_VERIFIED",
      });
    }

    const source = input.sessionId
      ? await this.loadOwnedRequest(userId, input.sessionId)
      : await this.loadLatestUserRequest(userId);
    if (!source) {
      throw new NotFoundException({
        message: "재시도할 본인확인 요청이 없습니다. 본인확인을 새로 시작해 주세요.",
        errorCode: "NO_RETRYABLE_VERIFICATION",
      });
    }

    const status = resolveUserVerificationStatus(
      { status: source.status, expiresAt: source.expiresAt },
      false,
    );
    if (status === "verified") {
      throw new ConflictException({
        message: "이미 본인확인이 완료되었습니다.",
        errorCode: "ALREADY_VERIFIED",
      });
    }
    if (status === "in_progress") {
      throw new ConflictException({
        message: "이미 진행 중인 본인확인이 있습니다. 인증 창에서 완료해 주세요.",
        errorCode: "VERIFICATION_IN_PROGRESS",
      });
    }

    // status is failed | expired — reuse the source's target + consent so the retried
    // session resumes the same protected action (AC2). The client may override `target`.
    const consent =
      source.consentVersion && source.consentScope
        ? { version: source.consentVersion, scope: source.consentScope }
        : undefined;
    return this.createSession(
      userId,
      {
        mode: source.mode,
        target: input.target ?? { action: source.targetAction },
        consent,
      },
      clientIp,
    );
  }

  /** Load a request only if it belongs to the given user (no cross-user leak). */
  private async loadOwnedRequest(userId: string, requestId: string) {
    const request = await this.loadRequest(requestId);
    if (!request || request.userId !== userId) return null;
    return request;
  }

  async listAdmin(limit = 50) {
    const rows = await this.db
      .select()
      .from(identityVerificationRequests)
      .orderBy(desc(identityVerificationRequests.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows.map(serializeRequest);
  }

  async getAdmin(id: string) {
    const request = await this.loadRequest(id);
    if (!request) return null;
    const verifications = await this.db
      .select()
      .from(identityVerifications)
      .where(eq(identityVerifications.requestId, id))
      .orderBy(desc(identityVerifications.verifiedAt));
    return {
      ...serializeRequest(request),
      verifications: verifications.map(serializeVerification),
    };
  }

  private async loadRequest(requestId: string) {
    const [request] = await this.db
      .select()
      .from(identityVerificationRequests)
      .where(eq(identityVerificationRequests.id, requestId))
      .limit(1);
    return request ?? null;
  }

  /**
   * Append an immutable per-attempt audit row. Stores only non-sensitive correlation
   * data (attempt number, outcome, stable codes, client IP) — never CI/DI, RRN, or the
   * raw provider payload.
   */
  private async recordAttempt(
    requestId: string,
    attemptNo: number,
    outcome: AttemptOutcome,
    clientIp: string | null,
    codes: AttemptCodes = {},
  ) {
    await this.db.insert(identityVerificationAttempts).values({
      requestId,
      attemptNo,
      outcome,
      resultCode: codes.resultCode ?? null,
      failureCode: codes.failureCode ?? null,
      clientIp,
    });
  }

  /**
   * Record a callback-flow attempt. The attempt number continues from the session's
   * first (`redirected`) row, so a request's retry history reads 1, 2, 3… across the
   * redirect hand-off and each callback outcome.
   */
  private async recordCallbackAttempt(
    request: RequestRow,
    outcome: AttemptOutcome,
    codes: AttemptCodes = {},
  ) {
    const attemptNo = await this.nextAttemptNo(request.id);
    await this.recordAttempt(request.id, attemptNo, outcome, request.clientIp, codes);
  }

  private async nextAttemptNo(requestId: string): Promise<number> {
    const rows = await this.db
      .select({ attemptNo: identityVerificationAttempts.attemptNo })
      .from(identityVerificationAttempts)
      .where(eq(identityVerificationAttempts.requestId, requestId));
    return rows.length + 1;
  }
}

type AttemptOutcome = "redirected" | "verified" | "failed" | "canceled" | "expired";
type AttemptCodes = { resultCode?: string | null; failureCode?: string | null };

const TERMINAL_STATUSES = new Set(["verified", "failed", "canceled", "expired"]);

/** A request whose outcome is already decided — duplicate callbacks must be idempotent. */
function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

type RequestRow = typeof identityVerificationRequests.$inferSelect;
type VerificationRow = typeof identityVerifications.$inferSelect;

function serializeRequest(request: RequestRow) {
  return {
    id: request.id,
    provider: request.provider,
    mode: request.mode,
    userId: request.userId,
    targetAction: request.targetAction,
    status: request.status,
    providerTransactionId: request.providerTransactionId,
    resultCode: request.resultCode,
    failureCode: request.failureCode,
    consentVersion: request.consentVersion,
    consentScope: request.consentScope,
    consentedAt: request.consentedAt?.toISOString() ?? null,
    expiresAt: request.expiresAt.toISOString(),
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

function serializeVerification(verification: VerificationRow) {
  return {
    id: verification.id,
    requestId: verification.requestId,
    userId: verification.userId,
    provider: verification.provider,
    ciHashPresent: Boolean(verification.ciHash),
    diHashPresent: Boolean(verification.diHash),
    nameMasked: verification.nameMasked,
    phoneMasked: verification.phoneMasked,
    birthYear: verification.birthYear,
    verifiedAt: verification.verifiedAt.toISOString(),
    retainedUntil: verification.retainedUntil?.toISOString() ?? null,
    deletedAt: verification.deletedAt?.toISOString() ?? null,
    createdAt: verification.createdAt.toISOString(),
  };
}

function createSecret(): string {
  return randomBytes(24).toString("base64url");
}

function hashSecret(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function retentionDate(from: Date, retentionDays: number): Date {
  return new Date(from.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}
