/**
 * `withAuditLog` — tRPC middleware-style helper for admin mutations.
 *
 * Spec §5.4: every admin mutation under `admin.*` records a payment_audit_log
 * row. Phase 8 will wrap each admin procedure handler with this decorator;
 * Phase 7 ships the decorator + tests so Phase 8 has nothing extra to write.
 *
 * Behavior:
 *  - Captures `input` BEFORE the handler runs (deep-cloned so mutation by
 *    the handler doesn't pollute payloadBefore).
 *  - Runs the handler.
 *  - On success: writes payment_audit_log with payloadBefore=input,
 *    payloadAfter=result.
 *  - On error: re-throws WITHOUT logging. The tRPC error formatter / global
 *    interceptor handles failure observability separately. Rationale (spec
 *    §8.J immutability): an audit row implies the action took effect; a
 *    thrown handler may have rolled back state, so logging would be
 *    misleading. (If we ever need failure-audit, a separate "attempted"
 *    action prefix is the right design.)
 *
 * Convention for `targetOrgId` / `targetSubscriptionId` / `targetUserId`:
 *  We read the standard keys from `input` shallowly. Procedures whose input
 *  doesn't carry these can pass `extract` to override. Most admin mutations
 *  in spec §5.4 do follow these key names.
 */
import type { AuditService, AuditEntry } from "./audit.service";

export interface AuditableContext {
  audit: AuditService;
  session: { user: { id: string } };
  req?: {
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
  };
}

export interface WithAuditLogOptions<TInput, TOutput> {
  /**
   * Override target/reason extraction. Useful when the input shape differs
   * from the standard `{ organizationId, subscriptionId, userId, reason }`
   * convention.
   */
  extract?: (input: TInput, output: TOutput) => Partial<AuditEntry>;
}

export function withAuditLog<TInput, TOutput>(
  action: string,
  fn: (opts: { ctx: AuditableContext; input: TInput }) => Promise<TOutput>,
  options: WithAuditLogOptions<TInput, TOutput> = {},
): (opts: { ctx: AuditableContext; input: TInput }) => Promise<TOutput> {
  return async ({ ctx, input }) => {
    const before = cloneInput(input);
    const result = await fn({ ctx, input });

    const baseEntry: AuditEntry = {
      actorUserId: ctx.session.user.id,
      action,
      targetOrgId: pickString(input, "organizationId"),
      targetSubscriptionId: pickString(input, "subscriptionId"),
      targetUserId: pickString(input, "userId"),
      payloadBefore: before,
      payloadAfter: result,
      ipAddress: ctx.req?.ip,
      userAgent: extractUserAgent(ctx.req?.headers),
      reason: pickString(input, "reason"),
    };

    const overrides = options.extract?.(input, result) ?? {};
    await ctx.audit.log({ ...baseEntry, ...overrides });
    return result;
  };
}

function cloneInput(input: unknown): unknown {
  if (input === undefined || input === null) return input;
  // structuredClone exists in Node ≥17; safe baseline for the project.
  return structuredClone(input);
}

function pickString(input: unknown, key: string): string | undefined {
  if (input && typeof input === "object" && key in input) {
    const v = (input as Record<string, unknown>)[key];
    return typeof v === "string" ? v : undefined;
  }
  return undefined;
}

function extractUserAgent(
  headers: Record<string, string | string[] | undefined> | undefined,
): string | undefined {
  if (!headers) return undefined;
  const v = headers["user-agent"];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}
