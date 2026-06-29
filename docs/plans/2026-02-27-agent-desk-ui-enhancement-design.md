# Agent Desk 프롬프트 UI 상품성 고도화 — 디자인 문서

> 접근법: Incremental Enhancement (점진적 개선)
> 목표: ChatGPT/Claude 수준의 프롬프트 UI 상품성 달성

---

## 현재 상태 요약

| 영역 | 현재 | 목표 |
|------|------|------|
| 빈 화면 | Bot 아이콘 + "파일 업로드" 버튼 | 추천 프롬프트 카드 4개 |
| 메시지 액션 | 없음 (코드 블록 복사만) | 복사, 재생성, 좋아요/싫어요 |
| 파일 업로드 | 기본적 (드래그&드롭, 파일 선택) | 이미지 페이스트, 에러 피드백, 인라인 썸네일 |
| 입력 영역 | 고정 높이 Textarea | 자동 리사이즈, Esc 중지, 포커스 자동화 |
| 세션 목록 | 제목 + 상태 + 생성일 | 메시지 미리보기, 상대 시간, 이름 변경, 검색 |
| 에러 처리 | 조용히 무시 | 인라인 에러 + 토스트 + 재시도 |
| 시각적 폴리시 | 기본적 | 파이프라인 패널 고정, 반응형 개선 |

---

## 1. 빈 화면 추천 프롬프트 (Empty State with Suggestions)

### 현재 코드
- `chat.tsx:408-426` — `EmptyState` 컴포넌트
- Bot 아이콘, "대화를 시작해보세요", 파일 업로드 버튼

### 변경

```
┌──────────────────────────────────────────────┐
│              🤖 (Agent Avatar lg)            │
│         에이전트 데스크에 오신 것을             │
│            환영합니다                          │
│      세션 타입별 설명 텍스트                    │
│                                              │
│  ┌──────────────┐  ┌──────────────────┐      │
│  │ 📄 기획문서로  │  │ 🖼️ 화면 캡처로    │      │
│  │  서비스 분석   │  │  UI 분석 요청     │      │
│  └──────────────┘  └──────────────────┘      │
│  ┌──────────────┐  ┌──────────────────┐      │
│  │ 📊 PPT로 요구 │  │ 💡 아이디어로     │      │
│  │  사항 전달     │  │  Feature 설계     │      │
│  └──────────────┘  └──────────────────┘      │
│                                              │
│    또는 파일을 드래그하여 업로드하세요           │
└──────────────────────────────────────────────┘
```

### 구현 상세

- `EmptyState` 컴포넌트를 session type (customer/operator)별로 다른 추천 프롬프트 표시
- 각 카드 클릭 시 `onSelectPrompt(text)` 콜백으로 입력창에 삽입
- customer 모드: "서비스 요구사항을 정리해주세요", "경쟁 서비스 분석을 해주세요" 등
- operator 모드: "기획문서를 분석해주세요", "화면 캡처를 보고 Feature를 설계해주세요" 등
- `@repo/ui` Card 컴포넌트 활용

### 파일 변경
- `apps/app/src/features/agent-desk/pages/chat.tsx` — EmptyState 개선

---

## 2. 메시지 액션 (Message Actions)

### 현재 코드
- `packages/ui/src/components/chat/chat-message.tsx` — 액션 없음
- CodeBlock에만 복사 기능 존재

### 변경

메시지 호버 시 하단에 액션 바 표시:

```
┌─ assistant message ──────────────────────┐
│  분석 결과를 정리했습니다.                   │
│  ...                                      │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐                 │
│  │📋│ │🔄│ │👍│ │👎│                 │  ← 호버 시
│  └───┘ └───┘ └───┘ └───┘                 │
└───────────────────────────────────────────┘
```

### 구현 상세

- chat.tsx에서 ChatMessage를 wrapper로 감싸서 메시지 액션 표시
- `MessageActions` 컴포넌트: 복사(Copy), 재생성(RefreshCw), 좋아요(ThumbsUp), 싫어요(ThumbsDown)
- 복사: `navigator.clipboard.writeText(content)` + toast
- 재생성: 마지막 assistant 메시지만 활성화, tRPC로 마지막 메시지 삭제 후 재전송
- 좋아요/싫어요: 우선 UI만 (향후 피드백 수집)
- user 메시지에는 복사만 표시

### 파일 변경
- `apps/app/src/features/agent-desk/pages/chat.tsx` — MessageActions wrapper
- `apps/app/src/features/agent-desk/components/message-actions.tsx` — 신규

---

## 3. 파일 업로드 UX 강화

### 현재 코드
- `hooks/use-file-upload.ts` — 5단계 상태 머신
- `chat.tsx:449-497` — FileArea
- 이미지 페이스트 미지원, 에러 피드백 없음

### 변경

#### 3a. 이미지 클립보드 페이스트
- Textarea에 `onPaste` 이벤트 추가
- `clipboardData.files`에서 이미지 감지
- 자동 업로드 시작

#### 3b. 에러 토스트
- `use-file-upload.ts`에서 잘못된 파일 타입/크기 초과 시 `toast.error()` 호출
- 파싱 실패 시 `toast.warning()` 표시 (현재 silent catch)

#### 3c. 인라인 이미지 썸네일
- FileCard에서 이미지 파일은 작은 썸네일(32x32) 표시
- Supabase Storage URL 또는 local blob URL 활용

#### 3d. 파일 아이콘 확장
- `getFileIcon()` 함수 확장:
  - PPTX: Presentation 아이콘 (주황색)
  - DOCX: FileText 아이콘 (파란색)
  - PDF: FileText 아이콘 (빨간색) — 현재 유지
  - 이미지: ImageIcon — 현재 유지
  - 기타: File 아이콘 — 현재 유지

### 파일 변경
- `apps/app/src/features/agent-desk/pages/chat.tsx` — onPaste, FileCard 썸네일, getFileIcon 확장
- `apps/app/src/features/agent-desk/hooks/use-file-upload.ts` — 에러 토스트 추가

---

## 4. 입력 영역 고도화

### 현재 코드
- `chat.tsx:305-313` — Textarea min-h-44px max-h-120px
- Enter 전송, Shift+Enter 줄바꿈

### 변경

#### 4a. 자동 높이 조절
- `useRef`로 textarea DOM 접근
- `onChange` 시 `scrollHeight` 기반 높이 동적 조절
- max-h를 200px로 확장 (현재 120px)

#### 4b. Escape로 생성 중지
- `useEffect`로 document keydown 'Escape' 감지
- isStreaming 시 `abort()` 호출

#### 4c. 입력창 자동 포커스
- 페이지 로드 시 textarea focus
- 메시지 전송 완료 후 textarea focus
- 파일 업로드 완료 후 textarea focus

#### 4d. 입력창 하단 파일 미리보기 통합
- FileArea를 입력창 바로 위로 이동 (현재 메시지 영역과 입력 영역 사이)
- 시각적으로 입력 컴포지터의 일부로 통합

### 파일 변경
- `apps/app/src/features/agent-desk/pages/chat.tsx` — Textarea 개선, Esc 핸들러, 레이아웃 조정

---

## 5. 세션 목록 개선

### 현재 코드
- `session-list.tsx` — Card 그리드, 제목 + 상태 + 생성일만

### 변경

#### 5a. 마지막 메시지 미리보기
- session API 응답에 `lastMessage` 필드 추가 필요 (백엔드)
- 또는 프론트엔드에서 session.messages의 마지막 항목 활용
- 1줄 truncate로 표시

#### 5b. 상대 시간
- `date-fns`의 `formatDistanceToNow` 사용
- "2시간 전", "어제", "3일 전"

#### 5c. 세션 이름 변경
- 제목 더블클릭 또는 편집 아이콘 클릭 시 인라인 Input
- Enter로 저장, Esc로 취소
- tRPC mutation: `updateSession({ id, title })` — 기존 `updateSessionStatus`를 확장하거나 별도 mutation

#### 5d. 검색
- 상단에 Input + Search 아이콘
- 클라이언트 사이드 필터링 (세션 제목 기준)

#### 5e. 시간 그룹핑
- "오늘", "어제", "이번 주", "이전"으로 그룹 분리
- `date-fns` 유틸 활용

### 파일 변경
- `apps/app/src/features/agent-desk/pages/session-list.tsx` — 전면 개선
- 백엔드: `packages/features/agent-desk/` — updateTitle mutation (선택)

---

## 6. 스트리밍/에러 처리 개선

### 현재 Bug
- `use-stream-chat.ts:31-32` — 스트리밍 에러 throw되지만 handleSend에서 catch 안 됨
- `chat.tsx:318` — abort 시 streamingContent 정리 안 됨
- `use-file-upload.ts:44-50` — 잘못된 파일 silent 무시
- `use-file-upload.ts:85-89` — 파싱 실패 silent catch

### 변경

#### 6a. abort 시 partial 메시지 정리
- `abort()` 호출 시 `setStreamingContent("")` 추가
- 또는 abort 후 partial 내용을 "(중단됨)" 표시와 함께 메시지 목록에 추가

#### 6b. 스트리밍 에러 처리
- `handleSend`에 `try/catch` 추가
- catch에서 `toast.error("메시지 전송에 실패했습니다. 다시 시도해주세요.")` 표시
- optimisticUserMessage도 정리

#### 6c. 파일 에러 피드백
- 잘못된 타입: `toast.error("지원하지 않는 파일 형식입니다: .xxx")`
- 크기 초과: `toast.error("파일 크기가 50MB를 초과합니다.")`
- 파싱 실패: `toast.warning("파일 파싱에 실패했습니다. 텍스트 추출 없이 계속됩니다.")`

### 파일 변경
- `apps/app/src/features/agent-desk/hooks/use-stream-chat.ts` — 에러 핸들링
- `apps/app/src/features/agent-desk/pages/chat.tsx` — handleSend catch, abort 정리
- `apps/app/src/features/agent-desk/hooks/use-file-upload.ts` — toast 에러

---

## 7. 시각적 폴리시

### 변경

#### 7a. 파이프라인 패널 위치 조정
- 현재: 메시지 목록 하단에 인라인
- 개선: 메시지 스크롤 영역 하단에 sticky 또는 별도 영역

#### 7b. 모바일 파일 영역 터치 스크롤
- FileArea에 `-webkit-overflow-scrolling: touch` + `scroll-behavior: smooth`
- `scrollbar-hide` 클래스로 모바일에서 스크롤바 숨기기

#### 7c. 모델 셀렉터 시각적 개선
- 현재: 작고 투명한 Select
- 개선: 입력 영역 좌측 상단에 Badge 스타일로 표시, 클릭 시 드롭다운

#### 7d. 전송 버튼 시각적 피드백
- isStreaming 시: Stop 버튼에 pulse 애니메이션 추가
- 전송 가능 시: Send 버튼 primary 색상 강조
- 전송 불가 시: Send 버튼 muted

### 파일 변경
- `apps/app/src/features/agent-desk/pages/chat.tsx` — UI 폴리시
- `apps/app/src/features/agent-desk/components/pipeline-panel.tsx` — 위치/스타일

---

## 재사용 가능한 @repo/ui 컴포넌트

| 컴포넌트 | 사용처 |
|----------|--------|
| `ChatMessage` | 메시지 표시 (이미 사용 중) |
| `Card` | 추천 프롬프트 카드, 세션 목록 |
| `Button`, `Tooltip` | 메시지 액션 |
| `Input` | 세션 검색, 이름 변경 |
| `Badge` | 모델 셀렉터, 파일 상태 |
| `Sheet` | 파일 미리보기 (이미 사용 중) |
| `Select` | 모델 선택 (이미 사용 중) |
| `Skeleton` | 로딩 상태 |

---

## 백엔드 변경 (최소)

| 항목 | 필요 여부 | 설명 |
|------|----------|------|
| 세션 제목 변경 API | 필요 | `updateSession` mutation에 title 업데이트 추가 |
| 메시지 재생성 | 필요 | 마지막 assistant 메시지 삭제 + 재전송 또는 regenerate 전용 endpoint |
| 세션 목록 lastMessage | 선택 | API 응답에 마지막 메시지 포함 (또는 프론트엔드에서 처리) |

---

## 작업 순서 (의존성 기반)

1. **스트리밍/에러 처리 개선** (6) — 기반 품질, 다른 작업 전에 수정
2. **입력 영역 고도화** (4) — 핵심 인터랙션 개선
3. **빈 화면 추천 프롬프트** (1) — 첫인상 개선
4. **파일 업로드 UX 강화** (3) — 핵심 기능 개선
5. **메시지 액션** (2) — 상품성 핵심
6. **세션 목록 개선** (5) — 네비게이션 개선
7. **시각적 폴리시** (7) — 마무리
