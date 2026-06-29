# Community UI/UX Issues

(No issues yet)

## E1-T4

- 없음

## E2-T8

- No implementation blockers. `pnpm --filter app build` passed; existing bundle size warning remains non-blocking.

## E3-T13

- No blockers. `pnpm --filter app build` passed after CommentItem animation/collapse changes.

## E4-T17

- `pnpm --filter app build` failed due pre-existing TypeScript errors in `apps/app/src/features/community/hooks/useCommunityPost.ts` (not touched in this task).

## E4-T16

- LSP diagnostics tool repeatedly timed out (`initialize`) for changed hook files, so type verification relied on `pnpm --filter app build` instead.
