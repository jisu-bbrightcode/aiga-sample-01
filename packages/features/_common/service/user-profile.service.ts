import { createStorageService } from "@repo/core/storage";
import { type DrizzleDB, InjectDrizzle, profiles, user } from "@repo/drizzle";
import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { and, eq, ne } from "drizzle-orm";
import { handleSchema } from "../dto";

const storageConfig = {
  provider: (process.env.STORAGE_PROVIDER as "s3" | "r2" | "local") ?? "local",
  bucket: process.env.STORAGE_BUCKET,
  region: process.env.STORAGE_REGION,
  endpoint: process.env.STORAGE_ENDPOINT,
  publicUrl: process.env.STORAGE_PUBLIC_URL,
};

@Injectable()
export class UserProfileService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async me(userId: string) {
    const rows = await this.db
      .select({
        id: profiles.id,
        name: profiles.name,
        email: profiles.email,
        handle: profiles.handle,
        bio: profiles.bio,
        avatar: profiles.avatar,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async updateName(userId: string, name: string) {
    await this.db.update(user).set({ name }).where(eq(user.id, userId));
    await this.db
      .update(profiles)
      .set({ name, updatedAt: new Date() })
      .where(eq(profiles.id, userId));
    return { success: true };
  }

  async getAvatarUploadUrl(userId: string, input: { contentType: string; fileName: string }) {
    const storage = createStorageService(storageConfig);
    const ext = input.fileName.split(".").pop() ?? "png";
    const key = `avatars/${userId}/avatar-${Date.now()}.${ext}`;
    return storage.generatePresignedUrl(key, input.contentType);
  }

  async confirmAvatarUpload(userId: string, publicUrl: string) {
    await this.db.update(user).set({ image: publicUrl }).where(eq(user.id, userId));
    await this.db
      .update(profiles)
      .set({ avatar: publicUrl, updatedAt: new Date() })
      .where(eq(profiles.id, userId));
    return { success: true };
  }

  async checkHandle(userId: string, handle: string) {
    const parsed = handleSchema.safeParse(handle);
    if (!parsed.success) {
      throw new BadRequestException(
        "handle: lowercase, digits, hyphen; reserved words unavailable",
      );
    }
    const taken = await this.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.handle, parsed.data), ne(profiles.id, userId)))
      .limit(1);
    return { available: taken.length === 0 };
  }

  async updateHandle(userId: string, handle: string) {
    const parsed = handleSchema.safeParse(handle);
    if (!parsed.success) {
      throw new BadRequestException(
        "handle: lowercase, digits, hyphen; reserved words unavailable",
      );
    }
    const taken = await this.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.handle, parsed.data), ne(profiles.id, userId)))
      .limit(1);
    if (taken.length > 0) {
      throw new ConflictException("HANDLE_TAKEN");
    }
    await this.db
      .update(profiles)
      .set({ handle: parsed.data, updatedAt: new Date() })
      .where(eq(profiles.id, userId));
    return { success: true };
  }

  async updateBio(userId: string, bio: string) {
    const value = bio.trim();
    await this.db
      .update(profiles)
      .set({ bio: value === "" ? null : value, updatedAt: new Date() })
      .where(eq(profiles.id, userId));
    return { success: true };
  }
}
