import { useFeatureTranslation } from "@repo/core/i18n";
import { checkProfanity } from "glin-profanity";
import { useState } from "react";

interface ProfanityCheckState {
  hasProfanity: boolean;
  message: string | null;
}

/**
 * 클라이언트 사이드 비속어 실시간 체크 (glin-profanity).
 * 게시물/댓글 작성 폼에서 타이핑 중 즉각적 피드백 제공.
 *
 * 서버의 OpenAI Moderation API (Layer 2)와 함께 2단계 하이브리드 필터를 구성.
 * - Layer 1 (이 hook): 즉각적 UX 피드백 + 등록 버튼 비활성화
 * - Layer 2 (서버): AI 기반 최종 게이트키퍼 (변형 표현도 감지)
 */
export function useProfanityCheck() {
  const { t } = useFeatureTranslation("app");
  const [result, setResult] = useState<ProfanityCheckState>({
    hasProfanity: false,
    message: null,
  });

  const check = (text: string) => {
    if (!text.trim()) {
      setResult({ hasProfanity: false, message: null });
      return;
    }

    const checkResult = checkProfanity(text);
    const profane = checkResult.containsProfanity;
    setResult({
      hasProfanity: profane,
      message: profane ? t("errors.profanityDetected") : null,
    });
  };

  const reset = () => {
    setResult({ hasProfanity: false, message: null });
  };

  return { ...result, check, reset };
}
