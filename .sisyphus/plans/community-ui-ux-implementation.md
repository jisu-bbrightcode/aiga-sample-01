# 커뮤니티 UI/UX 고도화 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **NOTE**: 구현 시 이 파일을 `docs/plans/2026-02-22-community-ui-ux.md`로 복사할 것

**Goal:** 커뮤니티 feature를 프리미엄 포럼 스타일로 전면 리디자인 — 피드/카드, 리치 에디터, 코멘트, Optimistic UI, 카르마

**Architecture:** 기존 `apps/app/src/features/community/` 컴포넌트를 in-place 리디자인. Card 박스 → 행 기반 레이아웃 전환, 기존 `@repo/ui` TipTap 에디터 재사용, motion v12 MotionPreset 활용, TanStack Query optimistic 패턴 적용. 백엔드는 karma API 1건만 추가.

**Tech Stack:** React, TanStack Router, TanStack Query, Tailwind CSS 4, shadcn/ui, TipTap v3.19, motion v12, Drizzle ORM (karma API만), tRPC + NestJS REST

**Design Doc:** `.sisyphus/plans/community-ui-ux-design.md`

**Rules to follow:**
- `.claude/rules/design/ui-rules.md` — 8가지 UI 원칙
- `.claude/rules/backend/naming-dto.md` — 네이밍 규칙
- `.claude/rules/backend/api-strategy.md` — tRPC + REST 쌍 (karma API)

---

## Epic Dependency Graph

```
Wave 1 (병렬): E1, E2, E3
Wave 2 (E1-3 완료 후): E4
Wave 3 (E4 완료 후): E5
```

---

## E1: 피드/카드 리디자인
### Task 1: PostCard 리디자인 — 행 기반 레이아웃

**Files:**
- Modify: `apps/app/src/features/community/components/post-card.tsx`
- Reference: `.claude/rules/design/ui-rules.md` (spacing, typography 규칙)

**Step 1: Card 래퍼 제거 + 행 레이아웃 전환**

현재 `<Card>` 컴포넌트 래퍼를 제거하고 `<article>` + `border-b border-border`로 전환.
- 좌측 vote 컬럼 제거 (vote는 Task 2에서 하단 이동)
- 타이틀: `text-lg font-semibold`
- 메타 라인: `작성자 · 커뮤니티 · 시간` 한 줄, `text-sm text-muted-foreground`
- 콘텐츠 미리보기: `line-clamp-3`
- 포스트 타입별 표시: link→도메인 추출, image→썸네일, poll→투표 현황
- hover: `bg-muted/50 transition-colors`
- 클릭: 전체 영역 `<Link>` (기존 동작 유지)

**Step 2: 포스트 타입별 프리뷰 컴포넌트**

`post.type`에 따른 프리뷰 렌더링:
- `text`: content 미리보기 (line-clamp-3)
- `link`: 링크 도메인 표시 (`new URL(url).hostname`)
- `image`: 이미지 썸네일 (`aspect-video object-cover rounded-md`)
- `video`: 비디오 썸네일 (이미지와 동일 패턴)
- `poll`: 투표 옵션 미리보기 (첫 3개 옵션 + 총 투표수)

**Step 3: dev server에서 확인**

Run: `pnpm dev` → `/communities` 또는 `/home` 에서 PostCard 확인
Expected: Card 박스 없이 구분선 기반 행 레이아웃, hover 시 배경 변경

**Step 4: Commit**

```bash
git add apps/app/src/features/community/components/post-card.tsx
git commit -m "feat(community): redesign PostCard to row-based layout"
```

---

### Task 2: Vote 버튼 인라인 액션 바

**Files:**
- Modify: `apps/app/src/features/community/components/vote-buttons.tsx`
- Modify: `apps/app/src/features/community/components/post-card.tsx` (액션 바 통합)

**Step 1: VoteButtons 가로 인라인 변환**

현재 세로 레이아웃(`flex-col`)을 가로(`flex-row items-center gap-1`)로 전환.
- `▲ [count] ▼` 가로 배치
- 버튼: `variant="ghost" size="sm"` 유지
- 숫자: `text-sm font-medium`

**Step 2: PostCard 하단 액션 바 구성**

PostCard 하단에 액션 바 추가:
```
▲ 5 ▼  ·  💬 12 Comments  ·  Share  ·  Save
```
- `flex items-center gap-4 text-sm text-muted-foreground`
- VoteButtons (인라인) + 댓글 수 + Share + Save
- 각 버튼: `variant="ghost" size="sm"`

**Step 3: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/components/vote-buttons.tsx
git add apps/app/src/features/community/components/post-card.tsx
git commit -m "feat(community): move vote buttons to inline action bar"
```

---

### Task 3: CommunityCard 리디자인

**Files:**
- Modify: `apps/app/src/features/community/components/community-card.tsx`

**Step 1: 가로 레이아웃 + 컴팩트화**

- 아바타(좌) + 정보(우) 가로 배치
- community-name: `font-medium`
- 멤버 수: `text-sm text-muted-foreground`
- 설명: `text-sm line-clamp-1`
- Join 버튼: `size="sm" variant="outline"` → 가입 상태 시 `variant="ghost"` + "Joined ✓"

**Step 2: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/components/community-card.tsx
git commit -m "feat(community): redesign CommunityCard to compact horizontal layout"
```

---

### Task 4: SortDropdown → 인라인 탭

**Files:**
- Modify: `apps/app/src/features/community/components/sort-dropdown.tsx`
- Rename to: `apps/app/src/features/community/components/sort-tabs.tsx`

**Step 1: 드롭다운을 인라인 탭으로 교체**

- `Hot | New | Top | Rising` 탭 형태
- 활성 탭: `font-medium text-foreground` + 하단 언더라인
- 비활성: `text-muted-foreground`
- `flex items-center gap-1` 배치
- 기존 `onSortChange` 콜백 인터페이스 유지

**Step 2: import 경로 업데이트**

sort-dropdown을 import하는 모든 파일 업데이트:
- `home-feed.tsx`
- `community-home.tsx`

**Step 3: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/components/
git add apps/app/src/features/community/pages/
git commit -m "feat(community): replace SortDropdown with inline sort tabs"
```

---

### Task 5: HomeFeed 2컬럼 레이아웃

**Files:**
- Modify: `apps/app/src/features/community/pages/home-feed.tsx`

**Step 1: 2컬럼 그리드 적용**

- `lg` 이상: `grid grid-cols-[1fr_300px] gap-8`
- `lg` 미만: 단일 컬럼 (사이드바 숨김)
- 좌측: 기존 피드 (SortTabs + PostCard 리스트 + infinite scroll)
- 우측: Trending Communities 사이드바 (CommunityCard compact × 3-5개)

**Step 2: 사이드바 Trending Communities 컴포넌트**

- 인기 커뮤니티 목록 (기존 API 활용: `community.list` sort by memberCount)
- CommunityCard compact 변형 사용

**Step 3: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/pages/home-feed.tsx
git commit -m "feat(community): add 2-column layout with trending sidebar"
```

---

### Task 6: CommunityHome 레이아웃 개선

**Files:**
- Modify: `apps/app/src/features/community/pages/community-home.tsx`

**Step 1: 커뮤니티 헤더 정보 계층 정리**

- 배너 (있으면 표시)
- 아바타 + 이름 + 설명: 명확한 타이포그래피 계층
- 멤버 수 + Join 버튼: 인라인
- 기존 정보 유지, 레이아웃만 개선

**Step 2: 2컬럼 (lg+) + 사이드바**

- 좌측: SortTabs + PostCard 피드
- 우측: 커뮤니티 규칙, 모더레이터 목록 (기존 데이터 활용)

**Step 3: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/pages/community-home.tsx
git commit -m "feat(community): improve CommunityHome layout with header and sidebar"
```

---

## E2: 리치 에디터 통합
### Task 7: extractPlainText 유틸리티 + 콘텐츠 파싱 헬퍼

**Files:**
- Create: `apps/app/src/features/community/utils/content-helpers.ts`
- Reference: `@repo/ui/components/editor/` (TipTap JSON 구조 확인)

**Step 1: 콘텐츠 파싱 유틸리티 작성**

```typescript
// TipTap JSON → plain text 추출
export function extractPlainText(content: string, maxLength = 200): string {
  try {
    const json = JSON.parse(content)
    return extractTextFromNodes(json.content).slice(0, maxLength)
  } catch {
    return content.slice(0, maxLength)
  }
}

// JSON 여부 판단 (TipTapViewer vs <p> 분기용)
export function isRichContent(content: string): boolean {
  try {
    const json = JSON.parse(content)
    return json.type === 'doc' && Array.isArray(json.content)
  } catch {
    return false
  }
}

// TipTap JSON node에서 text 재귀 추출
function extractTextFromNodes(nodes: any[]): string {
  if (!nodes) return ''
  return nodes.map(node => {
    if (node.text) return node.text
    if (node.content) return extractTextFromNodes(node.content)
    return ''
  }).join(' ').trim()
}
```

**Step 2: Commit**

```bash
git add apps/app/src/features/community/utils/content-helpers.ts
git commit -m "feat(community): add content parsing utilities for rich text"
```

---

### Task 8: PostSubmitForm 에 TipTap 에디터 적용

**Files:**
- Modify: `apps/app/src/features/community/pages/post-submit-form.tsx`
- Reference: `@repo/ui/components/editor/` (TipTapEditor import 방법)

**Step 1: Textarea → TipTapEditor 교체**

- `<Textarea>` 제거, `<TipTapEditor>`로 교체 (풀 툴바)
- 툴바: Bold, Italic, Strikethrough, Code, H1, H2, Bullet, Ordered, Blockquote, Divider, Image, Link, CodeBlock
- form submit 시: `JSON.stringify(editor.getJSON())` → `content` 필드
- 기존 form validation 유지

**Step 2: dev server 확인**

Run: `pnpm dev` → `/c/{slug}/submit` 에서 TipTap 에디터 확인
Expected: 풀 툴바와 함께 리치 텍스트 입력 가능

**Step 3: Commit**

```bash
git add apps/app/src/features/community/pages/post-submit-form.tsx
git commit -m "feat(community): integrate TipTap editor in post submit form"
```

---

### Task 9: PostDetail 콘텐츠 렌더링 (하위 호환)

**Files:**
- Modify: `apps/app/src/features/community/pages/post-detail.tsx`
- Reference: `@repo/ui/components/editor/` (TipTapViewer import)
- Reference: `apps/app/src/features/community/utils/content-helpers.ts`

**Step 1: 콘텐츠 렌더링 분기 적용**

```tsx
// 기존 <p>{post.content}</p> 를 교체:
{isRichContent(post.content)
  ? <TipTapViewer content={JSON.parse(post.content)} />
  : <p className="whitespace-pre-wrap">{post.content}</p>
}
```

- 기존 plain text 게시물: `<p>` 로 렌더링 (하위 호환)
- 새 리치 게시물: `<TipTapViewer>` 로 렌더링

**Step 2: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/pages/post-detail.tsx
git commit -m "feat(community): add rich content rendering with plain text fallback"
```

---

### Task 10: PostCard 리치 콘텐츠 미리보기

**Files:**
- Modify: `apps/app/src/features/community/components/post-card.tsx`
- Reference: `apps/app/src/features/community/utils/content-helpers.ts`

**Step 1: PostCard 콘텐츠 미리보기에 extractPlainText 적용**

- 기존 `post.content.slice()` → `extractPlainText(post.content)` 로 교체
- 리치 콘텐츠에서도 plain text로 추출하여 미리보기 표시

**Step 2: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/components/post-card.tsx
git commit -m "feat(community): use extractPlainText for PostCard preview"
```

---

### Task 11: CommentItem 답글 에디터 (미니 툴바)

**Files:**
- Modify: `apps/app/src/features/community/components/comment-item.tsx`
- Reference: `@repo/ui/components/editor/` (TipTapEditor)

**Step 1: 답글 Textarea → TipTap 미니 에디터**

- 답글 작성 영역의 `<Textarea>` → `<TipTapEditor>` (미니 툴바)
- 미니 툴바: Bold, Italic, Inline Code, Link, CodeBlock 만
- submit 시: `JSON.stringify(editor.getJSON())` → content

**Step 2: 댓글 콘텐츠 렌더링도 하위 호환 적용**

```tsx
{isRichContent(comment.content)
  ? <TipTapViewer content={JSON.parse(comment.content)} />
  : <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
}
```

**Step 3: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/components/comment-item.tsx
git commit -m "feat(community): add TipTap mini editor for comment replies"
```

---

## E3: 코멘트 UX 개선
### Task 12: CommentItem 리디자인 — 단일색 연결선 + 깊이 제한

**Files:**
- Modify: `apps/app/src/features/community/components/comment-item.tsx`

**Step 1: 6색 cycling border → 단일색 연결선**

- 깊이별 6색 보더 제거
- `border-l-2 border-border` 단일색 연결선으로 교체
- 들여쓰기: `ml-6` per depth (최대 4단계)

**Step 2: 최대 들여쓰기 4단계 제한**

- depth 0-3: 정상 들여쓰기 (`ml-${depth * 6}`)
- depth 4+: 들여쓰기 중단, flat 배치 + "↩ replying to @username" 라벨 표시
- `const indent = Math.min(depth, 3)` 로 제한

**Step 3: 아바타 + 메타 레이아웃**

- 아바타(좌) + username · time(우) 가로 배치
- 액션: `▲ N ▼ · Reply · ···` 인라인 (하단)

**Step 4: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/components/comment-item.tsx
git commit -m "feat(community): redesign CommentItem with single-color borders and depth limit"
```

---

### Task 13: 쓰레드 접기/펌치기 기능

**Files:**
- Modify: `apps/app/src/features/community/components/comment-item.tsx`
- Reference: `packages/ui/src/components/ui/motion-preset.tsx` (MotionPreset)

**Step 1: depth 3+ 자동 접기 구현**

- depth 3 이상 댓글: 기본 접힘 상태
- "N replies 더 보기" 버튼 클릭 시 펀치기
- `useState<boolean>(depth >= 3)` 로 초기 상태 관리

**Step 2: height collapse/expand 애니메이션**

- `motion.div` + `AnimatePresence` 로 height 트랜지션
- `prefers-reduced-motion` 시 즉시 토글

**Step 3: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/components/comment-item.tsx
git commit -m "feat(community): add thread collapse/expand for deep comments"
```

---

### Task 14: 답글 플로우 트랜지션

**Files:**
- Modify: `apps/app/src/features/community/components/comment-item.tsx`
- Reference: `packages/ui/src/components/ui/motion-preset.tsx`

**Step 1: 답글 에디터 열기/닫기 애니메이션**

- Reply 버튼 클릭 → `MotionPreset` fade+slide로 에디터 영역 열림
- `AnimatePresence` + `motion.div` 로 height expand/collapse
- Escape 키: 에디터 닫기

**Step 2: Cancel 확인 대화상자**

- Cancel 클릭 시 내용이 있으면 "작성 중인 내용이 사라집니다" 확인
- shadcn `AlertDialog` 사용
- 내용 없으면 바로 닫기

**Step 3: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/components/comment-item.tsx
git commit -m "feat(community): add reply editor transitions and cancel confirmation"
```

---

## E4: Optimistic UI + Animation
### Task 15: useVote() Optimistic 전환

**Files:**
- Modify: `apps/app/src/features/community/hooks/` (투표 관련 hook)
- Reference: `apps/app/src/features/content-studio/hooks/use-content-mutations.ts` (optimistic 참조 패턴)

**Step 1: onMutate + onError rollback 구현**

```typescript
onMutate: async (variables) => {
  await queryClient.cancelQueries({ queryKey })
  const previous = queryClient.getQueryData(queryKey)
  queryClient.setQueryData(queryKey, optimisticUpdate) // 즉시 ±1
  return { previous }
}
onError: (err, variables, context) => {
  queryClient.setQueryData(queryKey, context.previous) // 롤백
}
onSettled: () => queryClient.invalidateQueries({ queryKey })
```

- 현재 `onSuccess`에서 `setQueryData` → `onMutate`로 이동
- InfiniteQuery 의 `pages` 배열 구조 존중

**Step 2: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/hooks/
git commit -m "feat(community): convert useVote to true optimistic updates"
```

---

### Task 16: 게시물/댓글 생성 Optimistic

**Files:**
- Modify: `apps/app/src/features/community/hooks/` (포스트/댓글 생성 hook)

**Step 1: 포스트 생성 optimistic**

- 피드 상단에 즉시 삽입 (`pages[0].items` 앞에 추가)
- 임시 상태: `opacity-70` + `pointer-events-none`
- 성공 시 정상화, 실패 시 제거 + inline 에러 메시지

**Step 2: 댓글 생성/삭제 optimistic**

- 댓글 생성: 쓰레드에 즉시 삽입 + 임시 상태
- 댓글 삭제: 즉시 fade-out + 실패 시 복원

**Step 3: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/hooks/
git commit -m "feat(community): add optimistic post/comment create and delete"
```

---

### Task 17: Vote 버튼 애니메이션

**Files:**
- Modify: `apps/app/src/features/community/components/vote-buttons.tsx`
- Reference: `packages/ui/src/components/ui/motion-preset.tsx`

**Step 1: 숫자 slide-up 트랜지션**

- vote count 변경 시 `MotionPreset` variant="slide" 적용
- `AnimatePresence` + `motion.span` 로 숫자 전환 애니메이션

**Step 2: 실패 시 shake 애니메이션**

- `onError` 시 vote 버튼 영역 subtle horizontal shake
- `animate={{ x: [0, -4, 4, -2, 2, 0] }}` transition 0.4s

**Step 3: `prefers-reduced-motion` 체크**

- `useReducedMotion()` hook 으로 애니메이션 비활성화
- reduced motion 시 즉시 전환

**Step 4: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/components/vote-buttons.tsx
git commit -m "feat(community): add vote button animations with reduced-motion support"
```

---

### Task 18: 피드/댓글 삽입/삭제 애니메이션

**Files:**
- Modify: `apps/app/src/features/community/components/post-card.tsx`
- Modify: `apps/app/src/features/community/components/comment-item.tsx`
- Modify: `apps/app/src/features/community/pages/home-feed.tsx`

**Step 1: 피드 아이템 진입 애니메이션**

- PostCard 리스트에 `MotionPreset` inView + stagger fade-in
- 새 포스트 삽입 시 fade-in + slide-down

**Step 2: 댓글 삽입/삭제 애니메이션**

- 새 댓글: `MotionPreset` fade-in
- 댓글 삭제: `AnimatePresence` + fade-out + height collapse exit

**Step 3: Sort 탭 언더라인 애니메이션**

- SortTabs의 활성 탭에 `motion.div` layoutId="activeTab" 언더라인
- 탭 전환 시 언더라인이 부드럽게 이동

**Step 4: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/components/
git add apps/app/src/features/community/pages/home-feed.tsx
git commit -m "feat(community): add feed/comment insert/delete animations"
```

---

## E5: 카르마 UI

### Task 19: 백엔드 karma API 추가 (tRPC + REST)

**Files:**
- Create: `packages/features/community/server/karma/karma.service.ts`
- Create: `packages/features/community/server/karma/karma.controller.ts`
- Modify: `packages/features/community/trpc/community.route.ts` (getKarma 추가)
- Modify: `apps/server/src/app.module.ts` (KarmaController 등록)
- Reference: `.claude/rules/backend/api-strategy.md` (tRPC + REST 쌍 필수)
- Reference: `packages/features/community/server/vote/` (기존 karma 계산 로직 참조)

**Step 1: KarmaService 구현**

- `getKarma(userId, communityId?)`: communityId 있으면 해당 커뮤니티, 없으면 전체 합산
- `getBatchKarma(userIds[])`: 복수 유저 배치 조회
- 응답: `{ total: number, communities: [{ communityId, slug, karma }] }`
- Drizzle로 `community_user_karma` 테이블 조회

**Step 2: tRPC router 추가**

```typescript
getKarma: publicProcedure
  .input(z.object({ userId: z.string(), communityId: z.string().optional() }))
  .query(({ input }) => karmaService.getKarma(input.userId, input.communityId))
```

**Step 3: REST Controller + Swagger**

```typescript
@Controller('community/karma')
@ApiTags('Community Karma')
export class KarmaController {
  @Get()
  @ApiOperation({ summary: '카르마 조회' })
  async getKarma(@Query('userId') userId: string, @Query('communityId') communityId?: string) { ... }

  @Get('batch')
  @ApiOperation({ summary: '복수 유저 카르마 배치 조회' })
  async getBatch(@Query('userIds') userIds: string[]) { ... }
}
```

**Step 4: Commit**

```bash
git add packages/features/community/server/karma/
git add packages/features/community/trpc/community.route.ts
git add apps/server/src/app.module.ts
git commit -m "feat(community): add karma query API (tRPC + REST)"
```

---

### Task 20: useKarma hook + 배치 페칭

**Files:**
- Create: `apps/app/src/features/community/hooks/use-karma.ts`

**Step 1: useKarma hook 구현**

```typescript
export function useKarma(userIds: string[]) {
  return useQuery({
    queryKey: ['karma', ...userIds.sort()],
    queryFn: () => trpc.community.getBatchKarma.query({ userIds }),
    staleTime: 5 * 60 * 1000, // 5min
    enabled: userIds.length > 0,
  })
}
```

- 페이지에 보이는 unique authorId 모아서 1회 호출
- `staleTime: 5min` 캐싱

**Step 2: Commit**

```bash
git add apps/app/src/features/community/hooks/use-karma.ts
git commit -m "feat(community): add useKarma hook with batch fetching"
```

---

### Task 21: KarmaLevel 배지 컴포넌트 + 유저 HoverCard

**Files:**
- Create: `apps/app/src/features/community/components/karma-badge.tsx`
- Create: `apps/app/src/features/community/components/user-hover-card.tsx`

**Step 1: KarmaBadge 컴포넌트**

```typescript
const LEVELS = [
  { min: 5000, label: 'Leader', color: 'bg-yellow-500' },
  { min: 2000, label: 'Guide', color: 'bg-purple-500' },
  { min: 500, label: 'Helper', color: 'bg-blue-500' },
  { min: 100, label: 'Contributor', color: 'bg-green-500' },
]
```

**Step 2: UserHoverCard 컴포넌트**

- shadcn `HoverCard` 사용
- username hover 시: 아바타 + 이름 + Total Karma + Top Communities breakdown
- `useKarma([userId])` 로 데이터 조회

**Step 3: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/components/karma-badge.tsx
git add apps/app/src/features/community/components/user-hover-card.tsx
git commit -m "feat(community): add KarmaBadge and UserHoverCard components"
```

---

### Task 22: PostCard/CommentItem에 카르마 표시 통합

**Files:**
- Modify: `apps/app/src/features/community/components/post-card.tsx`
- Modify: `apps/app/src/features/community/components/comment-item.tsx`
- Modify: `apps/app/src/features/community/pages/home-feed.tsx` (useKarma 호출)
- Modify: `apps/app/src/features/community/pages/post-detail.tsx` (useKarma 호출)

**Step 1: PostCard 메타에 카르마 추가**

```
username · 🏅 1,234 · community-name · 2h ago
```
- username을 `<UserHoverCard>` 로 감싸기
- 카르마 숫자 옆에 `<KarmaBadge>` 표시

**Step 2: CommentItem 메타에 카르마 추가**

- 동일 패턴: `username · 🏅 N · time`

**Step 3: 피드/디테일 페이지에서 배치 페칭**

- `home-feed.tsx`: 피드 아이템들의 unique authorId 수집 → `useKarma(userIds)`
- `post-detail.tsx`: 포스트 + 댓글들의 authorId 수집 → `useKarma(userIds)`
- 카르마 데이터를 props로 PostCard/CommentItem에 전달

**Step 4: dev server 확인 + Commit**

```bash
git add apps/app/src/features/community/components/
git add apps/app/src/features/community/pages/
git commit -m "feat(community): integrate karma display in PostCard and CommentItem"
```

---

## Final Verification

- [ ] `pnpm build` 성공
- [ ] 모든 페이지 렌더링 확인 (dev server)
- [ ] 기존 plain text 게시물이 정상 표시되는지 확인
- [ ] light/dark 테마 모두 정상 동작
- [ ] `prefers-reduced-motion` 시 애니메이션 비활성화 확인
- [ ] Obsidian 인덱스 업데이트 (`Flotter/Features/인덱스.md`)
- [ ] Reference 문서 업데이트 (`docs/reference/features-frontend.md`)
