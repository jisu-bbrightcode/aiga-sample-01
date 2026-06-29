import { type DrizzleDB, InjectDrizzle, profiles, roles, user, userRoles } from "@repo/drizzle";
import { Injectable } from "@nestjs/common";
import { count, desc, eq, inArray } from "drizzle-orm";

export interface AdminUsersListOptions {
  limit?: number;
  offset?: number;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  image: string | null;
  roles: string[];
  createdAt: string;
  emailVerified: boolean;
  isActive: boolean;
}

export interface AdminUsersListResponse {
  users: AdminUserListItem[];
  total: number;
}

@Injectable()
export class AdminUsersService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async list(options: AdminUsersListOptions): Promise<AdminUsersListResponse> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);

    const [totalRow] = await this.db.select({ count: count() }).from(user);
    const rows = await this.db
      .select({
        id: user.id,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        profileName: profiles.name,
        profileEmail: profiles.email,
        profileAvatar: profiles.avatar,
        isActive: profiles.isActive,
      })
      .from(user)
      .leftJoin(profiles, eq(profiles.id, user.id))
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset);

    const userIds = rows.map((row) => row.id);
    const roleRows =
      userIds.length > 0
        ? await this.db
            .select({
              userId: userRoles.userId,
              roleSlug: roles.slug,
            })
            .from(userRoles)
            .innerJoin(roles, eq(roles.id, userRoles.roleId))
            .where(inArray(userRoles.userId, userIds))
        : [];

    const rolesByUserId = new Map<string, string[]>();
    for (const row of roleRows) {
      if (!row.roleSlug) continue;
      const list = rolesByUserId.get(row.userId) ?? [];
      if (!list.includes(row.roleSlug)) {
        list.push(row.roleSlug);
      }
      rolesByUserId.set(row.userId, list);
    }

    const users: AdminUserListItem[] = [];
    for (const row of rows) {
      users.push({
        id: row.id,
        name: row.profileName ?? row.userName,
        email: row.profileEmail ?? row.userEmail,
        image: row.profileAvatar ?? row.userImage,
        roles: rolesByUserId.get(row.id) ?? ["user"],
        createdAt: row.createdAt.toISOString(),
        emailVerified: row.emailVerified,
        isActive: row.isActive ?? true,
      });
    }

    return {
      users,
      total: totalRow?.count ?? 0,
    };
  }
}
