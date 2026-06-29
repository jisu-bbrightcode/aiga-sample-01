import { Injectable } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { type AutomodConfig, communities } from "@repo/drizzle/schema";
import { eq } from "drizzle-orm";

export interface KeywordFilterResult {
  passed: boolean;
  matchedWords: string[];
  action: "allow" | "block" | "review";
}

@Injectable()
export class CommunityKeywordFilterService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * 텍스트 배열에서 금지어를 검사한다.
   * word boundary(\b) 기반 매칭, 대소문자 무시.
   */
  checkContent(texts: string[], bannedWords: string[]): KeywordFilterResult {
    if (bannedWords.length === 0) {
      return { passed: true, matchedWords: [], action: "allow" };
    }

    const escaped = bannedWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

    const matched = new Set<string>();
    for (const text of texts) {
      if (!text) continue;
      const matches = text.match(pattern);
      if (matches) {
        for (const m of matches) {
          matched.add(m.toLowerCase());
        }
      }
    }

    if (matched.size === 0) {
      return { passed: true, matchedWords: [], action: "allow" };
    }

    return {
      passed: false,
      matchedWords: [...matched],
      action: "review",
    };
  }

  /**
   * 커뮤니티의 bannedWords + automodConfig를 로드하고 콘텐츠를 검사한다.
   * enableKeywordFilter가 false면 항상 통과.
   * bypassFilter가 true면 항상 통과 (신뢰 회원 우회).
   */
  async validateContent(
    communityId: string,
    texts: string[],
    options?: { bypassFilter?: boolean },
  ): Promise<KeywordFilterResult> {
    if (options?.bypassFilter) {
      return { passed: true, matchedWords: [], action: "allow" };
    }
    const [community] = await this.db
      .select({
        bannedWords: communities.bannedWords,
        automodConfig: communities.automodConfig,
      })
      .from(communities)
      .where(eq(communities.id, communityId))
      .limit(1);

    if (!community) {
      return { passed: true, matchedWords: [], action: "allow" };
    }

    const config = (community.automodConfig ?? {}) as AutomodConfig;
    if (!config.enableKeywordFilter) {
      return { passed: true, matchedWords: [], action: "allow" };
    }

    const bannedWords = (community.bannedWords ?? []) as string[];
    if (bannedWords.length === 0) {
      return { passed: true, matchedWords: [], action: "allow" };
    }

    const result = this.checkContent(texts, bannedWords);
    if (!result.passed) {
      result.action = config.keywordFilterAction ?? "review";
    }

    return result;
  }
}
