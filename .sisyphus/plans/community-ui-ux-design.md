# 커뮤니티 UI/UX 고도화 — 디자인 문서

> **방향**: 프리미엄 포럼 (Discourse/dev.to 스타일) — 콘텐츠 중심, 깔끔한 타이포그래피, 전문성
> **범위**: 프론트엔드 코드 + 백엔드 karma API 1건
> **대상**: `apps/app/src/features/community/`
> **NOTE**: 구현 시 이 파일을 `docs/plans/2026-02-22-community-ui-ux-design.md`로 복사할 것

---

## 에픽 구조

```
E1 피드/카드 리디자인 ──┐
E2 리치 에디터 통합   ──┼──→ E4 Optimistic UI + Animation ──→ E5 카르마 UI
E3 코멘트 UX 개선    ──┘
```

| 에픽 | 이름 | 의존성 |
|------|------|--------|
| E1 | 피드/카드 리디자인 | 없음 |
| E2 | 리치 에디터 통합 | 없음 |
| E3 | 코멘트 UX 개선 | 없음 |
| E4 | Optimistic UI + Animation | E1, E2, E3 |
| E5 | 카르마 UI (백엔드 1건 포함) | E4 |

E1~E3은 병렬 진행 가능.

---

## 가드레일 (전 에픽 공통)

### MUST
- CSS custom properties만으로 테마 전환, 기존 light/dark 역호환
- `prefers-reduced-motion` 존중
- 기존 `@repo/ui/components/editor/` TipTap v3.19 재사용 (새 라이브러리 도입 금지)
- motion v12만 사용 (이미 설치됨). `@formkit/auto-animate` 도입 금지
- plain text content 하위 호환 렌더링 (JSON이면 TipTapViewer, string이면 `<p>`)
- `.claude/rules/design/ui-rules.md` 8가지 원칙 준수

### MUST NOT
- shadcn/ui 소스 직접 수정 (변수 오버라이드만)
- 페이지 전환 애니메이션
- 테마별 컴포넌트 분기
- Admin UI (`apps/system-admin`) 동시 변경
- arbitrary values, card/border 남용, gradient backgrounds, shadow-xl, rounded-3xl

---

## Scope

### INCLUDE
- 커뮤니티 UI 리디자인 (프리미엄 포럼 스타일)
- 리치 텍스트 에디터 도입 (기존 TipTap 재사용)
- 피드/카드 디자인 고도화
- 코멘트 UX 개선
- Optimistic updates + 트랜지션 애니메이션
- 카르마/평판 UI (백엔드 API 1건 포함)
- 프론트엔드 코드 (`apps/app/src/features/community/`)

### EXCLUDE
- ~~테마 시스템 확장 (4-6개 프리셋)~~ — 추후 별도 진행
- ~~`.dark` → `[data-theme]` 전환~~ — 추후 별도 진행
- DB 스키마 변경
- WebSocket/실시간 기능
- 온보딩 플로우
- 검색 강화
- 모바일 전용 최적화
- Admin UI 변경

---

## E1: 피드/카드 리디자인

### 현재 문제
- PostCard: Reddit 클론 (좌측 vote 컬럼 + 우측 콘텐츠), Card 컴포넌트에 감싸져 카드 남용
- CommunityCard: 기본 shadcn Card, 정보 밀도 낮음
- HomeFeed: 단순 스크롤 리스트, 콘텐츠 타입 구분 없음

### 핵심 전환: Card 박스 → 콘텐츠 행(row) 기반

### PostCard 리디자인

```
Before:
┌─────────────────────────────────┐
│ ▲  Title here                   │
│ 5  Posted by u/name • 2h        │
│ ▼  Some preview text...         │
│    [Comments 12] [Share] [Save] │
└─────────────────────────────────┘

After:
──────────────────────────────────────
Title here that can be longer
u/displayname · community-name · 2h ago

Preview text that shows first 2-3 lines
of content with proper typography...

🔗 link-domain.com          ← link 타입
🖼️ [image thumbnail]        ← image 타입

▲ 5 ▼   💬 12   ⬡ Share   ⬡ Save
──────────────────────────────────────
```

| 요소 | 변경 |
|------|------|
| 레이아웃 | 좌측 vote 컬럼 제거 → 하단 액션 바로 vote 이동 (인라인) |
| 타이틀 | `text-lg font-semibold` — 콘텐츠 자체가 시각적 경계 |
| 메타 정보 | 작성자 · 커뮤니티 · 시간 한 줄. `text-muted-foreground text-sm` |
| 콘텐츠 미리보기 | 2-3줄 line-clamp. 타입별 표시 (link→도메인, image→썸네일, poll→투표 현황) |
| 구분선 | Card border → `border-b border-border` (Discourse 패턴) |
| 액션 바 | 하단 한 줄: vote 인라인 + 댓글 수 + share + save. ghost 스타일 |
| hover | `bg-muted/50` 배경 전환. `transition-colors` |

### CommunityCard 리디자인

```
┌─ 아바타 ─┐
│  🏛️      │  community-name         ← font-medium
│          │  1,234 members · 45 online   ← text-sm muted
└──────────┘  A short description...  ← text-sm, line-clamp-1
              [Join]                  ← size="sm" variant="outline" → 가입 시 ghost "Joined ✓"
```

가로 배치 (아바타 좌 | 정보 우). 컴팩트.

### HomeFeed 레이아웃

```
┌─────────────────────────────────────────┐
│  Home Feed                              │
│                                         │
│  [Hot] [New] [Top] [Rising]  ← 인라인 탭 (드롭다운 대체)
│                                         │
│  ─── PostCard row ──────────────────    │
│  ─── PostCard row ──────────────────    │
│  ─── PostCard row ──────────────────    │
│                                         │
│  Sidebar (lg+):                         │
│  ┌ Trending Communities ─────────┐      │
│  │ CommunityCard compact × 3    │      │
│  └───────────────────────────────┘      │
└─────────────────────────────────────────┘
```

- SortDropdown → 인라인 탭: `Hot | New | Top | Rising`
- 2컬럼 (lg+): 좌측 피드 + 우측 사이드바
- 빈 상태/로딩: 기존 패턴 유지, 행 기반으로 맞춤

### CommunityHome 레이아웃

- 커뮤니티 헤더: 배너 + 아바타 + 이름 + 설명 + 멤버 수 + Join 버튼 → 깔끔한 정보 계층
- 포스트 리스트: PostCard 리디자인 적용
- 사이드바: 커뮤니티 규칙, 모더레이터, 관련 커뮤니티

---

## E2: 리치 에디터 통합

### 현재 상태
- PostSubmitForm, CommentItem: `<Textarea>` (plain text)
- DB `post.content`: plain text string
- 기존 TipTap 에디터: `@repo/ui/components/editor/` (TipTapEditor + TipTapViewer, StarterKit, Image, CodeBlockLowlight, CharacterCount)

### 적용 대상

| 화면 | 현재 | 변경 |
|------|------|------|
| PostSubmitForm | `<Textarea>` | `<TipTapEditor>` (전체 툴바) |
| CommentItem 답글 | `<Textarea>` | `<TipTapEditor>` (미니 툴바) |
| PostDetail 본문 | `<p>{content}</p>` | `<TipTapViewer>` 또는 `<p>` (하위 호환) |
| PostCard 미리보기 | plain text truncate | rich → plain text 추출 후 truncate |

### 콘텐츠 저장/렌더링 (프론트엔드만)

```
저장: TipTap JSON → JSON.stringify() → post.content (string)
렌더링:
  1. JSON.parse(content) 시도
  2. 성공 → <TipTapViewer content={parsed} />
  3. 실패 (plain text) → <p>{content}</p>
```

기존 plain text 게시물 100% 호환. 백엔드 스키마 변경 없음.

### 에디터 툴바

**포스트 (풀 툴바)**:
```
B  I  S  ~  Code  H1  H2  •  1.  ""  ─  🖼️  🔗  </>
```

**댓글 (미니 툴바)**:
```
B  I  Code  🔗  </>
```

### PostCard 미리보기 텍스트 추출

```typescript
function extractPlainText(content: string): string {
  try {
    const json = JSON.parse(content)
    return extractTextFromNodes(json.content).slice(0, 200)
  } catch {
    return content.slice(0, 200)
  }
}
```

---

## E3: 코멘트 UX 개선

### 현재 상태
- CommentItem (187줄): 쓰레드 중첩, 깊이별 6색 좌측 보더
- 접기/펼치기 없음
- 답글: 인라인 Textarea 토글

### 쓰레드 구조 개선

```
Before:
│🟦 Comment A               ← 6색 cycling border
│  │🟩 Reply B
│  │  │🟧 Reply C
│  │  │  │🟪 Reply D         ← 무한 중첩

After:
Comment A                    ← depth 0
  ├─ Reply B                 ← 단일색 border-l border-border
  │   └─ Reply C
  │       └─ Reply D (접힘)  ← depth 3+ 자동 접기
  └─ Reply E
```

| 요소 | 현재 | 변경 |
|------|------|------|
| 깊이 표시 | 6색 cycling border | 단일색 `border-l border-border` 연결선 |
| 들여쓰기 | 무한 중첩 | 최대 4단계, 이후 flat + "replying to @user" |
| 접기 | 없음 | depth 3+ 자동 접기 + "N replies 더 보기" 토글 |
| 답글 작성 | Textarea 토글 | TipTap 미니 에디터 + expand 트랜지션 |

### CommentItem 레이아웃

```
┌─ 아바타 ─┐
│  👤      │  username · 2h ago
└──────────┘
              Comment content (TipTapViewer or <p>)

              ▲ 3 ▼  · Reply · ···

              ┌─────────────────────────┐
              │ 답글 에디터 (expanded)    │
              │ [Cancel]  [Reply]        │
              └─────────────────────────┘
```

### 답글 플로우
1. Reply 클릭 → MotionPreset fade+slide로 에디터 열림
2. 작성 중 → 에디터 포커스 자동, Escape로 취소
3. Reply 제출 → Optimistic insert (E4) + 에디터 닫힘
4. Cancel → 내용 있으면 확인 대화상자

### 깊은 쓰레드 처리
- depth 0-2: 정상 들여쓰기
- depth 3: 자동 접힘, "[N replies]" 클릭 펼치기
- depth 4+: 들여쓰기 중단, flat + "↩ replying to @username" 라벨

---

## E4: Optimistic UI + Animation

### 현재 상태
- useVote(): `onSuccess`에서 `setQueryData` (서버 응답 후 갱신, 진짜 optimistic 아님)
- 게시물/댓글 작성: `invalidateQueries` (전체 리페치)
- 애니메이션: `transition-colors` 외 없음
- 참조: `content-studio/hooks/use-content-mutations.ts` optimistic 패턴
- motion v12 + MotionPreset 이미 설치됨

### Optimistic UI

#### useVote() 전환

```
현재: click → API → 성공 → setQueryData (0.3-1초 지연)
변경: click → 즉시 UI 반영 → API → 실패 시 rollback
```

```typescript
onMutate: async (variables) => {
  await queryClient.cancelQueries({ queryKey })
  const previous = queryClient.getQueryData(queryKey)
  queryClient.setQueryData(queryKey, optimisticUpdate)
  return { previous }
}
onError: (err, variables, context) => {
  queryClient.setQueryData(queryKey, context.previous)
}
onSettled: () => queryClient.invalidateQueries({ queryKey })
```

#### 게시물/댓글 Optimistic

| 액션 | 현재 | 변경 |
|------|------|------|
| 포스트 작성 | invalidate → 리페치 | 피드 상단 즉시 삽입 + `opacity-70` 임시 → 성공 시 정상화 |
| 댓글 작성 | invalidate → 리페치 | 쓰레드에 즉시 삽입 + 임시 → 성공 시 정상화 |
| 댓글 삭제 | invalidate → 리페치 | 즉시 fade-out → 실패 시 복원 |

InfiniteQuery: 새 포스트는 `pages[0].items` 앞에 삽입.

### Animation

`prefers-reduced-motion` 존중. 비활성화 시 즉시 전환.

| 위치 | 애니메이션 | 구현 |
|------|-----------|------|
| Vote 버튼 | 숫자 slide-up | MotionPreset variant="slide" |
| Vote 실패 | horizontal shake | `animate={{ x: [0, -4, 4, -2, 2, 0] }}` |
| 새 포스트/댓글 | fade-in + slide-down | MotionPreset variant="fade" |
| 댓글 삭제 | fade-out + collapse | AnimatePresence + exit |
| 답글 에디터 열기/닫기 | height expand/collapse | motion.div layout + AnimatePresence |
| 쓰레드 접기/펼치기 | height collapse/expand | motion.div layout |
| 피드 아이템 진입 | stagger fade-in | MotionPreset inView |
| Sort 탭 전환 | underline slide | layoutId="activeTab" |

**적용하지 않는 것**: 페이지 전환, 스크롤 패럴렉스, 로딩 스피너 (skeleton 유지), 과도한 hover

---

## E5: 카르마 UI

### 백엔드 (1건)

```
tRPC: community.getKarma({ userId, communityId? })
REST: GET /api/community/karma?userId=xxx&communityId=xxx
```

communityId 있으면 해당 커뮤니티, 없으면 전체 합산.
응답: `{ total: number, communities: [{ communityId, slug, karma }] }`

### 표시 위치

#### PostCard / CommentItem — 작성자 옆
```
username · 🏅 1,234 · community-name · 2h ago
```

#### 유저 호버카드 (HoverCard)
```
┌─────────────────────────┐
│  👤 username             │
│  🏅 Total Karma: 3,456  │
│                          │
│  Top Communities:        │
│  · community-a: 1,200   │
│  · community-b: 890     │
│  · community-c: 456     │
└─────────────────────────┘
```

유저 이름 hover 시 shadcn HoverCard로 표시.

### 레벨 배지

| 카르마 | 레벨 | 표시 |
|--------|------|------|
| 0-99 | — | 숫자만 |
| 100-499 | Contributor | 🟢 + 숫자 |
| 500-1999 | Helper | 🔵 + 숫자 |
| 2000-4999 | Guide | 🟣 + 숫자 |
| 5000+ | Leader | 🟡 + 숫자 |

프론트엔드에서 범위 분기 (백엔드 로직 불필요).

### 성능
- 현재 보이는 유저 unique authorId 모아서 배치 1회 호출
- `staleTime: 5min` 캐싱

---

## 기술 참조

| 파일 | 역할 |
|------|------|
| `apps/app/src/features/community/components/post-card.tsx` | PostCard 리디자인 대상 |
| `apps/app/src/features/community/components/community-card.tsx` | CommunityCard 리디자인 대상 |
| `apps/app/src/features/community/components/comment-item.tsx` | CommentItem 리디자인 대상 |
| `apps/app/src/features/community/components/vote-buttons.tsx` | Vote 버튼 optimistic 전환 대상 |
| `apps/app/src/features/community/components/sort-dropdown.tsx` | 인라인 탭으로 교체 대상 |
| `apps/app/src/features/community/pages/home-feed.tsx` | HomeFeed 2컬럼 레이아웃 전환 |
| `apps/app/src/features/community/pages/community-home.tsx` | CommunityHome 레이아웃 개선 |
| `apps/app/src/features/community/pages/post-detail.tsx` | TipTapViewer 적용 |
| `apps/app/src/features/community/pages/post-submit-form.tsx` | TipTapEditor 적용 |
| `apps/app/src/features/community/hooks/` | Optimistic 전환 대상 |
| `@repo/ui/components/editor/` | TipTap 에디터 재사용 |
| `packages/ui/src/components/ui/motion-preset.tsx` | MotionPreset 재사용 |
| `apps/app/src/features/content-studio/hooks/use-content-mutations.ts` | Optimistic 참조 패턴 |
| `packages/core/theme/` | 테마 시스템 (현재 유지) |
