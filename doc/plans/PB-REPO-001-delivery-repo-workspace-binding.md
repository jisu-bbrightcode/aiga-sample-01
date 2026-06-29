# PB-REPO-001 — 고객 납품 repo/workspace 연결 (Delivery Repo & Workspace Binding)

> **Build**: `bp-0b891299-66b7-438f-a3a4-7a63fbf8632b`
> **Blueprint**: `온라인 서비스` (online-service-standard)
> **Issue**: BBR-497 (`2d39150a-06e5-48a9-bf29-9a5fc854e998`) · **Role**: Delivery Lead · **Depends on**: PB-BASE-001 (`done`)
> **Authored**: 2026-06-29 · **Method**: authenticated GitHub inspection (`gh` as `bright2024`) + live workspace inspection
> **Gate status**: ✅ binding decision finalized · 🔴 1 first-class blocker (delivery-repo write access) prevents materialization (seed/push/deploy)

This document is the **authoritative repo/workspace binding** for the AIGA delivery. Every downstream
implementation issue MUST execute against the workspace and follow the branch/PR strategy defined here.
A fallback cwd is prohibited (per Execution Requirements).

---

## 0. Verdict summary

| Item | Result |
|------|--------|
| Customer delivery repo | `https://github.com/jisu-bbrightcode/aiga-sample-01` (public, default `main`) |
| Repo state (remote) | **EMPTY** — `git ls-remote --heads origin` returns zero refs (unseeded) |
| Execution workspace | `…/projects/96fcd977-…/b281c16e-…/aiga-sample-01` (real clone of the delivery repo) |
| Base codebase | `product-builder-base@main` pinned `111d7721dae1aeeef764f3caf0005d16993a704a` |
| Relationship | Vendored derivation snapshot of base (NOT a GitHub fork) |
| Branch/PR strategy | trunk `main` + `feat/<issue-key>-<slug>` → squash PR (see §3) |
| Vercel target | scope linked to `jisu-bbrightcode/aiga-sample-01` (provisioning = PB-INFRA-001) |
| **Blocker** | runner identity `bright2024` has `push:false` on delivery repo → cannot seed/push/deploy |

---

## 1. Customer delivery repo

- **URL**: `https://github.com/jisu-bbrightcode/aiga-sample-01.git`
- **Owner**: `jisu-bbrightcode` · **Visibility**: public · **Default branch**: `main`
- **Current state**: empty. Verified `2026-06-29`:
  - `git ls-remote --heads origin` → **0 refs** (no `main`, no branches).
  - `gh api repos/jisu-bbrightcode/aiga-sample-01` → `permissions: { pull: true, push: false, admin: false, maintain: false }`.
- The local doc branches (`docs/pb-decide-001-*`, `docs/pb-base-001-*`, `qa/auth-integration`, and this branch)
  exist **only in the workspace clone** — none have reached the remote because push is denied (§5).

## 2. Execution workspace

- **Canonical path**:
  `/Users/papert/.cos-v2/paperclip-prod/instances/prod/projects/96fcd977-1d55-4697-a464-abb656dd57c2/b281c16e-95eb-4201-82e1-4406a92c29bf/aiga-sample-01`
- This clone is the **single canonical execution workspace** for ALL AIGA implementation issues
  (frontend track of 32 issues, backend `apps/server`, infra). No issue may implement from an
  unspecified fallback cwd.
- `origin` → the delivery repo above (verified `git remote -v`).

## 3. Branch & PR strategy

| Branch kind | Pattern | Notes |
|-------------|---------|-------|
| Trunk | `main` | protected; **Vercel production** source. Empty until the seed lands. |
| Seed | (initial commit on `main`) | vendors `product-builder-base@111d7721`; see §4. |
| Feature | `feat/<issue-key>-<slug>` | e.g. `feat/pb-found-001-foundation`. One branch per issue. |
| Fix / chore / docs / test | `fix/…` `chore/…` `docs/…` `test/…` `<issue-key>-<slug>` | docs already in use in-workspace. |

- **One PR per issue → base `main`**, **squash merge**.
- PR title: `<type>(<issue-key>): <summary>`; body links the Paperclip issue key.
- **Merge gate** (base scripts, verified via PB-BASE-001 / frontend track): `pnpm install` →
  `turbo run build` + `turbo run check-types` + biome (`scripts/biome-changed.mjs`) +
  `pnpm deploy:check` / `verify:vercel-gate`.
- **Each PR → Vercel preview deploy**; `main` → production.

## 4. Relationship to product-builder-base

- aiga-sample-01 is a **vendored derivation snapshot** of `product-builder-base`, **NOT a GitHub fork**:
  different owner (`jisu-bbrightcode` vs `BBrightcode-atlas`), will diverge with customer-specific code,
  and base is tracked as an **upstream reference by pinned SHA**, not by a live git-merge remote.
- **Base = single implementation source of truth** (per workflow rules: "실제 구현 기준 코드베이스는
  product-builder-base"). Customer code lands on top of the seed.
- **Base upgrades** are applied as deliberate, reviewed re-vendor/cherry-pick against a *new* pinned SHA —
  never auto-merged.
- **Flotter = reference-only** (not a copy source), per workflow rules.
- Seed plan (executes once §5 is unblocked): copy base tree @ `111d7721` → initial commit on `main`
  `chore(seed): vendor product-builder-base@111d7721 as AIGA delivery base` → tag `base/v1-111d7721`.

## 5. 🔴 BLOCKER — delivery-repo write access (must be granted by owner)

- **Symptom**: runner GitHub identity is `bright2024`; on `jisu-bbrightcode/aiga-sample-01` it has
  `push: false` (pull-only). `gh auth status` shows no other account.
- **Impact**: cannot seed the empty repo, cannot push branches, cannot open PRs (no base commit exists to
  PR into), cannot trigger Vercel deploys. The entire downstream delivery (frontend 32-issue track,
  `apps/server`, PB-INFRA-001) is gated on this.
- **Unblock owner**: human operator / repo owner **`jisu-bbrightcode`**.
- **Unblock action (either)**:
  1. Add `bright2024` as a **Collaborator with Write** on `jisu-bbrightcode/aiga-sample-01`; **or**
  2. Provide a **fine-grained PAT** (scopes: `contents:write`, `pull_requests:write`, `workflow`) bound
     to the runner credential helper.
- **On unblock (auto-resume via interaction `wake_assignee`)**: PB-REPO-001 executes the §4 seed, pushes
  the existing in-workspace doc branches, and confirms branch protection on `main`; then the frontend and
  backend tracks become operationally unblocked.

## 6. Vercel connection target (specification; provisioning = PB-INFRA-001)

- Vercel scope linked to `jisu-bbrightcode/aiga-sample-01`.
- `apps/site` (Next.js 16, public SEO/AEO/GEO) → **primary Vercel project**, production branch `main`,
  preview per PR. Public pages browsable without login; protected actions use the auth modal pattern.
- `apps/app` + `apps/admin` (Vite 6 / React 19 SPAs) → Vercel static projects with SPA rewrites
  (per-app `vercel.json`).
- `apps/server` (NestJS 11) → API runtime; final host decided in PB-INFRA-001 (Neon + Vercel fixed).
- DB = Neon serverless. Monorepo build via turbo; Vercel "Root Directory" set per app project.

## 7. Acceptance criteria status

| Criterion | Status |
|-----------|--------|
| 실행 에이전트가 작업할 repo/workspace가 명시되어 있다 | ✅ §1, §2 |
| 고객 납품 repo ↔ product-builder-base 관계 문서화 | ✅ §4 |
| 후속 구현 issue가 fallback cwd가 아니라 이 workspace 기준 실행 | 🟡 workspace defined (§2); **code push/deploy blocked until §5 granted** |
