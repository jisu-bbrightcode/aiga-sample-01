# raw `sql\`\`` 사용 인벤토리

`scripts/audit-raw-sql.mjs` 산출. 운영자가 한 번씩 머지 전 점검.

## 요약

- 총 63건
- FRAGMENT: 46
- RAW_QUERY: 17

## 분류

- **FRAGMENT** — drizzle builder 안의 표현식 (`set({ col: sql\`${col}+1\` })`, `where(sql\`...\`)`, `conditions.push(sql\`...\`)`). 정당. 부채 아님.
- **RAW_QUERY** — `db.execute(sql\`SELECT ...\`)` / `tx.execute(...)`. drizzle 표현 어려운 영역 (CTE, advisory lock 등) 에서 정당. 한 건씩 리뷰.
- **UNKNOWN** — 패턴 매칭 실패. 수동 분류 필요.

## 파일별 카운트 (FRAGMENT / RAW_QUERY / UNKNOWN)

| file | total | F | Q | ? |
|---|---:|---:|---:|---:|
| `packages/features/payment/service/credit-ledger.service.ts` | 9 | 2 | 7 | 0 |
| `packages/features/community/service/community-vote.service.ts` | 6 | 6 | 0 | 0 |
| `packages/features/community/service/community.service.ts` | 6 | 6 | 0 | 0 |
| `packages/features/community/service/community-comment.service.ts` | 5 | 5 | 0 | 0 |
| `packages/features/community/service/community-moderation.service.ts` | 5 | 5 | 0 | 0 |
| `packages/features/blog/service/blog.service.ts` | 4 | 4 | 0 | 0 |
| `packages/features/community/service/community-post.service.ts` | 4 | 4 | 0 | 0 |
| `packages/features/payment/service/ai-usage-meter.service.ts` | 3 | 0 | 3 | 0 |
| `packages/features/payment/service/coupon.service.ts` | 3 | 3 | 0 | 0 |
| `packages/features/community/service/community-feed.service.ts` | 2 | 2 | 0 | 0 |
| `packages/features/payment/service/usage-notification.service.ts` | 2 | 1 | 1 | 0 |
| `packages/features/reaction/trpc/reaction.router.ts` | 2 | 2 | 0 | 0 |
| `apps/server/src/scripts/seed-super-user.ts` | 1 | 0 | 1 | 0 |
| `packages/features/comment/service/comment.service.ts` | 1 | 1 | 0 | 0 |
| `packages/features/localization/service/localization.service.ts` | 1 | 1 | 0 | 0 |
| `packages/features/notification/service/notification.service.ts` | 1 | 1 | 0 | 0 |
| `packages/features/payment/service/auto-recharge.service.ts` | 1 | 0 | 1 | 0 |
| `packages/features/payment/service/dunning.service.ts` | 1 | 1 | 0 | 0 |
| `packages/features/payment/service/subscription.service.ts` | 1 | 0 | 1 | 0 |
| `packages/features/payment/trpc/admin.router.ts` | 1 | 0 | 1 | 0 |
| `packages/features/scheduled-job/service/cron-runner.service.ts` | 1 | 0 | 1 | 0 |
| `packages/core/rate-limit/rate-limit.service.ts` | 1 | 1 | 0 | 0 |

## RAW_QUERY 전체 목록 (수동 리뷰 대상)

- `apps/server/src/scripts/seed-super-user.ts:63`  `const users = await sql``
- `packages/features/payment/service/ai-usage-meter.service.ts:47`  `await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.orgId}))`);`
- `packages/features/payment/service/ai-usage-meter.service.ts:273`  `const result = await tx.execute(sql``
- `packages/features/payment/service/ai-usage-meter.service.ts:286`  `const result = await tx.execute(sql``
- `packages/features/payment/service/auto-recharge.service.ts:87`  `await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${orgId}))`);`
- `packages/features/payment/service/credit-ledger.service.ts:270`  `await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);`
- `packages/features/payment/service/credit-ledger.service.ts:271`  `const last = await tx.execute<{ balance_after: number | null }>(sql``
- `packages/features/payment/service/credit-ledger.service.ts:321`  `await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);`
- `packages/features/payment/service/credit-ledger.service.ts:350`  `const usedAgg = await tx.execute<{ used: number | null }>(sql``
- `packages/features/payment/service/credit-ledger.service.ts:364`  `const last = await tx.execute<{ balance_after: number | null }>(sql``
- `packages/features/payment/service/credit-ledger.service.ts:401`  `await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);`
- `packages/features/payment/service/credit-ledger.service.ts:403`  `const last = await tx.execute<{ balance_after: number | null }>(sql``
- `packages/features/payment/service/subscription.service.ts:841`  `sql`SELECT COALESCE(SUM(delta), 0)::int AS balance`
- `packages/features/payment/service/usage-notification.service.ts:43`  `sql`SELECT pg_advisory_xact_lock(hashtext(${orgId} || '-notify-' || ${threshold}))`,`
- `packages/features/payment/trpc/admin.router.ts:496`  `const mrrRow = await ctx.db.execute<{ mrr_cents: number; active_subs: number }>(sql``
- `packages/features/scheduled-job/service/cron-runner.service.ts:197`  `sql`DELETE FROM ${sql.identifier(table)} WHERE is_deleted = true AND deleted_at < ${cutoffDate}`,`
