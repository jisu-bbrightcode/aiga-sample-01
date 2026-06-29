---
name: 'build'
description: 'Product Builder 일반 구현 작업 진입 — Hana(Coordinator) 가 미션 brief 작성 후 Kai(Builder) + Remy/Vera(Critic) fan-out. UI/Backend/DB/테스트/문서 공통. 트리거: /build'
---

# /build

Product Builder 일반 구현 진입점. Hana → Kai + Critic 프로토콜.

라우팅 소스 오브 트루스: `AGENTS.md`와 `docs/reference/`

## 진입 절차

1. **미션 brief 작성** — `docs/cos-v2/mission-brief.template.md` 11 필드 기준
2. **직접 문서 참조 선택**:

| 파일 범위 | 직접 참조 |
|---|---|
| React UI (`apps/**/components/**`, `packages/ui/**`) | `docs/rules/frontend/`, `docs/reference/` |
| Backend (`apps/api/**`, `server/**`) | `docs/rules/backend/`, `docs/reference/server-registry.md` |
| DB / Schema (`packages/db/**`, `**/schema/**`) | `docs/reference/database-schema.md` |
| CI / 배포 | `docs/runbooks/`, `.github/workflows/` |
| AI Gateway | `docs/reference/`, provider-specific docs |
| 문서 / 스크립트 | (생략 가능) |

3. **Agent tool 로 Kai spawn** — `subagent_type: cos-builder`
4. **완료 후 병렬 Critic fan-out**:
   - Remy (`cos-critic-static`) — 필수
   - Vera (`cos-critic-dynamic`) — 동작 변경 있을 때
   - Zion (`cos-ui-verifier`) — UI artifact
   - Blitz (`cos-perf-checker`) — perf 영향
5. **Hana 가 verdict 통합** — P1 any = block

## 금지

- ❌ 은퇴 에이전트 호출 (`frontend-implementer`, `backend-implementer`, `schema-implementer`, `unit-tester`, `browser-tester` 등)
- ❌ Critic 생략 — 단독 Builder 완료 금지

## 참조

- `AGENTS.md` — 실행 프로토콜과 Product Builder 정책
- `docs/cos-v2/agent-roles.md` — 역할 규약
- `docs/cos-v2/mission-brief.template.md` — brief 템플릿
