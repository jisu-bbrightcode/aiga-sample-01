# PB-ADMIN-001 — 관리자 앱 / 접근 제어 (admin.shell-rbac)

BBR-676. Capability `admin.shell-rbac`. Target: `apps/admin` + server admin surface (`packages/features/_common`) + admin guard (`packages/core/nestjs/auth`).

## What is REUSE vs NEW

| Deliverable | Status | Where |
|---|---|---|
| 관리자 shell | REUSE | `apps/admin` `AdminLayout` + shared `SidebarLayout` |
| role guard (client) | REUSE | `packages/core/auth/guards/admin-guard.tsx` (`AdminGuard`, org-membership role) |
| 비관리자 차단 | REUSE | `AdminGuard` redirects unauth/non-admin to `/sign-in` |
| 최초 슈퍼 계정 | REUSE | BBR-675 `bootstrap-super-admin.ts` (owner member of org `aiga`) |
| **role guard (server) fix** | **NEW** | `packages/core/nestjs/auth/org-admin.guard.ts` |
| **감사 로그 기반** | **NEW** | `admin_audit_log` + `AdminAuditService` + viewer page |
| **관리자 변경 작업 (audited)** | **NEW** | `PATCH /admin/users/:id/role` + `AdminRoleService` |

## Server admin guard fix (AC: 관리자 권한 없이는 접근할 수 없다)

The base aliased `BetterAuthAdminGuard` to `NestAdminGuard`, which gates on the
`user_roles`/`roles` RBAC tables. Those tables are **never seeded** (no
migration seeds them; `seed-roles-permissions.ts` is a placeholder), so on a
fresh deploy every admin REST call returned `403` — including for the super
account. That made AC2 impossible at the API layer even though the client shell
rendered.

`OrgAdminGuard` gates on **Better Auth organization membership role**
(`members.role ∈ {owner, admin}`), matching the client `AdminGuard`, the
super-account bootstrap, and `request.user.activeOrganizationId` populated by
`BetterAuthGuard`. It keeps a fallback to the legacy `user_roles` slugs so
RBAC-seeded deployments still work. Either signal is sufficient; both are strict
admin signals; it fails closed on error. `BetterAuthAdminGuard` now aliases
`OrgAdminGuard`, so all existing admin controllers are fixed without per-file
changes.

## Audit log (AC: 관리자 변경 작업이 감사 로그에 남는다)

- Table `admin_audit_log` (migration `0053_admin_audit_log.sql`): append-only,
  `bigserial` id, `actor_user_id` FK `users`, `action`, `target_type`,
  `target_id`, `payload_before/after` (jsonb), `ip_address`, `user_agent`,
  `reason`, `created_at`. Indexes on `(actor, created_at desc)` and
  `(target_type, target_id)`.
- `AdminAuditService.log()` / `.list()` (cursor pagination, hard cap 200).
  General foundation, separate from the payment-domain `payment_audit_log`.
- `AdminRoleService.changeRole()` is the first writer: promoting/demoting a
  member (`admin` ↔ `member`) records a `user.role_changed` row with
  before/after role, actor, ip, user-agent, reason. Safety: never touches
  `owner`, refuses self-change, requires the target to already be a member of
  the actor's org.

## Endpoints (all `@UseGuards(BetterAuthGuard, OrgAdminGuard)`)

- `GET  /admin/audit-logs` — cursor-paginated audit trail (`AdminAuditController`).
- `PATCH /admin/users/:id/role` — `{ role: "admin" | "member", reason? }`
  (`AdminUsersController`).

## Admin shell

- New page `apps/admin/src/pages/admin/audit-logs.tsx` at route `/audit-logs`,
  sidebar entry "감사 로그". Read-only table of admin changes with "더 보기"
  pagination. User-facing errors go through a stable friendly message (no raw
  error leak).

## Verification performed

- Migrate-from-scratch on ephemeral PG16: `applied=54` then idempotent re-run
  `applied=0, skipped=54`; `admin_audit_log` columns/indexes/FK confirmed.
- `tsc --noEmit` clean for `packages/features` and `packages/core` (with the
  worktree drizzle-src path override; the symlinked node_modules otherwise
  resolves `@repo/drizzle` to a stale checkout). Admin app: only a pre-existing
  unrelated `email-logs-page.tsx` error.
- 10 unit tests green (`admin-audit.service.spec`, `admin-role.service.spec`):
  audit insert mapping, cursor pagination, role-change happy path + every safety
  rule (self-change, invalid role, owner-protect, non-member 404, no-membership).
- biome clean (only `noNonNullAssertion` warnings in test files).

## AC2 manual verification (live env)

With `first@super.local` bootstrapped as `owner` of org `aiga`:
1. Sign in to the admin app → shell renders (client `AdminGuard`).
2. `GET /admin/users` and `GET /admin/audit-logs` return `200` (server
   `OrgAdminGuard` passes on owner membership).
3. `PATCH /admin/users/:id/role` on another member → row appears in
   `GET /admin/audit-logs` and the shell's 감사 로그 page.
