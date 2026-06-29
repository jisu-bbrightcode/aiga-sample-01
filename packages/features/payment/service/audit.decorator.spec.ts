/**
 * `withAuditLog` — pure unit tests with a mocked AuditService (no DB).
 *
 *   1. wraps fn, calls audit.log with action + before/after payloads
 *   2. when fn throws, audit.log is NOT called and the error propagates
 */
import { withAuditLog, type AuditableContext } from "./audit.decorator";
import type { AuditEntry, AuditService } from "./audit.service";

function makeCtx() {
  const calls: AuditEntry[] = [];
  const audit = {
    log: jest.fn(async (entry: AuditEntry) => {
      calls.push(entry);
    }),
  } as unknown as AuditService;
  const ctx: AuditableContext = {
    audit,
    session: { user: { id: "user_admin_1" } },
    req: { ip: "1.2.3.4", headers: { "user-agent": "MyAdminUI/1.0" } },
  };
  return { ctx, calls, audit };
}

describe("withAuditLog", () => {
  it("calls fn and writes audit row with input/output captured", async () => {
    const { ctx, calls } = makeCtx();
    const fn = jest.fn(
      async ({ input }: { input: { organizationId: string; reason: string } }) => ({
        ok: true,
        balance: 9000,
        organizationId: input.organizationId,
      }),
    );
    const wrapped = withAuditLog("grant_credits", fn);

    const out = await wrapped({
      ctx,
      input: { organizationId: "org_1", reason: "make-good" },
    });

    expect(out).toEqual({ ok: true, balance: 9000, organizationId: "org_1" });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
    const entry = calls[0]!;
    expect(entry.actorUserId).toBe("user_admin_1");
    expect(entry.action).toBe("grant_credits");
    expect(entry.targetOrgId).toBe("org_1");
    expect(entry.reason).toBe("make-good");
    expect(entry.payloadBefore).toEqual({
      organizationId: "org_1",
      reason: "make-good",
    });
    expect(entry.payloadAfter).toEqual({
      ok: true,
      balance: 9000,
      organizationId: "org_1",
    });
    expect(entry.ipAddress).toBe("1.2.3.4");
    expect(entry.userAgent).toBe("MyAdminUI/1.0");
  });

  it("does NOT log when fn throws — error propagates", async () => {
    const { ctx, calls, audit } = makeCtx();
    const wrapped = withAuditLog("explode", async () => {
      throw new Error("boom");
    });

    await expect(
      wrapped({ ctx, input: { organizationId: "org_1" } }),
    ).rejects.toThrow("boom");
    expect(calls).toHaveLength(0);
    expect((audit.log as jest.Mock).mock.calls).toHaveLength(0);
  });
});
