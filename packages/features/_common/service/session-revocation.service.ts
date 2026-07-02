import { Injectable } from "@nestjs/common";
import { type DrizzleDB, InjectDrizzle, sessions } from "@repo/drizzle";
import { eq } from "drizzle-orm";

/**
 * Revokes Better Auth login sessions for a user.
 *
 * Used when an admin deactivates (정지) or archives/soft-deletes (보관) an
 * account so a still-open browser session cannot keep acting on a now-disabled
 * account. Together with `profiles.isActive=false` this keeps the session and
 * permission state consistent after account processing (AC: 계정 처리 후
 * 세션과 권한 상태가 일관되게 정리된다).
 *
 * Reversing the account state (reactivate / restore) intentionally does NOT
 * recreate sessions — the user simply signs in again, which re-checks the
 * (now re-enabled) account. This is what makes session cleanup one-directional
 * and consistent.
 *
 * Self-contained append-style writer (only needs `db`); provided directly in
 * any module that performs account state changes, mirroring AdminAuditService.
 */
@Injectable()
export class SessionRevocationService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * Delete every active session row for the user. Idempotent — returns the
   * number of sessions removed (0 when the user had none).
   */
  async revokeAllForUser(userId: string): Promise<number> {
    const removed = await this.db
      .delete(sessions)
      .where(eq(sessions.userId, userId))
      .returning({ id: sessions.id });
    return Array.isArray(removed) ? removed.length : 0;
  }
}
