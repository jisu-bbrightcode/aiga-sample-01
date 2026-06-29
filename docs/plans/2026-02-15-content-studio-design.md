# Content Studio 디자인 문서

> **Feature:** content-studio
> **날짜:** 2026-02-15
> **상태:** 승인 완료

## 목표

React Flow 기반 캔버스 UI로 콘텐츠를 시각적으로 관리하고, AI 에이전트와 마케팅 기능을 통합하여 콘텐츠 생성→작성→배포 전 과정을 하나의 워크플로우로 제공한다.

## 핵심 결정사항

| 항목 | 결정 |
|------|------|
| Feature 전략 | `content-studio` 새 feature 분리 (graph-content과 완전 독립) |
| 노드 종류 | 주제(topic) + 콘텐츠(content) 2종 |
| 뷰 전환 | 캔버스 → 별도 페이지 이동 (`/content-studio/:studioId/:contentId/edit`) |
| 에디터 | Novel 스타일 (TipTap 기반, AI 자동완성 내장) |
| 소셜 배포 | 별도 마케팅 feature 페이지로 연결 |
| AI 통합 | 캔버스 에이전트 노드 + 에디터 AI 자동완성/채팅 |
| 기존 관계 | graph-content과 완전 독립 (새 DB 테이블) |

## 아키텍처: 캔버스 중심 (Canvas-Centric)

Studio 프로젝트 단위로 캔버스를 관리하되, 라우트는 2단계로 유지.

## 라우트 구조

```
/content-studio                                → 스튜디오 목록 (프로젝트 선택)
/content-studio/:studioId                      → 캔버스 뷰 (React Flow 카드 배치)
/content-studio/:studioId/:contentId/edit      → 에디터 뷰 (Novel + AI)
```

### Admin (system-admin)

```
/admin/content-studio                          → 스튜디오 관리 (전체 목록, 통계, 상태)
```

## DB 스키마

패키지: `packages/drizzle/src/schema/features/content-studio/index.ts`

### studio_studios (프로젝트/워크스페이스)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| title | varchar(200) | 스튜디오 제목 |
| description | text | 설명 (선택) |
| ownerId | uuid FK→profiles | 소유자 |
| visibility | enum(public/private) | 공개 여부 |
| createdAt/updatedAt | timestamp | |
| isDeleted/deletedAt | soft delete | |

### studio_topics (주제 노드)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| studioId | uuid FK→studios | 소속 스튜디오 |
| label | varchar(100) | 주제명 |
| color | varchar(20) | 노드 색상 |
| positionX/positionY | real | 캔버스 좌표 |
| createdAt/updatedAt | timestamp | |

### studio_contents (콘텐츠 노드)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| studioId | uuid FK→studios | 소속 스튜디오 |
| topicId | uuid FK→topics | 연결된 주제 (nullable) |
| title | varchar(300) | 콘텐츠 제목 |
| content | text | Novel/TipTap JSON |
| summary | text | 요약 (AI 생성) |
| thumbnailUrl | text | 썸네일 |
| status | enum(draft/writing/review/published/canceled) | 상태 |
| positionX/positionY | real | 캔버스 좌표 |
| viewCount | integer | 조회수 |
| authorId | uuid FK→profiles | 작성자 |
| publishedAt | timestamp | 발행일 |
| createdAt/updatedAt | timestamp | |
| isDeleted/deletedAt | soft delete | |

### studio_content_seo (SEO 이력)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| contentId | uuid FK→contents | 콘텐츠 |
| seoTitle | varchar(200) | SEO 제목 |
| seoDescription | varchar(500) | SEO 설명 |
| seoKeywords | text[] | SEO 키워드 |
| ogImageUrl | text | OG 이미지 |
| pageViews | integer | 해당 시점 페이지뷰 |
| uniqueVisitors | integer | 해당 시점 고유 방문자 |
| avgTimeOnPage | real | 평균 체류 시간(초) |
| bounceRate | real | 이탈률 |
| snapshotAt | timestamp | 스냅샷 시점 |
| createdAt | timestamp | |

### studio_edges (연결선)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| studioId | uuid FK→studios | |
| sourceId | uuid | 출발 노드 |
| sourceType | enum(topic/content) | |
| targetId | uuid | 도착 노드 |
| targetType | enum(topic/content) | |
| createdAt | timestamp | |

## 캔버스 뷰 설계

### 레이아웃

```
┌──────────────────────────────────────────────────────┐
│ PageHeader: "스튜디오 이름"  [+ 새 콘텐츠] [+ 주제]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│   ┌──────┐     ┌──────────────┐                     │
│   │ 주제  │────│ 콘텐츠 카드   │ ← 선택됨            │
│   │키워드 │    └──────────────┘                      │
│   └──────┘          │                                │
│      │        ┌──────────────┐                      │
│      │        │ 🤖 에이전트   │ ← 포커스 에이전트     │
│      │        │ 노드 (UI전용) │    노드               │
│      │        └──────────────┘                      │
│      │                                               │
│      └───────┌──────────────┐                       │
│              │ 콘텐츠 카드   │                       │
│              └──────────────┘                       │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 🤖 전체 명령: "콘텐츠 3개 더 만들어줘"  [전송]  │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 커스텀 노드 타입

**TopicNode (주제):**
- 원형 또는 라운드 뱃지 형태
- 주제 라벨 + 색상
- 더블클릭으로 이름 인라인 편집

**ContentCard (콘텐츠):**
- n8n 스타일 카드 UI
- 제목, 상태 뱃지(draft/published 등), 조회수, 댓글수
- 작성자 아바타, 날짜
- 클릭 → 에디터 페이지 이동
- 우클릭 → 컨텍스트 메뉴 (편집, 삭제, 복제, 배포)

**AgentNode (에이전트 — UI 전용, DB 미저장):**
- 선택된 노드(topic/content) 아래에 엣지로 연결되어 등장
- 프롬프트 입력 + 전송 버튼
- 주제 선택 시: 주제 기반 콘텐츠 생성 프롬프트
- 콘텐츠 선택 시: 수정/요약/확장 프롬프트
- 노드 선택 해제 시 사라짐

### 에이전트 2가지 모드

1. **포커스 에이전트 노드**: 노드 선택 시 해당 노드에 집중된 AI 명령
2. **글로벌 에이전트 툴바**: 하단 고정, 스튜디오 전체 대상 AI 명령

### 캔버스 인터랙션

- 드래그로 카드 위치 변경 (positionX/Y 저장)
- 주제↔콘텐츠 간 엣지 드래그로 연결
- 빈 캔버스일 때: Figma 시작 화면 디자인 (AI 프롬프트 + "콘텐츠 작성하기" 버튼)

## 에디터 뷰 설계

### 레이아웃

```
┌──────────────────────────────────────────────────────┐
│ ← 캔버스로 돌아가기  │  상태: draft ▾  │ [배포하기]  │
├────────────────────────────┬─────────────────────────┤
│                            │ 메타 정보 패널          │
│   Novel 에디터             │                         │
│                            │ • 제목                  │
│   # 콘텐츠 제목            │ • 요약                  │
│                            │ • 썸네일                │
│   본문 내용...             │ • SEO 설정              │
│                            │ • 상태 변경             │
│   (스페이스/슬래시 → AI)   │ • 주제 연결             │
│                            │                         │
│   🤖 AI 채팅 (인라인)      │ [마케팅 배포 →]         │
│                            │                         │
└────────────────────────────┴─────────────────────────┘
```

### 기능

- Novel 기반 블록 에디터 (TipTap 코어)
- 스페이스 키 또는 `/` 슬래시 커맨드로 AI 자동완성
- 우측 메타 패널: SEO 이력, 썸네일, 상태, 주제 연결
- "배포하기" 버튼 → 마케팅 feature 페이지로 이동

## 마케팅 연동

```
콘텐츠 에디터 → [배포하기] → 마케팅 feature 페이지
                              ↓
                        marketing_contents 테이블
                        sourceType: 'content_studio'
                        sourceId: studio_contents.id
```

- 기존 marketing feature의 `ContentAdapter` 패턴 활용
- `sourceType` enum에 `'content_studio'` 추가
- content-studio에서는 "배포하기" 버튼으로 마케팅 페이지 링크만 제공

## AI 에이전트 통합

### 캔버스 에이전트

- 기존 agent-server SSE 스트리밍 활용 (`POST /api/chat/stream`)
- 포커스 에이전트: 선택 노드 컨텍스트를 프롬프트에 포함
- 글로벌 에이전트: 스튜디오 전체 컨텍스트를 프롬프트에 포함
- AI 콘텐츠 생성 완료 → 자동으로 콘텐츠 노드 추가

### 에디터 AI

- Novel의 AI 자동완성 패턴 활용 (스페이스/슬래시 트리거)
- agent-server SSE 스트리밍으로 인라인 텍스트 생성
- 선택 텍스트 기반 수정/확장/요약 기능

## 전체 데이터 흐름

```
1. 스튜디오 생성 → studio_studios
2. 주제 추가 → studio_topics (캔버스에 노드 배치)
3. 콘텐츠 생성 (수동 or AI) → studio_contents
4. 에디터에서 작성/수정 → studio_contents.content 업데이트
5. SEO 설정 변경 → studio_content_seo에 히스토리 추가
6. 배포 → 마케팅 feature로 이동 (sourceType: content_studio)
7. 소셜 미디어 발행 → 마케팅 feature가 처리
```

## Figma 참조

- `51-16440`: 시작 화면 (빈 캔버스 + AI 프롬프트)
- `52-2881`: 콘텐츠 에디터 (Notion 스타일 + 배포준비 패널)
- `52-5910`: 소셜 배포 (Instagram/Thread/Facebook 프리뷰)
- `51-12566`: 카드 캔버스 (콘텐츠 카드 + 키워드 노드 + 컨텍스트 메뉴)

## 기술 스택

- **캔버스**: React Flow (`@xyflow/react`)
- **에디터**: Novel (TipTap 기반)
- **상태 관리**: Jotai (캔버스 UI 상태)
- **AI 스트리밍**: agent-server SSE
- **DB**: Drizzle ORM (5 테이블)
- **마케팅 연동**: 기존 ContentAdapter 패턴
