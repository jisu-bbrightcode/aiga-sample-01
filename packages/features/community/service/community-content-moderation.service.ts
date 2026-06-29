import { Injectable, UnprocessableEntityException } from "@nestjs/common";

/**
 * OpenAI Moderation API 카테고리
 */
interface ModerationCategories {
  harassment: boolean;
  "harassment/threatening": boolean;
  hate: boolean;
  "hate/threatening": boolean;
  "self-harm": boolean;
  "self-harm/intent": boolean;
  "self-harm/instructions": boolean;
  sexual: boolean;
  "sexual/minors": boolean;
  violence: boolean;
  "violence/graphic": boolean;
  illicit: boolean;
  "illicit/violent": boolean;
}

interface ModerationResult {
  flagged: boolean;
  categories: ModerationCategories;
  category_scores: Record<string, number>;
}

export interface ContentModerationResult {
  allowed: boolean;
  reason: string | null;
  categories: string[];
}

const CATEGORY_MESSAGES: Record<string, string> = {
  harassment: "괴롭힘 또는 비하 표현",
  "harassment/threatening": "위협적인 표현",
  hate: "혐오 표현",
  "hate/threatening": "위협적 혐오 표현",
  "self-harm": "자해 관련 콘텐츠",
  "self-harm/intent": "자해 의도 표현",
  "self-harm/instructions": "자해 방법 안내",
  sexual: "성적 콘텐츠",
  "sexual/minors": "미성년 관련 성적 콘텐츠",
  violence: "폭력적 콘텐츠",
  "violence/graphic": "노골적 폭력 묘사",
  illicit: "불법 활동",
  "illicit/violent": "폭력적 불법 활동",
};

/**
 * 카테고리별 커스텀 임계값.
 * 게임 내러티브 커뮤니티에서는 violence를 완화하고, 아동/자해는 엄격하게.
 */
const CATEGORY_THRESHOLDS: Partial<Record<string, number>> = {
  violence: 0.9,
  "violence/graphic": 0.9,
  "sexual/minors": 0.3,
  "self-harm/instructions": 0.3,
};

@Injectable()
export class CommunityContentModerationService {
  /**
   * OpenAI Moderation API로 콘텐츠를 검사한다.
   * API 실패 시 콘텐츠를 통과시킨다 (장애로 모든 게시를 차단하면 안 됨).
   */
  async moderateContent(content: string): Promise<ContentModerationResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // API 키 미설정 시 통과 (개발 환경 등)
      return { allowed: true, reason: null, categories: [] };
    }

    try {
      const response = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "omni-moderation-latest",
          input: content,
        }),
      });

      if (!response.ok) {
        // API 실패 시: 통과시키되 로그
        console.error(`[content-moderation] OpenAI API error: ${response.status}`);
        return { allowed: true, reason: null, categories: [] };
      }

      const data = await response.json();
      const result: ModerationResult = data.results[0];

      if (!result) {
        return { allowed: true, reason: null, categories: [] };
      }

      // 커스텀 임계값 적용
      const flaggedCategories: string[] = [];

      for (const [category, flagged] of Object.entries(result.categories)) {
        const score = result.category_scores[category] ?? 0;
        const threshold = CATEGORY_THRESHOLDS[category];

        if (threshold !== undefined) {
          // 커스텀 임계값이 있는 카테고리
          if (score >= threshold) {
            flaggedCategories.push(category);
          }
        } else if (flagged) {
          // 기본 플래그 사용
          flaggedCategories.push(category);
        }
      }

      if (flaggedCategories.length === 0) {
        return { allowed: true, reason: null, categories: [] };
      }

      const matched = flaggedCategories.map((cat) => CATEGORY_MESSAGES[cat]).filter(Boolean);

      return {
        allowed: false,
        reason: `이 콘텐츠는 다음 사유로 등록할 수 없습니다: ${matched.join(", ")}`,
        categories: flaggedCategories,
      };
    } catch (error) {
      // 네트워크 오류 등: 통과시키되 로그
      console.error("[content-moderation] Error:", error);
      return { allowed: true, reason: null, categories: [] };
    }
  }

  /**
   * 콘텐츠를 검사하고, 위반 시 UnprocessableEntityException을 던진다.
   * post/comment 서비스에서 호출하는 편의 메서드.
   */
  async assertContentAllowed(texts: string[]): Promise<void> {
    const combined = texts.filter(Boolean).join("\n");
    if (!combined.trim()) return;

    const result = await this.moderateContent(combined);
    if (!result.allowed) {
      throw new UnprocessableEntityException({
        error: "CONTENT_MODERATION_FAILED",
        message: result.reason,
        categories: result.categories,
      });
    }
  }
}
