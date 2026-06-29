import { createStorageService } from "@repo/core/storage";
import {
  type DrizzleDB,
  InjectDrizzle,
  invitations,
  member,
  organization,
  profiles,
} from "@repo/drizzle";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

const storageConfig = {
  provider: (process.env.STORAGE_PROVIDER as "s3" | "r2" | "local") ?? "local",
  bucket: process.env.STORAGE_BUCKET,
  region: process.env.STORAGE_REGION,
  endpoint: process.env.STORAGE_ENDPOINT,
  publicUrl: process.env.STORAGE_PUBLIC_URL,
};

interface OrgMetadata {
  billingEmail?: string;
  deletedAt?: string;
}

function parseMetadata(raw: string | null): OrgMetadata {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as OrgMetadata;
  } catch {
    return {};
  }
}

@Injectable()
export class OrganizationSettingsService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  private async assertOrgMember(userId: string, organizationId: string): Promise<string> {
    const [row] = await this.db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
      .limit(1);
    if (!row) {
      throw new ForbiddenException("조직에 접근 권한이 없습니다.");
    }
    return row.role;
  }

  private async assertOrgAdmin(userId: string, organizationId: string): Promise<string> {
    const role = await this.assertOrgMember(userId, organizationId);
    if (role !== "owner" && role !== "admin") {
      throw new ForbiddenException("조직 관리자만 변경할 수 있습니다.");
    }
    return role;
  }

  async update(userId: string, organizationId: string, updates: { name?: string; slug?: string }) {
    await this.assertOrgAdmin(userId, organizationId);
    await this.db.update(organization).set(updates).where(eq(organization.id, organizationId));
    return { success: true };
  }

  async getLogoUploadUrl(
    userId: string,
    organizationId: string,
    input: { contentType: string; fileName: string },
  ) {
    await this.assertOrgAdmin(userId, organizationId);
    const storage = createStorageService(storageConfig);
    const ext = input.fileName.split(".").pop() ?? "png";
    const key = `orgs/${organizationId}/logo-${Date.now()}.${ext}`;
    return storage.generatePresignedUrl(key, input.contentType);
  }

  async confirmLogoUpload(userId: string, organizationId: string, publicUrl: string) {
    await this.assertOrgAdmin(userId, organizationId);
    await this.db
      .update(organization)
      .set({ logo: publicUrl })
      .where(eq(organization.id, organizationId));
    return { success: true };
  }

  async getMetadata(userId: string, organizationId: string) {
    await this.assertOrgMember(userId, organizationId);
    const rows = await this.db
      .select({ metadata: organization.metadata })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    const meta = parseMetadata(rows[0]?.metadata ?? null);
    return { billingEmail: meta.billingEmail ?? null };
  }

  async updateBillingEmail(userId: string, organizationId: string, billingEmail: string | null) {
    await this.assertOrgAdmin(userId, organizationId);
    const rows = await this.db
      .select({ metadata: organization.metadata })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    const meta = parseMetadata(rows[0]?.metadata ?? null);
    meta.billingEmail = billingEmail ?? undefined;
    await this.db
      .update(organization)
      .set({ metadata: JSON.stringify(meta) })
      .where(eq(organization.id, organizationId));
    return { success: true };
  }

  async deleteOrganization(userId: string, organizationId: string) {
    const [row] = await this.db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
      .limit(1);
    if (!row || row.role !== "owner") {
      throw new ForbiddenException("조직 owner 만 삭제할 수 있습니다.");
    }
    const rows = await this.db
      .select({ metadata: organization.metadata })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);
    const meta = parseMetadata(rows[0]?.metadata ?? null);
    meta.deletedAt = new Date().toISOString();
    await this.db
      .update(organization)
      .set({ metadata: JSON.stringify(meta) })
      .where(eq(organization.id, organizationId));
    return { success: true };
  }

  async getMyMembership(userId: string, organizationId: string) {
    const [row] = await this.db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
      .limit(1);
    return row ? { role: row.role } : null;
  }

  async listMembers(userId: string, organizationId: string) {
    await this.assertOrgMember(userId, organizationId);
    const [members, pending] = await Promise.all([
      this.db
        .select({
          id: member.id,
          userId: member.userId,
          role: member.role,
          createdAt: member.createdAt,
          name: profiles.name,
          email: profiles.email,
          handle: profiles.handle,
          avatar: profiles.avatar,
        })
        .from(member)
        .leftJoin(profiles, eq(profiles.id, member.userId))
        .where(eq(member.organizationId, organizationId)),
      this.db
        .select({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          status: invitations.status,
          expiresAt: invitations.expiresAt,
          inviterId: invitations.inviterId,
          inviterName: profiles.name,
          inviterEmail: profiles.email,
        })
        .from(invitations)
        .leftJoin(profiles, eq(profiles.id, invitations.inviterId))
        .where(
          and(eq(invitations.organizationId, organizationId), eq(invitations.status, "pending")),
        ),
    ]);
    return { members, pending };
  }
}
