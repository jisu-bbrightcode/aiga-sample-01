# Flow Designer (화면 흐름 위자드) 설계

> 에이전트 데스크 하위 메뉴로, 모바일/데스크탑 웹앱의 화면 흐름을 정의하고 화면정의서 초안을 생성하는 기능.

---

## 1. 개요

### 목적

운영자가 AI 에이전트와 대화하며 웹앱의 화면 흐름(screen flow)을 정의하는 위자드. 완료 시 화면 목록, 순서, 연결 관계, 화면별 설명이 포함된 화면정의서 초안이 생성되며, 이는 추후 에이전트 데스크 파이프라인(분석 → 스펙 → 실행)의 입력으로 활용된다.

### 접근 방식

기존 에이전트 데스크의 세션 타입을 확장하여 `"designer"` 타입을 추가. 채팅(SSE 스트리밍), 파일 업로드, 메시지 시스템 등 기존 인프라를 재활용하고, 3칸 분할 레이아웃 UI만 신규 구현한다.

---

## 2. 데이터 모델

### 2.1 세션 타입 확장

기존 `agent_desk_session_type` enum에 `"designer"` 추가:

```
"customer" | "operator" | "designer"
```

### 2.2 세션 상태 확장

기존 상태에 `"designing"` 추가:

```
"uploading" | "parsing" | "designing" | "analyzing" | "analyzed" | ...
```

- `designing`: 화면 정의 진행 중 (designer 세션 전용)

### 2.3 세션 테이블 컬럼 추가 (`agentDeskSessions`)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `platform` | `varchar(20)` | `"mobile"` \| `"desktop"` (designer만 사용) |
| `designTheme` | `text` | 디자인 테마/스타일 텍스트 (designer만 사용) |
| `flowData` | `jsonb` | 화면 흐름 전체 데이터 |

### 2.4 flowData JSONB 구조

```typescript
interface FlowData {
  screens: FlowScreen[];
  currentScreenIndex: number;
}

interface FlowScreen {
  id: string;                      // UUID
  name: string;                    // 화면 이름 (예: "로그인")
  order: number;                   // 순서
  description: string;             // AI 대화로 수집된 화면 설명
  wireframeType: string;           // 와이어프레임 레이아웃 타입
  wireframeMermaid: string;        // Mermaid 와이어프레임
  nextScreenIds: string[];         // 다음 화면 ID 목록
  metadata: Record<string, any>;   // AI가 수집한 상세 정보
}
```

### 2.5 기존 테이블 재활용

- `agentDeskMessages`: 그대로 사용 (화면별 AI 대화 저장)
- `agentDeskFiles`: 그대로 사용 (참고 자료 업로드)

---

## 3. UI 레이아웃

### 3.1 진입 경로

에이전트 데스크 세션 목록(`/agent-desk`) → 새 세션 생성 → 타입 `"designer"` 선택 → `/agent-desk/designer/$sessionId`

### 3.2 3칸 분할 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  Header: [← 뒤로] 프로젝트명  [모바일▾] [테마: ...]     │
├──────────┬──────────────────┬────────────────────────────┤
│ Flow     │  Wireframe       │  AI Chat                   │
│ Panel    │  Preview         │                            │
│ (≈20%)   │  (≈35%)          │  (≈45%)                    │
│          │                  │                            │
│ ○ 홈     │  ┌────────┐     │  AI: 이 화면의 주요        │
│ │        │  │ Header │     │  기능은 무엇인가요?        │
│ ● 로그인 │  ├────────┤     │                            │
│ │        │  │        │     │  User: 이메일/비밀번호     │
│ ○ 대시보드│  │ Form   │     │  로그인입니다              │
│          │  │        │     │                            │
│          │  └────────┘     │  AI: 소셜 로그인도         │
│          │                  │  포함하나요?               │
│          │                  │                            │
│          │                  │  [파일첨부] [입력창]       │
├──────────┴──────────────────┴────────────────────────────┤
│  Footer: [이전] [다음 화면 추가]              [완료]     │
└─────────────────────────────────────────────────────────┘
```

### 3.3 헤더 영역

- 뒤로가기: 세션 목록으로 복귀
- 프로젝트명: 세션 제목 (편집 가능)
- 플랫폼 선택: 드롭다운 (`모바일` / `데스크탑`) — 언제든 변경 가능
- 디자인 테마: 텍스트 입력

### 3.4 Flow Panel (좌측, ≈20%)

- Mermaid flowchart로 전체 화면 흐름 표시
- `flowData.screens` + `nextScreenIds` 기반 자동 생성
- 각 노드 클릭 → 해당 화면으로 이동
- 현재 화면 노드 강조 표시 (fill color 변경)

### 3.5 Wireframe Preview (중앙, ≈35%)

- 현재 선택된 화면의 와이어프레임 (Mermaid 다이어그램)
- AI 대화 진행에 따라 업데이트
- 플랫폼에 따라 모바일/데스크탑 프레임 표시

### 3.6 AI Chat (우측, ≈45%)

- 기존 에이전트 데스크 채팅 컴포넌트 재활용
- 화면 전환 시 AI가 해당 화면 컨텍스트로 전환하여 가이드 질문 자동 생성
- 파일 업로드 지원 (참고 이미지, 디자인 등)

### 3.7 Footer 영역

- 이전: 이전 화면으로 이동
- 다음 화면 추가: 새 화면 노드 추가 + AI 대화 시작
- 완료: 전체 flowData 저장 → 화면정의서 초안 생성

---

## 4. AI 대화 설계

### 4.1 시스템 프롬프트

designer 세션 전용 시스템 프롬프트로, AI가 화면별로 수집할 항목:

1. 화면 이름 및 목적
2. 주요 UI 요소 (헤더, 폼, 리스트, 버튼 등)
3. 사용자 인터랙션 (클릭, 입력, 스크롤 등)
4. 다음 화면 연결 (분기 조건 포함)
5. 에러/예외 상태

### 4.2 화면 전환 시 컨텍스트 주입

화면 전환 시 AI에게 제공하는 컨텍스트:

1. 전체 flowData (이전 화면들의 설명 요약)
2. 현재 화면 인덱스 + 이름
3. 플랫폼/테마 설정

AI는 이전 화면과의 연관성을 이해하고 일관된 질문을 제시한다.

### 4.3 와이어프레임 자동 생성

AI 대화에서 수집된 화면 설명을 기반으로 Mermaid 와이어프레임 자동 생성. 기존 `diagram-generator.service.ts` 패턴을 확장.

### 4.4 하이브리드 대화 모드

단일 대화 스레드에서 모든 화면을 다루되, 화면 전환 시 AI가 해당 화면 컨텍스트로 전환:

```
[화면 1: 홈]
AI: "첫 번째 화면을 정의합니다. 화면 이름과 목적을 알려주세요."
User: "홈 화면입니다. 메인 배너와 추천 상품 목록이 있습니다."
AI: "배너에 슬라이드 기능이 필요한가요?"
...

[다음 화면 추가]
AI: "두 번째 화면을 정의합니다. 홈 화면에서 어디로 이동하나요?"
User: "상품 상세 페이지입니다."
...
```

---

## 5. 완료 시 산출물

### 5.1 저장 데이터

```typescript
interface FlowDesignResult {
  platform: "mobile" | "desktop";
  designTheme: string;
  screens: FlowScreen[];
  flowchartMermaid: string;         // 자동 생성: 전체 플로우차트
  screenDefinitionDraft: string;    // 자동 생성: 화면정의서 초안 (Markdown)
}
```

### 5.2 화면정의서 초안 형식

Markdown 테이블로 각 화면 정리:

```markdown
# 화면정의서 초안

## 프로젝트 정보
- 플랫폼: 모바일
- 디자인 테마: 미니멀, 화이트 배경

## 화면 흐름
(Mermaid flowchart)

## 화면 목록

### 1. 홈 (home)
- **목적**: 메인 진입점, 추천 콘텐츠 표시
- **UI 요소**: 배너 슬라이더, 추천 상품 그리드, 하단 네비게이션
- **인터랙션**: 배너 스와이프, 상품 클릭 → 상세
- **다음 화면**: 상품 상세, 카테고리, 마이페이지
- **와이어프레임**: (Mermaid)

### 2. 상품 상세 (product-detail)
...
```

### 5.3 세션 상태 전이

```
uploading (초기)
  ↓ [자동] 첫 화면 생성
designing (화면 정의 진행 중)
  ↓ [완료 클릭]
analyzed (화면정의서 초안 생성 완료)
  ↓ [이후 파이프라인 연결 시]
spec_generated → executing → executed
```

---

## 6. 아키텍처

### 6.1 재활용 모듈

| 기존 모듈 | 재활용 방식 |
|-----------|------------|
| `useStreamChat` | AI 대화 SSE 스트리밍 |
| `useFileUpload` | 파일 업로드 |
| `session.service.ts` | 세션 CRUD (타입 필터링 추가) |
| `chat.service.ts` | 채팅 메시지 처리 |
| `diagram-generator.service.ts` | Mermaid 생성 확장 |
| `agentDeskSessions` | 컬럼 추가 |
| `agentDeskMessages` | 그대로 사용 |
| `agentDeskFiles` | 그대로 사용 |

### 6.2 신규 구현

| 항목 | 파일 | 설명 |
|------|------|------|
| 라우트 | `routes/agent-desk-designer-page.tsx` | 진입 라우트 |
| 페이지 | `pages/flow-designer.tsx` | 3칸 레이아웃 메인 |
| 컴포넌트 | `components/flow-panel.tsx` | 좌측 플로우차트 |
| 컴포넌트 | `components/wireframe-preview.tsx` | 중앙 와이어프레임 |
| 컴포넌트 | `components/designer-header.tsx` | 헤더 |
| Hook | `hooks/use-flow-designer.ts` | 화면 관리 로직 |
| 서비스 | `service/flow-designer.service.ts` | flowData + 화면정의서 |
| 프롬프트 | `prompts/designer-prompt.ts` | 전용 프롬프트 |
| DB | 마이그레이션 | enum + 컬럼 + 상태 추가 |

### 6.3 파일 구조

```
apps/app/src/features/agent-desk/
├── routes/
│   └── agent-desk-designer-page.tsx   (신규)
├── pages/
│   └── flow-designer.tsx              (신규)
├── components/
│   ├── flow-panel.tsx                 (신규)
│   ├── wireframe-preview.tsx          (신규)
│   └── designer-header.tsx            (신규)
└── hooks/
    └── use-flow-designer.ts           (신규)

packages/features/agent-desk/
├── service/
│   └── flow-designer.service.ts       (신규)
└── prompts/
    └── designer-prompt.ts             (신규)
```

---

## 7. 향후 확장

- 디자인 템플릿 시스템: 텍스트 입력 대신 미리 정의된 디자인 템플릿 선택
- 에이전트 데스크 파이프라인 연결: 화면정의서 → 자동 스펙 생성 → 코드 생성
- 화면 간 드래그앤드롭 순서 변경
- 와이어프레임 상세화: Mermaid → React Flow 또는 .pen 파일 연동
