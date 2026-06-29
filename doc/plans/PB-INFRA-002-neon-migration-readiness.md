# PB-INFRA-002 — Neon migration / DB 운영 준비 검증

- Issue: **BBR-524** `[PB-INFRA-002]`
- Capability: `environment.neon-migration-readiness`
- Depends on: PB-INFRA-001 (BBR-499), PB-DATA-001 (BBR-519), PB-FEAT-003 (BBR-495) — all resolved
- Date: 2026-06-29

## TL;DR

Verifying the migration/seed/health toolchain against a real PostgreSQL 16 engine
uncovered that **`pnpm db:migrate` could not apply the migration chain from scratch** —
the exact path used to provision a fresh Neon branch (`scripts/e2e-against-branch.sh`,
`.github/workflows/all-tests-postgres.yml`, `e2e-against-pg-branch.yml`). Three distinct
defects blocked migrate-from-scratch. All three are fixed; the full chain (0000→0047, 48
migrations) now applies cleanly, the service-domain seed runs idempotently, and an
app-driver DB health check passes.

This is the root cause of the previously-observed base-wide CI red (filed as `[PB-DATA-FIX]`).

> The literal Acceptance Criterion "migration applied **on a Neon branch**" still requires
> real Neon credentials, which are not present on this runner — the same blocker as
> **BBR-719** (PB-INFRA-001b). That step is carved out below; everything that does **not**
> require credentials is done and proven here.

## Verification environment

No Neon API key / `DATABASE_URL` is provisioned on the runner (dummy state per PB-INFRA-001;
real provisioning blocked on operator creds → BBR-719). To verify the toolchain against a
real Postgres engine with **Neon parity**, an ephemeral container was used:

```
docker run -d --name aiga-infra002-pg \
  -e POSTGRES_USER=aiga -e POSTGRES_PASSWORD=aiga -e POSTGRES_DB=aiga_verify \
  -p 55432:5432 postgres:16-alpine
# server: PostgreSQL 16.14   (Neon runs PG16/17)
DATABASE_URL=postgres://aiga:aiga@127.0.0.1:55432/aiga_verify
```

The migrate + seed scripts use the app's own driver (`postgres` / postgres-js + drizzle),
so this exercises the identical connection + apply path the server uses on Neon.

## Defects found & fixed (migrate-from-scratch blockers)

### 1. `0004_powerful_riptide.sql` — FK type mismatch (code 42804)
`sync_changelog.changed_by` was created as `uuid`, then an FK was added to
`profiles.id` (which is `text`) — incompatible types, so `ADD CONSTRAINT` failed.
`0005` later alters the column to `varchar(255)`, and `0040` drops the table entirely.
**Fix:** create `changed_by` as `varchar(255)` directly (its eventual type), making the
FK valid at creation; `0005`'s `ALTER … SET DATA TYPE varchar(255)` becomes a harmless no-op.

### 2. `0011_small_polaris.sql` — composite FK before its unique index (code 42830)
`illustration_variant_attempt_request_fk` references `generation_attempt(id, request_id)`,
but the supporting `CREATE UNIQUE INDEX generation_attempt_id_request_uniq` was emitted
**after** the FK. PG requires the referenced columns to already carry a unique constraint.
**Fix:** moved the composite FK statement to **after** its unique index. (The two composite
FKs in `0012` reference indexes created earlier in `0011`, so they were already fine.)

### 3. `db-migrate.ts` — whole chain ran in ONE transaction (code 0A000 "unsafe use of new value")
`drizzle-orm/postgres-js`'s `migrate()` wraps the **entire** migration list in a single
`session.transaction(...)`. The history adds an enum value (`ALTER TYPE notification_type
ADD VALUE 'backup_googledrive'` @0013) and **uses** it later (`… WHERE type =
'backup_googledrive'` @0041). PostgreSQL forbids using a newly-added enum value in the same
transaction, so a single-transaction migrate-from-scratch always failed. Real deployments
never hit this because migrations were applied **incrementally** (one commit per deploy);
only a fresh Neon branch (all migrations at once) breaks.
**Fix:** rewrote `db-migrate.ts` to apply **each migration in its own transaction** — the
same model as incremental deploys — using drizzle's `readMigrationFiles` so the
`drizzle.__drizzle_migrations` ledger (hash + `created_at`/folderMillis) stays fully
compatible with the standard drizzle migrator. enum `ADD VALUE` now commits before any
later use, resolving the entire add-then-use class.

## Deliverable 1 — migration 적용 로그

```
$ pnpm --filter @repo/drizzle db:migrate     # against fresh postgres:16-alpine
[db-migrate] target: postgres://***@127.0.0.1:55432/aiga_verify
[db-migrate] migrations folder: .../packages/drizzle/migrations
[db-migrate] ✅ migrations applied (applied=48, skipped=0, total=48)
```

Live ledger after apply:

```
select count(*) from drizzle.__drizzle_migrations;   -> 48
select count(*) from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE';   -> 123
```

Idempotency — re-running on an already-migrated DB applies nothing:

```
[db-migrate] ✅ migrations applied (applied=0, skipped=48, total=48)
```

## Deliverable 2 — seed 결과

```
$ pnpm --filter @repo/drizzle db:seed:service-domain
Seeding service_specialties (6 rows)...
Seeding service_regions (3 rows, 2-level)...
Seeding service_hospitals (2 rows)...
Seeding service_doctors (3 rows, 1 featured 명의) + links...
  [ok] { specialties: 6, regions: 3, hospitals: 2, doctors: 3,
         doctor_specialties: 3, doctor_hospitals: 3 }
Service domain seed complete.
```

Re-running produces identical counts (idempotent via `onConflictDoNothing` on slugs).

## Deliverable 3 — DB health check

Direct engine checks:

```
connectivity(SELECT 1)               = 1
applied_migrations                   = 48
public_base_tables                   = 123
service_doctors                      = 3
service_specialties                  = 6
featured_myeongui(명의)              = 1
sync_changelog_present (drop@0040)   = 0   ✓ expected
backup_googledrive_tables (drop@0041)= 0   ✓ expected
```

App-driver health check (postgres-js — same driver as `apps/server`, connecting via
`DATABASE_URL`):

```
[app-db-health] connect=OK select1=1 migrations=48 service_doctors=3
[app-db-health] server=PostgreSQL 16.14 on aarch64-unknown-linux-musl
[app-db-health] PASS
```

## Deliverable 4 — rollback / re-apply note

Per-migration transactions mean a failed migration rolls back only **itself**; previously
applied migrations stay committed and recorded, so a re-run resumes from the last good one.

**Neon dev/staging branch operations (when creds are available — BBR-719):**

- **Forward apply:** `DATABASE_URL=<neon-branch-url> pnpm --filter @repo/drizzle db:migrate`
  then `… db:seed:service-domain`. Safe to re-run (idempotent ledger + idempotent seed).
- **Rollback (preferred on Neon):** Neon branches are cheap and disposable. To roll back,
  **reset/delete the branch** and recreate from parent, or use Neon point-in-time restore —
  do **not** hand-edit `drizzle.__drizzle_migrations`. Branch lifecycle is scripted in
  `scripts/neon-branch.mjs` (`pnpm db:branch:new|rm|url`).
- **Re-apply after a fix:** if a migration fails mid-chain, fix the SQL, then re-run
  `db:migrate`; only unapplied migrations execute (verified: `applied=0, skipped=48` on a
  fully-migrated DB).
- **Forward-only fix (if a bad migration already committed on a long-lived branch):** add a
  new corrective migration rather than editing history, so existing ledgers stay valid.

## Acceptance criteria status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | migration이 실제 적용되어 있다 | ✅ proven on PG16 (48/48); **on a real Neon branch → BBR-719** (creds) |
| 2 | 앱 서버가 DATABASE_URL로 DB health check 통과 | ✅ app-driver health check PASS |
| 3 | 실패 시 rollback/재적용 절차가 남아 있다 | ✅ this note + idempotent resume verified |

## Remaining (cred-gated) → child issue

Applying the now-verified chain to a **real Neon dev/staging branch** and a Vercel-env
`DATABASE_URL` requires Neon credentials, identical to **BBR-719 (PB-INFRA-001b)**. Carved
out as a child issue blocked on creds; the runbook above is execution-ready — when creds
land, run `db:migrate` + `db:seed:service-domain` against the Neon branch URL and capture
the same evidence.

## Files changed

- `packages/drizzle/migrations/0004_powerful_riptide.sql` — `changed_by uuid → varchar(255)`
- `packages/drizzle/migrations/0011_small_polaris.sql` — move composite FK after its unique index
- `packages/drizzle/src/scripts/db-migrate.ts` — per-migration transactions (was single-tx)
