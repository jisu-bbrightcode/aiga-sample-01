import { createHash, randomBytes } from "node:crypto";
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
} from "../kcb";
import { KcbIdentityVerificationError, toPublicKcbError } from "../kcb/errors";

export interface IdentityVerificationServiceOptions {
  db: DrizzleDB;
  adapter: KcbAdapterClient;
  standardReturnUrl?: string;
  standardCallbackUrl?: string;
  customModeEnabled?: boolean;
  retentionDays?: number;
}

export class IdentityVerificationService {
  private readonly db: DrizzleDB;
  private readonly adapter: KcbAdapterClient;
  private readonly standardReturnUrl?: string;
  private readonly standardCallbackUrl?: string;
  private readonly customModeEnabled: boolean;
  private readonly retentionDays: number;

  constructor(options: IdentityVerificationServiceOptions) {
    this.db = options.db;
    this.adapter = options.adapter;
    this.standardReturnUrl = options.standardReturnUrl;
    this.standardCallbackUrl = options.standardCallbackUrl;
    this.customModeEnabled = options.customModeEnabled ?? false;
    this.retentionDays = options.retentionDays ?? 365;
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
      await this.recordAttempt(request.id, 1, "failed", clientIp, publicError.code);

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

  // biome-ignore lint/complexity/noExcessiveLinesPerFunction: verification finalize is intentionally linear (expiry -> replay -> provider verify -> persist).
  private async finalizeVerification(
    request: RequestRow,
    providerPayload: Record<string, unknown>,
  ) {
    if (request.expiresAt.getTime() < Date.now()) {
      await this.markRequest(request.id, "expired", "session_expired");
      throw new KcbIdentityVerificationError("session_expired", "KCB request expired");
    }
    if (request.status === "verified" || request.status === "failed") {
      throw new KcbIdentityVerificationError("replay_detected", "KCB replay detected");
    }

    let result: KcbAdapterVerifyResponse;
    try {
      result =
        request.mode === "custom"
          ? await this.adapter.verifyCustom(providerPayload)
          : await this.adapter.verifyStandard(providerPayload);
    } catch (error) {
      const publicError = toPublicKcbError(error);
      const [updated] = await this.db
        .update(identityVerificationRequests)
        .set({
          status: "failed",
          resultCode: publicError.code,
          failureCode: publicError.code,
          updatedAt: new Date(),
        })
        .where(eq(identityVerificationRequests.id, request.id))
        .returning();
      return serializeRequest(updated ?? request);
    }

    const now = new Date();
    if (!result.verified) {
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
      return serializeRequest(updated ?? request);
    }

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
    const [verification] = await this.db
      .select()
      .from(identityVerifications)
      .where(and(eq(identityVerifications.userId, userId), isNull(identityVerifications.deletedAt)))
      .orderBy(desc(identityVerifications.verifiedAt))
      .limit(1);
    return verification ? serializeVerification(verification) : null;
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

  private async markRequest(requestId: string, status: "failed" | "expired", failureCode: string) {
    await this.db
      .update(identityVerificationRequests)
      .set({ status, failureCode, updatedAt: new Date() })
      .where(eq(identityVerificationRequests.id, requestId));
  }

  /**
   * Append an immutable per-attempt audit row. Stores only non-sensitive correlation
   * data (attempt number, outcome, stable codes, client IP) — never CI/DI, RRN, or the
   * raw provider payload.
   */
  private async recordAttempt(
    requestId: string,
    attemptNo: number,
    outcome: "redirected" | "verified" | "failed" | "canceled" | "expired",
    clientIp: string | null,
    failureCode?: string,
  ) {
    await this.db.insert(identityVerificationAttempts).values({
      requestId,
      attemptNo,
      outcome,
      failureCode: failureCode ?? null,
      resultCode: failureCode ?? null,
      clientIp,
    });
  }
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
