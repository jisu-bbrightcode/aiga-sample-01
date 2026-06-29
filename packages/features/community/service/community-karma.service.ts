import { Injectable } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { userKarma } from "@repo/drizzle/schema";
import { eq, inArray } from "drizzle-orm";

export interface UserKarmaSummary {
  userId: string;
  postKarma: number;
  commentKarma: number;
  totalKarma: number;
}

@Injectable()
export class CommunityKarmaService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async getKarma(userId: string): Promise<UserKarmaSummary> {
    const [karma] = await this.db
      .select()
      .from(userKarma)
      .where(eq(userKarma.userId, userId))
      .limit(1);

    if (!karma) {
      return this.createDefaultKarma(userId);
    }

    return {
      userId: karma.userId,
      postKarma: karma.postKarma,
      commentKarma: karma.commentKarma,
      totalKarma: karma.totalKarma,
    };
  }

  async getBatchKarma(userIds: string[]): Promise<UserKarmaSummary[]> {
    if (userIds.length === 0) {
      return [];
    }

    const uniqueUserIds = [...new Set(userIds)];
    const rows = await this.db
      .select()
      .from(userKarma)
      .where(inArray(userKarma.userId, uniqueUserIds));
    const karmaByUserId = new Map(rows.map((row) => [row.userId, row]));

    return uniqueUserIds.map((userId) => {
      const karma = karmaByUserId.get(userId);
      if (!karma) {
        return this.createDefaultKarma(userId);
      }

      return {
        userId: karma.userId,
        postKarma: karma.postKarma,
        commentKarma: karma.commentKarma,
        totalKarma: karma.totalKarma,
      };
    });
  }

  private createDefaultKarma(userId: string): UserKarmaSummary {
    return {
      userId,
      postKarma: 0,
      commentKarma: 0,
      totalKarma: 0,
    };
  }
}
