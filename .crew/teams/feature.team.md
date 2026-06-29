---
name: feature
description: Flotter feature delivery team — infra/backend/frontend separated
defaultWorkflow: feature-flow
workspaceMode: single
maxConcurrency: 1
---

- infra: agent=flotter-infra Neon branch + drizzle migration + env
- infra-reviewer: agent=reviewer review infra changes (PASS/FAIL)
- be: agent=flotter-be tRPC router + service + contract export
- be-reviewer: agent=reviewer review backend + contract surface (PASS/FAIL)
- test-engineer: agent=test-engineer backend tests on feature Neon branch
- fe: agent=flotter-fe UI built on exported contracts only
- verifier: agent=verifier final build / type check
