# Provider Feature Environment Rules

Product Builder base is cloned to create new projects. Optional provider-backed
features must therefore be safe in a freshly copied monorepo and explicit when
an operator enables them for a real project.

## Required Pattern

- Add a server-only `{FEATURE}_ENABLED=false` entry to `.env.example`.
- Keep example credentials as placeholders, but never let placeholders count as
  configured values.
- Register provider-backed Nest modules only when `{FEATURE}_ENABLED=true` and
  the strict provider config loader accepts the env.
- Put provider config validation in `packages/features/{feature}/config/*` or
  the equivalent feature-owned config module. Do not parse provider secrets in
  global server boot.
- Reuse `@repo/features/common/provider-feature-env` for explicit enable
  checks and template-placeholder rejection.
- Add config tests for missing env, disabled env with placeholders, enabled env
  with placeholders, disabled env with real-looking credentials, and enabled
  env with valid credentials.
- If OpenAPI should include the feature routes, add deterministic fixture env to
  `apps/server/scripts/dump-openapi.sh`. Runtime gating must remain unchanged.
- Document disabled behavior: when the gate is off, routes are not registered.

## Project Creation Boundary

Do not attach optional external-provider features to `project.created` just
because the base repo is cloned into a new product. A newly cloned Product
Builder monorepo is the project template; external provider access is an
operator/admin decision.

Only add `project.created` behavior when the feature has an explicit
per-project provisioning contract, scoped storage, and rollback semantics. For
admin-only provider integrations, keep activation at env/config level.

## Provider Boundary

Use an official SDK only when it gives a stable contract that matches the
feature requirements. If the feature uses direct REST/HMAC, document that
decision and keep the provider protocol isolated in a client/adapter file.
