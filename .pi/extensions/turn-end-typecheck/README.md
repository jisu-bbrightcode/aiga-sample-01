# turn-end-typecheck

PI extension. 한 turn 안에 `write/edit/multi_edit` 이 한 번이라도 실행되면, turn 끝에 typecheck 를 자동 실행한다.

## 동작

- 실패하면 `ctx.ui.notify` 로 에러 출력 + `pi.sendUserMessage(..., { deliverAs: "followUp" })` 로 다음 turn 의 첫 입력에 실패 로그 강제 주입. LLM 이 무시 못 함.
- 성공하면 상태바에 `typecheck ✓ (N.Ns)` 표시만.
- mutating 이 없었던 turn (질문/조사 등) 은 검사 안 함.

## 환경 변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `TYPECHECK_CMD` | `node scripts/check-types-app.mjs` | 실행할 명령. 기본값은 baseline이 green 인 패키지만 검사하는 wrapper. 전체 검사 원하면 `TYPECHECK_CMD="pnpm -w check-types"` 설정. |
| `TYPECHECK_TIMEOUT_MS` | `120000` | 실행 타임아웃 |
| `TYPECHECK_DEBOUNCE_MS` | `5000` | 직전 검사 후 이 시간 안에는 재실행 안 함 |

## 비활성화

`pi --extension '!turn-end-typecheck'` 또는 해당 디렉터리 임시 이름 변경.
