# Agent Desk 파일 업로드 고도화 설계

> 날짜: 2026-02-26
> 범위: 운영자 모드 파일 업로드/파싱/활용 강화

## 목표

FRD(`FRD-파일 업로드 파싱.md`) 대비 미구현 항목 5개를 구현한다.

## 구현 항목

### 1. PPTX 슬라이드별 텍스트+노트 추출

**현상**: `buffer.toString("utf-8")` — 바이너리가 깨짐
**해결**: `jszip`으로 PPTX(ZIP) 해체 → slide XML에서 텍스트 노드 추출

```
PPTX (ZIP)
├── ppt/slides/slide1.xml  → <a:t> 텍스트 추출
├── ppt/slides/slide2.xml
├── ppt/notesSlides/notesSlide1.xml → 발표자 노트 추출
└── ...
```

**파싱 결과 포맷**:
```markdown
## 슬라이드 1
텍스트 내용...

> 발표자 노트: ...

## 슬라이드 2
...
```

**패키지**: `jszip` (ZIP 해체만, 경량)

### 2. 이미지 LLM 멀티모달 분석

**현상**: `[이미지 파일: filename]` 하드코딩
**해결**: Anthropic SDK vision API로 이미지 → 텍스트 설명

**구현**:
- `LLMService`에 `describeImage(base64: string, mimeType: string)` 메서드 추가
- Claude `claude-sonnet-4-6` 모델 사용 (비용 효율)
- 시스템 프롬프트: "이미지를 상세히 설명하세요. UI 화면이면 레이아웃과 구성요소를 설명하세요."

**Anthropic vision API 형식**:
```typescript
messages: [{
  role: "user",
  content: [
    { type: "image", source: { type: "base64", media_type, data } },
    { type: "text", text: "이 이미지를 상세히 설명해주세요." }
  ]
}]
```

### 3. 세션당 200MB 합계 검증

**현상**: 검증 없음
**해결**: `confirmUpload` 프로시저에서 세션 파일 합계 체크

```typescript
// SessionService.getTotalFileSize(sessionId) 추가
const totalSize = await this.getTotalFileSize(sessionId);
if (totalSize + input.size > 200 * 1024 * 1024) {
  throw new BadRequestException("세션당 파일 용량 200MB 초과");
}
```

### 4. MIME + Magic Bytes 이중 검증

**현상**: 클라이언트 MIME만 검증
**해결**: `file-type` 라이브러리로 서버에서 파일 헤더 검증

```typescript
// parseFile 시작 시 magic bytes 확인
import { fileTypeFromBuffer } from 'file-type';
const detected = await fileTypeFromBuffer(buffer);
if (detected && detected.mime !== file.mimeType) {
  // 클라이언트가 보낸 MIME과 실제 파일 타입 불일치 → 경고 로그
}
```

**패키지**: `file-type`

### 5. 파싱 결과 마크다운 미리보기 UI

**현상**: 파싱 상태 아이콘만 표시
**해결**: FileCard 클릭 시 Sheet 컴포넌트로 parsedContent를 마크다운 렌더링

**UI 구조**:
```
FileCard 클릭 → Sheet 열림
┌─ SheetHeader ─────────────────────┐
│ 📄 filename.pdf                   │
│ PDF · 2.3MB · 5페이지 · 파싱 완료 │
├───────────────────────────────────┤
│ [마크다운 렌더링된 parsedContent] │
│ ...                               │
│ ...                               │
└───────────────────────────────────┘
```

**마크다운 렌더링**: 기존 `ChatMessage`에서 사용하는 마크다운 렌더러 재활용

## 변경 파일

### 서버
| 파일 | 변경 |
|------|------|
| `packages/features/ai/service/llm.service.ts` | `describeImage()` 메서드 추가 |
| `packages/features/agent-desk/service/file-parser.service.ts` | PPTX/이미지/magic bytes 파싱 개선 |
| `packages/features/agent-desk/service/session.service.ts` | `getTotalFileSize()` 추가 |
| `packages/features/agent-desk/trpc/agent-desk.route.ts` | confirmUpload에 200MB 검증 |

### 클라이언트
| 파일 | 변경 |
|------|------|
| `apps/app/src/features/agent-desk/pages/chat.tsx` | FileCard 클릭 → 미리보기 Sheet |

### 패키지 설치
| 패키지 | 위치 | 용도 |
|--------|------|------|
| `jszip` | `packages/features` | PPTX ZIP 해체 |
| `file-type` | `packages/features` | Magic bytes 검증 |
| `pdf-parse` | `packages/features` | PDF 텍스트 추출 |
