import { type DrizzleDB, InjectDrizzle, userPreferences } from "@repo/drizzle";
import { Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";

@Injectable()
export class UserPreferenceService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async get(userId: string, key: string): Promise<string | null> {
    const result = await this.db
      .select()
      .from(userPreferences)
      .where(and(eq(userPreferences.userId, userId), eq(userPreferences.key, key)))
      .limit(1);
    return result[0]?.value ?? null;
  }

  async set(userId: string, key: string, value: string) {
    await this.db
      .insert(userPreferences)
      .values({ userId, key, value })
      .onConflictDoUpdate({
        target: [userPreferences.userId, userPreferences.key],
        set: { value, updatedAt: new Date() },
      });
    return { success: true };
  }

  async getAll(userId: string): Promise<Record<string, string>> {
    const results = await this.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return Object.fromEntries(results.map((row) => [row.key, row.value]));
  }
}
