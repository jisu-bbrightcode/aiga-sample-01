# Personal Color Analysis Tool — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 에이전트 도구로 퍼스널 컬러 분석 기능을 추가하여, 사용자 사진을 Gemini Vision으로 분석하고 컬러 팔레트를 제안한다.

**Architecture:** `apps/agent-server/src/tools/`에 새 도구 파일 1개를 추가하고, 도구 레지스트리에 등록한다. 기존 `image-generation.ts`의 Gemini API 호출 패턴을 재사용한다. DB 스키마 변경 없음.

**Tech Stack:** Vercel AI SDK (`tool` from "ai"), Zod, Gemini 2.5 Flash Vision API, fetch

**Design doc:** `docs/plans/2026-03-02-personal-color-analysis-design.md`

---

## Task 1: personal-color.ts 도구 파일 생성

**Files:**
- Create: `apps/agent-server/src/tools/personal-color.ts`

**Reference:** `apps/agent-server/src/tools/image-generation.ts` — Gemini API 호출 패턴, tool() 정의 패턴

**Step 1: 도구 파일 생성**

```typescript
// apps/agent-server/src/tools/personal-color.ts
import { tool } from "ai";
import { z } from "zod";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// ============================================================================
// Types
// ============================================================================

interface PersonalColorResult {
  season: string;
  seasonLabel: string;
  confidence: number;
  analysis: {
    skinTone: string;
    undertone: string;
    features: string;
  };
  palette: {
    primary: string[];
    accent: string[];
    neutral: string[];
    avoid: string[];
  };
  recommendation: string;
}

interface GeminiTextResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

// ============================================================================
// Prompt
// ============================================================================

const PERSONAL_COLOR_ANALYSIS_PROMPT = `당신은 전문 퍼스널 컬러 분석가입니다. 제공된 사진에서 인물의 퍼스널 컬러를 분석해주세요.

분석 기준:
1. 피부톤 (밝기, 따뜻함/차가움)
2. 언더톤 (warm/cool/neutral)
3. 눈동자 색상
4. 머리카락 색상 및 질감
5. 전체적인 컬러 조화

4계절 퍼스널 컬러 시스템으로 분류해주세요:
- spring_warm (봄 웜톤): 밝고 따뜻한 톤, 피치/코랄/살몬 계열
- summer_cool (여름 쿨톤): 부드럽고 차가운 톤, 라벤더/로즈/파우더블루 계열
- autumn_warm (가을 웜톤): 깊고 따뜻한 톤, 테라코타/머스타드/올리브 계열
- winter_cool (겨울 쿨톤): 선명하고 차가운 톤, 버건디/로얄블루/퓨시아 계열

반드시 아래 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요:
{
  "season": "spring_warm | summer_cool | autumn_warm | winter_cool",
  "seasonLabel": "한국어 시즌 이름 (예: 봄 웜톤)",
  "confidence": 0.0~1.0,
  "analysis": {
    "skinTone": "피부톤 설명",
    "undertone": "warm | cool | neutral",
    "features": "눈동자, 머리카락 등 특징 설명"
  },
  "palette": {
    "primary": ["#HEX1", "#HEX2", "#HEX3"],
    "accent": ["#HEX1", "#HEX2"],
    "neutral": ["#HEX1", "#HEX2", "#HEX3"],
    "avoid": ["#HEX1", "#HEX2", "#HEX3"]
  },
  "recommendation": "이 사람에게 어울리는 색상 활용 팁 (2-3문장)"
}`;

// ============================================================================
// Helper
// ============================================================================

async function analyzeWithGemini(imageBase64: string, imageMimeType: string): Promise<PersonalColorResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY 환경변수가 설정되지 않았습니다");
  }

  const response = await fetch(`${GEMINI_API_BASE}/gemini-2.5-flash:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: imageMimeType, data: imageBase64 } },
          { text: PERSONAL_COLOR_ANALYSIS_PROMPT },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API 오류 (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as GeminiTextResponse;
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error("Gemini API에서 분석 결과를 받지 못했습니다");
  }

  const parsed = JSON.parse(textContent) as PersonalColorResult;
  return parsed;
}

// ============================================================================
// Tools
// ============================================================================

export const personalColorTools = {
  "personal_color.analyze": tool({
    description:
      "사용자 사진을 분석하여 퍼스널 컬러(봄웜/여름쿨/가을웜/겨울쿨)를 판별하고, 어울리는 컬러 팔레트를 제안합니다. 사용자가 사진을 업로드하고 퍼스널 컬러 분석을 요청할 때 사용하세요.",
    parameters: z.object({
      imageUrl: z.string().url().describe("분석할 사용자 사진의 URL (Supabase Storage 등)"),
    }),
    execute: async ({ imageUrl }) => {
      try {
        // 1. 이미지 다운로드 → base64 변환
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`이미지 다운로드 실패: ${imageResponse.status}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString("base64");
        const imageMimeType = imageResponse.headers.get("content-type") ?? "image/jpeg";

        // 2. Gemini Vision으로 분석
        const analysisResult = await analyzeWithGemini(imageBase64, imageMimeType);

        // 3. 결과 반환
        return {
          success: true as const,
          ...analysisResult,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류";
        return {
          success: false as const,
          error: message,
        };
      }
    },
  }),
};
```

**Step 2: 코드 리뷰 체크포인트**

확인 사항:
- `tool()` 함수의 `description`, `parameters`, `execute` 패턴이 `image-generation.ts`와 일치하는지
- `GEMINI_API_BASE` 상수가 `image-generation.ts`와 동일한지
- 에러 핸들링 패턴 (`success: true/false`) 이 기존 도구와 일치하는지
- JSON 파싱 실패 시 에러가 catch 블록에서 처리되는지

**Step 3: 커밋**

```bash
git add apps/agent-server/src/tools/personal-color.ts
git commit -m "feat(agent-desk): add personal color analysis tool

Gemini 2.5 Flash Vision API를 사용하여 사용자 사진에서
퍼스널 컬러(4계절)를 분석하고 컬러 팔레트를 제안하는 도구 추가"
```

---

## Task 2: 도구 레지스트리에 등록

**Files:**
- Modify: `apps/agent-server/src/tools/index.ts`

**Step 1: index.ts에 import 및 registerTools 추가**

```typescript
// apps/agent-server/src/tools/index.ts
// 기존 import 하단에 추가:
import { personalColorTools } from "./personal-color";

// 기존 registerTools 호출 하단에 추가:
registerTools(personalColorTools);
```

변경 후 전체 파일:

```typescript
import { registerTools, getToolsForAgent, getAllToolNames } from "./tool-registry";
import { boardTools } from "./board.tools";
import { communityTools } from "./community.tools";
import { contentStudioTools } from "./content-studio.tools";
import { fileTools } from "./file.tools";
import { userTools } from "./user.tools";
import { imageGenerationTools } from "./image-generation";
import { personalColorTools } from "./personal-color";

// 모든 도구 등록
registerTools(boardTools);
registerTools(communityTools);
registerTools(contentStudioTools);
registerTools(fileTools);
registerTools(userTools);
registerTools(imageGenerationTools);
registerTools(personalColorTools);

export { getToolsForAgent, getAllToolNames };
```

**Step 2: 커밋**

```bash
git add apps/agent-server/src/tools/index.ts
git commit -m "feat(agent-desk): register personal color analysis tool

도구 레지스트리에 personal_color.analyze 등록.
에이전트 설정의 enabledTools에 추가하면 활성화됨."
```

---

## Task 3: TypeScript 빌드 검증

**Step 1: agent-server 타입 체크**

```bash
cd apps/agent-server && pnpm tsc --noEmit
```

Expected: 에러 없이 완료

**Step 2: 빌드 실패 시 수정**

가능한 에러:
- `tool` import 경로 오류 → `"ai"` 패키지 확인
- `Buffer` 타입 미인식 → `@types/node` 확인
- Gemini 응답 타입 미스매치 → `GeminiTextResponse` 인터페이스 조정

---

## Task 4: 런타임 검증

**Step 1: agent-server 실행 확인**

```bash
# 서버가 실행 중인지 확인
curl -s http://localhost:3003/health
```

Expected: 200 OK

**Step 2: 도구 등록 확인**

도구가 정상 등록되었는지 확인하는 방법:
- 서버 로그에서 등록된 도구 목록 확인
- 또는 Admin UI에서 에이전트 설정 시 `personal_color.analyze` 도구가 목록에 표시되는지 확인

**Step 3: 실제 분석 테스트 (수동)**

Admin에서 테스트 에이전트의 `enabledTools`에 `"personal_color.analyze"` 추가 후:
1. 채팅에서 사진 업로드
2. "퍼스널 컬러 분석해줘" 요청
3. 분석 결과 (시즌, 팔레트 HEX 코드) 정상 반환되는지 확인

---

## Task 5: 문서 업데이트

**Files:**
- Modify: `docs/reference/features-backend.md` — agent-desk 도구 목록에 personal_color.analyze 추가

**Step 1: reference 문서 업데이트**

agent-desk 또는 agent 관련 섹션에 새 도구 정보 추가:

```markdown
### personal_color.analyze
- 사용자 사진 → Gemini Vision → 퍼스널 컬러 분석 (4계절)
- 컬러 팔레트 (primary, accent, neutral, avoid) 반환
- 에이전트 enabledTools에 추가하여 활성화
```

**Step 2: 커밋**

```bash
git add docs/reference/features-backend.md
git commit -m "docs: add personal color analysis tool to reference"
```
