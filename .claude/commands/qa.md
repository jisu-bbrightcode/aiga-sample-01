---
name: 'qa'
description: '수동 QA 실행 — Hana 가 Vera(Dynamic Critic) + Remy(Static Critic) + Zion(UI) 병렬 spawn, 결과 통합 보고. 트리거: /qa'
---

# /qa

Product Builder QA 를 대화 중에 수동 실행하는 진입점.

이 커맨드는 **수동 요청** (특정 PR / 특정 이슈) 전용.

## 동작 (Hana → Critic fan-out)

1. **입력 파싱** — PR / 이슈 ID / URL → branch + SHA 해석
2. **준비** — checkout + DB reset + dev server 기동 (필요 시)
3. **병렬 Critic fan-out** — Hana 가 동시 spawn:
   - **Remy** (`cos-critic-static`) — diff 정적 리뷰, lint, typecheck, security scan
   - **Vera** (`cos-critic-dynamic`) — test runner, API 호출, DB 조회, 시나리오 실행
   - **Zion** (`cos-ui-verifier`) — Playwright 시각/인터랙션 검증 (UI 변경일 때)
   - **Blitz** (`cos-perf-checker`) — bench harness (성능 영향일 때)
4. **verdict 통합** — Hana 가 P1/P2 종합, evidence 첨부
5. **보고** — 스크린샷 + Linear 코멘트 + 라벨 업데이트

## 사용 예

```
/qa ISSUE-123
/qa https://linear.app/bbright/issue/FLE-456
/qa PR #789
```

## 규칙

- **Critic 독립성** — Remy/Vera/Zion 은 서로 artifact 공유 금지, 병렬 spawn 필수
- **P1 any = block** — 한 명이라도 P1 내면 PR 머지 금지, 다수결 금지
- **Evidence 필수** — verdict 말로만 하면 무효, 로그/스크린샷/라인번호 첨부

## 금지

- ❌ 은퇴 에이전트 호출 — `qa-lead`, `feature-reviewer`, `browser-tester`, `perf-tester`, `unit-tester`, `design-tester`, `qa-team`
- ❌ Critic 순차 spawn — 반드시 병렬
- ❌ Builder 자기보고 채택 — Critic verdict 로만 판단

## 참조

- `AGENTS.md` — 실행 프로토콜과 Product Builder 정책
- `CLAUDE.md` — 프로젝트 규칙
- `docs/cos-v2/agent-roles.md` — Critic 독립성 6 규칙
