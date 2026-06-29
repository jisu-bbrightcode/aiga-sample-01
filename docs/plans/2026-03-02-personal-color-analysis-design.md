# Personal Color Analysis Tool — Design Document

> 에이전트 데스크에서 사용하는 퍼스널 컬러 분석 도구

## 배경

사용자가 자신의 사진을 업로드하면 AI가 퍼스널 컬러를 분석하고, 어울리는 컬러 팔레트를 제안한다.
분석 결과는 에이전트 채팅 세션 내에서 임시로 기억되며, 이후 랜딩페이지 생성 시 참조할 수 있다.

## 결정 사항

| 항목 | 결정 |
|------|------|
| AI 분석 방식 | Vision AI 자동 분석 (Gemini 2.5 Flash) |
| 색상 반영 범위 | 사용자가 선택 (전체 테마 / 액센트만 / 배경만 등) |
| MVP 범위 | 사진 업로드 → AI 분석 → 팔레트 제안/선택 → 세션 임시 저장 |
| 저장 방식 | 에이전트 대화 컨텍스트 (DB 스키마 변경 없음) |
| 구현 방식 | 에이전트 도구 (agent-server tool registry) |
| 랜딩페이지 연동 | 다음 단계 (MVP 이후) |

## 아키텍처

```
사용자 → 사진 업로드 → 에이전트에게 "퍼스널 컬러 분석해줘" 요청
  → 에이전트가 personal_color.analyze 도구 자동 호출
  → Gemini 2.5 Flash Vision이 사진 분석
  → 시즌 + 컬러 팔레트 결과 반환
  → 에이전트가 대화 컨텍스트에 자연스럽게 기억
  → 이후 "랜딩페이지 만들어줘" 요청 시 팔레트 참조
```

### 구현 위치

| 파일 | 변경 | 설명 |
|------|------|------|
| `apps/agent-server/src/tools/personal-color.ts` | 신규 | 퍼스널 컬러 분석 도구 |
| `apps/agent-server/src/tools/index.ts` | 수정 | 도구 등록 추가 |

### 변경하지 않는 것

- DB 스키마 변경 없음
- `packages/features/` 새 Feature 없음
- Admin UI 변경 없음 (기존 에이전트 설정에서 도구 on/off)
- `apps/app/` 변경 없음

## 도구 설계

### personal_color.analyze

**입력**:

```typescript
{
  imageUrl: string;  // 사용자 업로드 사진 URL
}
```

**내부 동작**:

1. 이미지 URL에서 다운로드 → base64 변환
2. Gemini 2.5 Flash에 이미지 + 구조화된 분석 프롬프트 전송
3. JSON 응답 파싱 → 결과 반환

**출력**:

```typescript
{
  success: true;
  season: "spring_warm" | "summer_cool" | "autumn_warm" | "winter_cool";
  seasonLabel: string;       // "봄 웜톤"
  confidence: number;        // 0.0 ~ 1.0
  analysis: {
    skinTone: string;        // "밝고 따뜻한 아이보리 톤"
    undertone: "warm" | "cool" | "neutral";
    features: string;        // "밝은 갈색 눈동자, 따뜻한 톤의 머리카락"
  };
  palette: {
    primary: string[];       // 메인 컬러 HEX 3개
    accent: string[];        // 액센트 컬러 HEX 2개
    neutral: string[];       // 뉴트럴 컬러 HEX 3개
    avoid: string[];         // 피해야 할 컬러 HEX
  };
  recommendation: string;   // 자연어 추천 설명
}
```

### Vision AI 프롬프트 전략

- 피부톤(undertone: warm/cool/neutral) 분석
- 눈동자 색상, 머리카락 색상 종합 판단
- 4계절 퍼스널 컬러 시스템 (봄웜, 여름쿨, 가을웜, 겨울쿨) 기반 분류
- 구체적 HEX 컬러 팔레트 생성
- JSON 형식 구조화 응답

## 에이전트 연동 흐름

### 1. 도구 활성화

운영자가 Admin에서 에이전트 설정 시 `enabledTools`에 `"personal_color.analyze"` 추가.

### 2. 채팅 세션

```
사용자: [사진 업로드] "내 퍼스널 컬러 분석해줘"
에이전트: → personal_color.analyze 호출
        → "분석 결과, 봄 웜톤이시네요! 코랄, 피치, 살몬 핑크 같은
           따뜻하고 밝은 색상이 잘 어울립니다."
        → 팔레트 HEX 코드 제시

사용자: "좀 더 차분한 톤으로 바꿔줘"
에이전트: → 대화 컨텍스트에서 이전 결과 참조
        → AI가 팔레트 조정하여 제안 (도구 재호출 불필요)

사용자: "이 팔레트로 랜딩페이지 만들어줘" (향후)
에이전트: → 대화 히스토리에서 팔레트 참조
        → 랜딩페이지 생성 시 컬러 정보 전달
```

### 3. 세션 임시 저장

- 별도 저장 로직 없음
- `agentMessages` 테이블에 도구 호출 결과가 `toolResults` JSONB로 자동 저장
- 같은 스레드 내에서 이전 분석 결과 참조 가능
- 새 스레드 시작 시 컨텍스트에서 빠짐 (메시지 기록은 DB에 남음)

## 기술 상세

### Gemini Vision API 호출

```typescript
// 기존 image-generation.ts의 Gemini 호출 패턴 재사용
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
      responseModalities: ["TEXT"],  // 텍스트 응답만
      responseMimeType: "application/json",
    },
  }),
});
```

### 환경 변수

추가 환경 변수 없음. 기존 `GOOGLE_GENERATIVE_AI_API_KEY` 공유.

## 향후 확장 (MVP 이후)

1. **랜딩페이지 연동**: 분석된 팔레트를 랜딩페이지 생성 도구에 자동 전달
2. **DB 영구 저장**: 프로필에 퍼스널 컬러 정보 연결
3. **리치 카드 UI**: 채팅 내 팔레트 카드 컴포넌트 렌더링
4. **다중 사진 분석**: 여러 사진으로 정확도 향상
