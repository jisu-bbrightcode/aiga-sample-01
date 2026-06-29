/**
 * Org Admin Guard (admin shell / RBAC — PB-ADMIN-001)
 *
 * Runs after BetterAuthGuard (which populates `request.user` with
 * `{ id, email, activeOrganizationId }`). Grants access to admin REST
 * endpoints when the caller is a privileged member of their organization.
 *
 * Authoritative signal: Better Auth organization membership role
 * (`members.role` ∈ {owner, admin}). This matches the client admin guard
 * (`useActiveOrganization().members[].role`) and the super-account bootstrap,
 * which seeds the first operator as an `owner` member.
 *
 * Fallback: the legacy RBAC `user_roles`/`roles` slugs, so deployments that
 * seed that system keep working. Either signal is sufficient; both are strict
 * admin signals. Fails closed on any error.
 */
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { DRIZZLE, members, roles, userRoles } from "@repo/drizzle";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

const ADMIN_ROLES = ["owner", "admin"];

interface RequestUser {
  id?: string;
  activeOrganizationId?: string | null;
}

@Injectable()
export class OrgAdminGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<Record<string, never>>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: RequestUser | undefined = request.user;

    if (!user?.id) {
      throw new ForbiddenException("관리자 권한이 필요합니다.");
    }

    if ((await this.hasOrgAdminRole(user)) || (await this.hasRbacAdminRole(user.id))) {
      return true;
    }

    throw new ForbiddenException("관리자 권한이 필요합니다.");
  }

  /** Better Auth organization membership role (authoritative). */
  private async hasOrgAdminRole(user: RequestUser): Promise<boolean> {
    try {
      const conditions = [eq(members.userId, user.id as string)];
      if (user.activeOrganizationId) {
        conditions.push(eq(members.organizationId, user.activeOrganizationId));
      }
      const rows = await this.db
        .select({ role: members.role })
        .from(members)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .limit(10);
      return rows.some((r: { role: string }) => ADMIN_ROLES.includes(r.role));
    } catch {
      return false;
    }
  }

  /** Legacy RBAC user_roles/roles slugs (fallback). */
  private async hasRbacAdminRole(userId: string): Promise<boolean> {
    try {
      const rows = await this.db
        .select({ slug: roles.slug })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, userId))
        .limit(10);
      return rows.some((r: { slug: string }) => ADMIN_ROLES.includes(r.slug));
    } catch {
      return false;
    }
  }
}
