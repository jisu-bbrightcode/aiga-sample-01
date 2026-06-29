# Community UI/UX Learnings

## Initial Context

- post.content는 plain text string — TipTap JSON은 JSON.stringify()로 저장
- 카르마 조회 API 없음 — 1건 추가 승인됨
- TipTap 에디터 이미 존재 — @repo/ui/components/editor/
- Motion v12 이미 설치 — MotionPreset 컴포넌트 존재
- 현재 useVote()는 진짜 optimistic 아님 — onSuccess에서 setQueryData
- content-studio에 optimistic 참조 패턴 존재

## E2-T7: Content Helpers Utility

### Implementation Details

- Created `apps/app/src/features/community/utils/content-helpers.ts`
- Two exported functions:
  - `extractPlainText(content: string, maxLength = 200): string` — Extracts plain text from TipTap JSON, falls back to plain text if parsing fails
  - `isRichContent(content: string): boolean` — Detects if content is valid TipTap JSON (checks for `type: 'doc'` and `content` array)
- Internal helper: `extractTextFromNodes(nodes: any[]): string` — Recursively extracts text from TipTap node tree
- Handles edge cases: empty content, invalid JSON, missing nodes
- No external dependencies — pure TypeScript utility

### TipTap JSON Structure

- Format: `{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '...' }] }] }`
- Text extraction: Recursively traverse nodes, collect `node.text` values, join with spaces
- Fallback: If JSON.parse fails, treat input as plain text

### Usage Pattern

```typescript
// In components/pages that display post content
const plainText = extractPlainText(post.content, 150); // For preview
const isRich = isRichContent(post.content); // For conditional rendering
```

### Commit

- `3a4f35d feat(community): add content parsing utilities for rich text`
- File: `apps/app/src/features/community/utils/content-helpers.ts`

## E2-T8: Post Submit TipTap Integration

- Replaced `Textarea` in `post-submit-form.tsx` with `TipTapEditor` (`toolbar="full"`, `minHeight="250px"`)
- Kept `Label htmlFor="content"` and wrapped editor in `div#content` to preserve accessibility linkage
- Stored editor JSON as `editorContent` state and serialized only at submit time (`JSON.stringify(editorContent)`)
- Validation now checks both serialized presence and semantic emptiness via `extractPlainText(contentStr).trim()`

## E1-T4: SortDropdown -> SortTabs

- `SortDropdown`를 인라인 `SortTabs`로 교체할 때 기존 props 시그니처(`value`, `onChange`, `timeFilter`, `onTimeFilterChange`)를 유지하면 사용처 변경 범위를 최소화할 수 있음
- 정렬 옵션은 배열 기반 렌더링 유지 시 탭 UI 전환에도 옵션 추가/순서 변경이 쉬움
- `top` 전용 기간 선택은 `DropdownMenu`를 그대로 재사용하면 기능 회귀 없이 시각 요소만 변경 가능

## E3-T13: Comment Thread Collapse/Expand

- `CommentItem`에서 `useState(depth >= 3)` 초기값을 사용하면 깊은 댓글만 자동 접힘을 안전하게 적용할 수 있음
- 접힘 상태 안내 텍스트보다 명시적 액션 버튼(`▼ N개 답글 더 보기`)이 재진입 경로를 분명히 해 UX가 좋아짐
- `AnimatePresence initial={false}` + `motion.div` height/opacity 조합으로 기존 구조를 유지하면서 부드러운 접기/펼치기 전환 가능
- `useReducedMotion()`으로 transition duration을 0으로 전환해 reduced-motion 환경 접근성을 간단히 충족할 수 있음

## E4-T17: Vote Button Animations

- 숫자 교체 애니메이션은 `AnimatePresence mode="popLayout" initial={false}` + `motion.span key={voteScore}` 조합으로 첫 렌더 점프 없이 안정적으로 구현 가능
- 이전 숫자는 `exit: { y: 12 }`, 새 숫자는 `initial: { y: -12 }`로 설정하면 자연스러운 slide-up 전환을 만들 수 있음
- `voteMutation.isError`를 `motion.div animate` 트리거로 사용하면 vote 로직 변경 없이 오류 상태 shake 피드백을 분리 적용 가능
- `useReducedMotion()` 체크를 하나로 재사용해 slide-up/shake 모두 비활성화하면 접근성 요구사항을 깔끔하게 충족함

## E4-T16: Optimistic Create/Delete

- `trpc.*.mutationOptions()` 기반 훅에서 optimistic context 타입이 `undefined`로 고정된 경우, `onMutate` 반환 context 대신 훅 내부 `let optimisticContext` 변수 패턴(`useVote`)을 재사용하면 타입 충돌 없이 rollback 구현 가능
- 댓글 삭제 mutation input이 객체가 아니라 `string` id라서 optimistic 필터는 `item.id !== variables` 형태여야 함
- InfiniteQuery optimistic 삽입 시 post는 `pages[0].items` 앞쪽 prepend, comment는 마지막 페이지 append로 기존 페이지 커서 구조를 유지하는 것이 안전함

## E4-T18: Feed/Comment Insert/Delete Animations

- `PostCard` 자체에 `motion.article + whileInView + viewport.once`를 적용하면 스크롤 진입 fade-in을 컴포넌트 단위로 재사용할 수 있음
- 피드 리스트는 `AnimatePresence mode="popLayout"` + `motion.div layout`로 감싸고 `delay: Math.min(index * 0.05, 0.5)`를 쓰면 신규 삽입/정렬 변경 시 과도한 지연 없이 자연스러운 stagger를 만들 수 있음
- 댓글 아이템 루트에 `motion.div layout`와 `exit: { opacity: 0, height: 0 }`를 두면 삭제 시 fade-out + height collapse를 기존 접기/펼치기 애니메이션과 충돌 없이 분리 적용 가능
- SortTabs의 활성 표시자는 탭 버튼 내부 `motion.div layoutId` 언더라인으로 구현하면 탭 간 이동이 끊기지 않고 spring으로 이어짐
- 모든 transition duration을 `useReducedMotion()` 기반으로 0 처리하면 피드/댓글/탭 애니메이션 접근성 요구사항을 일관되게 충족할 수 있음

## E5-T19: Community Karma Query API (Backend)

- `CommunityKarmaService`를 추가해 `userKarma` 테이블 조회를 서비스 단일 진실 소스로 고정하고, tRPC/REST가 동일 로직을 공유하도록 구성함
- 단건 조회(`getKarma`)는 레코드가 없을 때도 `{ postKarma: 0, commentKarma: 0, totalKarma: 0 }` 기본값을 반환해 클라이언트 분기 처리를 단순화함
- 배치 조회(`getBatchKarma`)는 `inArray` + `Map` 매핑으로 조회 결과 누락 유저를 기본값으로 채워 반환하고, 입력 userId는 중복 제거해 불필요한 DB 조건을 줄임
- REST 경로는 `@Get("karma")`, `@Get("karma/batch")`를 `@Get(":slug")`보다 먼저 배치해 라우트 충돌(karma가 slug로 매칭되는 문제)을 예방함
- tRPC는 `community.karma.get` / `community.karma.getBatch`를 `publicProcedure`로 노출하고 `communityMainRouter`에 `karma` 서브 라우터를 등록함
