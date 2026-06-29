---
name: feature-flow
description: Flotter feature delivery — infra → review → backend → review → test → frontend → verify
---

## infra
role: flotter-infra
output: infra-summary.md

Goal: {goal}

Handle the infra slice only: Neon branch (feat/<slug>), drizzle schema/migration, env vars, deploy config. Apply the migration to the feature Neon branch and confirm with a verification command. Do not touch application code.

## infra-review
role: reviewer
dependsOn: infra
output: infra-review.md

Review the infra output. Check migration safety (rollback, data loss), Neon branch lineage, env completeness, and secret hygiene. Conclude with `INFRA REVIEW: PASS` or `INFRA REVIEW: FAIL` plus reasoning.

## be
role: flotter-be
dependsOn: infra-review
output: be-summary.md

Goal: {goal}

Implement the backend slice on top of the migrated schema. Add tRPC routers, services, and auth guards. Export the types and zod schemas the frontend will depend on. List those contract files explicitly in the output.

## be-review
role: reviewer
dependsOn: be
output: be-review.md

Review the backend output. Check authorization on every mutation, zod input/output completeness, contract surface (no internal types leaked), query efficiency. Conclude with `BE REVIEW: PASS` or `BE REVIEW: FAIL`.

## test
role: test-engineer
dependsOn: be-review
verify: true
output: test-report.md

Run backend tests for the feature (server + features packages). Use the feature Neon branch. Report exit codes and failing test names. Conclude `TEST: PASS` only on green.

## fe
role: flotter-fe
dependsOn: test
output: fe-summary.md

Goal: {goal}

Implement the frontend slice. Use only the contract files and tRPC types listed in earlier outputs — do not read backend implementation files. Handle loading, error, empty, and optimistic states.

## verify
role: verifier
dependsOn: fe
verify: true
output: verify.md

Run the frontend build / type check. Confirm the feature path works end to end with cached test results. Conclude `VERIFY: PASS` or `VERIFY: FAIL`.
