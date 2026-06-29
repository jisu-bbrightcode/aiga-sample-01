# PB-INFRA-001 — Neon / Vercel 환경 연결 (Provisioning runbook + env mapping)

- Issue: `BBR-499` `[PB-INFRA-001]`
- Blueprint: `온라인 서비스` (`online-service-standard`)
- Capability: `environment.neon-vercel`
- Depends on: `PB-FOUND-001` (BBR-498) — **resolved** (foundation env naming contract in
  `doc/plans/PB-FOUND-001-foundation-setup.md` §5)
- Delivery repo: `jisu-bbrightcode/aiga-sample-01` · default branch `main`
- Derivation base: `product-builder-base@111d7721` (vendored snapshot)

> **Scope of this document.** PB-FOUND-001 §5 fixed the *env naming contract*. This document
> is the *provisioning runbook* + *complete env mapping matrix* + *deploy checklist* that the
> Platform Engineer (or operator) executes against real Neon/Vercel accounts. It does **not**
> store any secret value. The placeholder tables in §1 are filled in with the real
> project ids / branch ids / URLs once provisioning runs (see §7 blocker).

---

## 0. Reuse posture — base already ships the deploy machinery

Nothing in the deploy toolchain is implemented from scratch; it is REUSE of the vendored base.
Verified on `main`:

| Artifact | Path | Purpose |
|----------|------|---------|
| Per-app Vercel config | `apps/{site,app,admin,server}/vercel.json` | build/install/framework/output per project |
| Neon branch helper | `scripts/neon-branch.mjs` (`pnpm db:branch:new/url/rm`) | preview/E2E DB branch lifecycle via Neon API |
| Vercel gate verifier | `scripts/verify-vercel-deploy-gate.mjs` (`pnpm verify:vercel-gate`) | asserts Deployment Checks are wired |
| Deploy gate runbook | `docs/runbooks/vercel-deploy-gate.md` | GitHub Checks → production promotion gate |
| Server env schema | `apps/server/src/config/env.ts` (`serverEnvSchema`) | authoritative required/optional env list |
| Env naming guide | `docs/guides/shared/environment-config.md` | server/client prefix rules |

The **NEW delta** owned by PB-INFRA-001 is operational: create the accounts/projects, set env
per environment, wire the gate, and record the resulting ids/URLs here + in the issue.

---

## 1. Provisioned resources (AC#1 — fill on provisioning)

> These values are recorded in the issue thread when provisioning completes. Until then they
> are blocked on credentials (§7). Replace each `<…>` with the real value and keep this table
> as the single source of truth.

### Neon

| Field | Value |
|-------|-------|
| Neon project name | `aiga-sample-01` |
| Neon project id | `<neon_project_id>` |
| Region | `<aws-…>` (match app region, e.g. `ap-northeast-2` / `us-east-2`) |
| Database name | `<db_name>` (default `neondb`) |
| Role | `<role>` |
| Production branch | `production` (primary) → `id <br_…>` |
| Development branch | `development` → `id <br_…>` |
| Preview branches | ephemeral per PR via `pnpm db:branch:new e2e/pr-<n>` (GC by `scripts/neon-gc.mjs`) |

### Vercel (one project per deployable app)

| Vercel project | Root dir | Framework | Output | Project id |
|----------------|----------|-----------|--------|------------|
| `aiga-site` | `apps/site` | Next.js | (next) | `<prj_…>` |
| `aiga-app` | `apps/app` | Vite (SPA rewrite) | `dist` | `<prj_…>` |
| `aiga-admin` | `apps/admin` | Vite (SPA rewrite) | `dist` | `<prj_…>` |
| `aiga-server` | `apps/server` | Node (NestJS) | `vercel-output` | `<prj_…>` |

| Field | Value |
|-------|-------|
| Vercel team/org id | `<team_…>` |
| Production domain(s) | `<app.example.com>`, `<example.com>` |
| Preview URL pattern | `<project>-<hash>-<team>.vercel.app` |

> Each project's `installCommand`/`buildCommand` are already pinned in its `vercel.json`; set
> only **Root Directory** in the Vercel UI to the matching `apps/<app>` so the monorepo builds
> resolve. Git integration → connect all four projects to `jisu-bbrightcode/aiga-sample-01`.

---

## 2. Complete env mapping matrix (AC#2, AC#3)

Source of truth: `apps/server/src/config/env.ts` (`serverEnvSchema`), `packages/core/auth`
(better-auth), root `.env.example`, `docs/guides/shared/environment-config.md`.

**Prefix rule.** Browser-exposed values **must** carry `NEXT_PUBLIC_` (site) or `VITE_`
(app/admin). Everything unprefixed is server-only and must never reach the client bundle.

### 2a. In-scope env (Neon + Vercel platform) — set in Vercel per Environment

Legend: **R**=required for boot, **A**=required for auth, **P**=platform-provided, **opt**=optional.
Columns = Vercel Environments: **Prod** / **Prev** (Preview) / **Dev** (Development, `vercel env pull`).

| Key | Scope / project | Class | Prod | Prev | Dev | Notes |
|-----|-----------------|-------|:----:|:----:|:---:|-------|
| `DATABASE_URL` | server | **R** secret | prod branch (pooled) | per-PR Neon branch | dev branch | Neon pooled URI, `?sslmode=require` |
| `BETTER_AUTH_SECRET` | server | **A** secret | ✓ | ✓ | ✓ | `openssl rand -base64 32`; distinct per env |
| `BETTER_AUTH_URL` | server | **A** config | prod app origin | preview origin | `http://localhost:3000` | must match the deployed app origin |
| `BETTER_AUTH_COOKIE_DOMAIN` | server | opt config | `.<domain>` | — | — | only for cross-subdomain cookies |
| `CORS_ORIGINS` | server | **A** config | prod origins (csv) | preview origins | localhost csv | app + site origins |
| `APP_URL` | server | config | prod app URL | preview URL | `http://localhost:3000` | defaulted; set explicitly in prod |
| `PORT` | server | config | (Vercel-managed) | (managed) | `3002` | defaulted to 3002 |
| `VITE_API_URL` | app, admin | **R** public | prod server URL | preview server URL | `http://localhost:3002` | client → API base |
| `VITE_APP_NAME` | app, admin | opt public | `AIGA` | — | — | UI label override |
| `NEXT_PUBLIC_*` | site | public | branding (PB-WEB-001) | — | — | site public config; exact keys owned by PB-WEB-001 |
| `BLOB_READ_WRITE_TOKEN` | server | **P** secret | ✓ | ✓ | local token | Vercel Blob (file-upload base feature, in-scope) |
| `NEON_API_KEY` | CI only | secret | — | — | — | GitHub Actions secret; used by `neon-branch.mjs` for preview branches |
| `NEON_PROJECT_ID` | CI only | config | — | — | — | GitHub Actions var; pairs with `NEON_API_KEY` |
| `VERCEL_TOKEN` | CI/local only | secret | — | — | — | for `verify:vercel-gate`; not a runtime app env |

> `DATABASE_URL` per-environment binding: Production → Neon `production` branch pooled URI;
> Preview → ephemeral branch created by CI (`pnpm db:branch:new e2e/pr-<n>` emits the URI to
> inject into the preview deployment / test step); Development → Neon `development` branch or
> local Postgres in `.env.local`.

### 2b. Server boot contract (from `serverEnvSchema`)

- **Hard-required (no default, `min(1)`):** `DATABASE_URL`. Missing → server fails to boot.
- **Defaulted (safe to omit, override in prod):** `PORT`(3002), `APP_URL`, `EMAIL_PROVIDER`(resend),
  `EMAIL_FROM`.
- **Optional / feature-gated (absence disables only that feature, not boot):** `RESEND_API_KEY`,
  `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, `GEMINI_API_KEY`, `INNGEST_EVENT_KEY`,
  `INNGEST_SIGNING_KEY`, `BLOB_READ_WRITE_TOKEN`, `CLOUDFLARE_STREAM_*`, `KCB_*`.

> Deploy-platform behaviour: when `VERCEL` is set the server reads only Vercel Environment
> Variables and skips local `.env*` loading (`docs/guides/shared/environment-config.md`).

---

## 3. Provisioning checklist (배포 체크리스트)

### A. Neon
1. Create Neon project `aiga-sample-01` in the target region; note **project id**, **db name**, **role**.
2. Confirm default/primary branch; rename or designate it `production`.
3. Create a `development` branch (or use local Postgres for dev).
4. Copy the **pooled** connection URI (`-pooler`, `?sslmode=require`) → this is `DATABASE_URL` (Prod).
5. Generate a Neon **API key**; record `NEON_API_KEY` + `NEON_PROJECT_ID` as GitHub Actions
   secret/var so preview-branch automation (`scripts/neon-branch.mjs`) works in CI.
6. Run schema sync against production branch: `pnpm db:migrate` (or `db:push`) with `DATABASE_URL` set.

### B. Vercel
7. Connect the 4 projects (`aiga-site/app/admin/server`) to `jisu-bbrightcode/aiga-sample-01`;
   set each project's **Root Directory** to `apps/<app>` (build/install come from each `vercel.json`).
8. For each project set env per Environment using the §2a matrix
   (Production / Preview / Development). Secrets as "Sensitive".
9. Set `BLOB_READ_WRITE_TOKEN` (create a Vercel Blob store and bind its token).
10. Wire the production-promotion gate per `docs/runbooks/vercel-deploy-gate.md`:
    Settings → Git → Deployment Checks → GitHub Checks **On**, gate workflow
    `all tests (real Postgres)`, on `aiga-app` + `aiga-server`.
11. Verify the gate: `pnpm verify:vercel-gate` → every project shows `✓ checks: ≥1`.

### C. Health checks (production-readiness evidence)
12. `GET /health` (or the `health` resource from `apps/api/openapi.yaml`) on `aiga-server` prod → 200.
13. `aiga-site` prod URL loads **without login** (public browsable — online-service rule).
14. `aiga-app` prod URL: protected action triggers the **auth modal** (not a raw 401 page).
15. Sign-up / login round-trip succeeds against the Neon production branch.
16. Record in the issue: Neon project id, prod branch id, 4 Vercel project ids, prod URLs,
    migration log, gate `verify:vercel-gate` output, health-check responses.

---

## 4. Non-Neon/Vercel environments → separate porting workflow (AC#4)

Per the issue rule *"Neon/Vercel 외 환경은 별도 porting workflow로 분리되어 있다"*, every
third-party provider env is **out of scope here** and routed to a dedicated porting issue.
None of these block core deploy: each is feature-gated (absence disables only its feature).

| Provider group | Env keys | Selected? | Porting target |
|----------------|----------|-----------|----------------|
| Email (Resend) | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_PROVIDER` | notification feature | porting issue |
| OAuth providers | `GOOGLE_*`, `LINKEDIN_*`, `APPLE_*`, `KAKAO_*`, `NAVER_*` | kakao+naver (AIGA) | porting issue (callback URLs need prod origins) |
| Payment (KG Inicis) | `PAYMENT_INICIS_*` | per feature selection | porting issue |
| Message/알림톡 (SOLAPI) | `SOLAPI_*` (`SOLAPI_ENABLED=false` default) | per selection | porting issue |
| KCB identity gate | `KCB_*` | optional feature | porting issue |
| Video lecture (Cloudflare Stream) | `CLOUDFLARE_STREAM_*`, `CLOUDFLARE_ACCOUNT_ID` | optional feature | porting issue |
| Analytics (PostHog) | `POSTHOG_*`, `VITE_POSTHOG_*` | optional | porting issue |
| Feedback (Featurebase) | `FEATUREBASE_*` | optional | porting issue |
| Backup (Google Drive) | `GOOGLE_OAUTH_*`, `BACKUP_GOOGLEDRIVE_*` | optional | porting issue |
| Sync (ElectricSQL) | `ELECTRIC_*` | optional | porting issue |
| AI/jobs | `OPENAI_*`, `GEMINI_API_KEY`, `INNGEST_*` | optional | porting issue |

> **Vercel Blob** (`BLOB_READ_WRITE_TOKEN`) stays **in-scope** here because it is a Vercel
> platform primitive and the file-upload base feature (issue workflow rule). Everything above
> is a non-Neon/non-Vercel third party and is deferred to the porting workflow.

---

## 5. Environment ↔ git mapping

| Vercel Environment | Git trigger | Neon branch | Purpose |
|--------------------|-------------|-------------|---------|
| Production | push to `main` (gated) | `production` (primary, pooled) | live |
| Preview | PR / non-`main` branch | ephemeral `e2e/pr-<n>` via `neon-branch.mjs` | per-PR review |
| Development | local / `vercel env pull` | `development` or local | dev |

---

## 6. Acceptance criteria status

| AC | Status | Evidence |
|----|--------|----------|
| Neon project id, db branch, Vercel project id in issue | ⏳ blocked on creds | §1 table ready to fill; needs §7 |
| 필수 env가 Prod/Preview/Dev별 정의 | ✅ spec done | §2a matrix; values set during §3 |
| Vercel Preview/Production env key 누락 없이 매핑 | ✅ spec done | §2a + §2b boot contract |
| Neon/Vercel 외 환경은 별도 porting workflow로 분리 | ✅ done | §4 |

---

## 7. Blocker — provisioning credentials (first-class)

Actual provisioning (creating the Neon project + 4 Vercel projects, setting env, producing real
ids/URLs in §1) **cannot run from this agent runner**: it has GitHub (`bright2024`) + Paperclip
only — **no Neon API key, no Vercel token, no Neon/Vercel CLI** (verified: `which neonctl vercel`
→ not found; no `NEON_*`/`VERCEL_*` in env; no `.env.local`).

- **Unblock owner:** operator (Neon + Vercel account holder for the AIGA delivery).
- **Unblock action — pick one:**
  1. **Secure runner creds (preferred for automation):** provide `NEON_API_KEY`, `NEON_PROJECT_ID`,
     `VERCEL_TOKEN` (+ team id) via the secure runner credential channel (never pasted in the
     issue thread). Then this agent runs §3 A/B + §3 C health checks and fills §1.
  2. **Operator provisions via dashboard:** operator creates the Neon project + 4 Vercel projects,
     sets env per §2a, and pastes the ids/URLs into the issue. This agent then verifies the gate
     + health checks and closes the ACs.

On either path, the durable spec/matrix/checklist above makes the remaining work mechanical.
