# i18n Guardrails

신규 작업 시 한글 리터럴 / 미번역 키가 새어 들어가지 않도록 막는 룰.

## 원칙

1. **`.tsx` / `.ts` 안에 한글 리터럴 금지.** 모든 사용자 노출 문자열은 `useFeatureTranslation` / `t()` 경유.
2. 예외 4종만 허용:
   - 주석 (line, block, JSDoc)
   - `console.*` 호출 인자
   - 테스트 파일 (`*.test.ts(x)`, `*.spec.ts(x)`)
   - `data-*` HTML 속성
3. 부득이한 경우 `// i18n-ignore-next-line` 주석으로 한 줄 옵트아웃 가능 — 이유를 동일 줄에 명시.
4. ko/en/ja/zh **키 셋은 항상 동일**. 새 키 추가는 ko 만 사람이 쓰고, en/ja/zh 는 `pnpm i18n:translate` 로 채운다.

## 사용자 노출 에러 문구 Iron Rule

사용자에게 전달되는 에러/실패/차단/재시도 문구는 i18n 작업 여부와 무관하게 항상 이 규칙을 따른다.

1. **raw message 금지** — `Error.message`, 서버 `message`, provider `reason`, `failureReason`, status code, token, request id, stack trace 를 UI에 그대로 표시하지 않는다.
2. **code 기반 매핑 필수** — 표시 문구는 안정적인 `code` / `errorCode` 를 i18n key 로 매핑하고, 알 수 없는 경우 친절한 fallback key 를 사용한다.
   - app: `apps/app/src/lib/user-facing-error.ts` 의 `getAppErrorMessage(...)`
   - widgets: `packages/widgets/src/common/user-facing-error.ts` 의 `getWidgetErrorMessage(...)`
   - shared/core: `packages/core/i18n/user-facing-error.ts`
3. **비기술적이고 친절한 톤** — “무엇이 막혔는지”와 “다음에 무엇을 하면 되는지”를 짧게 안내한다. HTTP/TRPC/provider/internal 용어는 금지.
4. **내부 전용 예외** — console/logging/analytics/debug metadata 처럼 사용자에게 렌더링되지 않는 경로는 기술 정보를 유지할 수 있다.
5. **완료 전 검색** — 사용자 노출 UI를 건드렸다면 아래 패턴이 새로 렌더링되지 않는지 확인한다.

```bash
rg -n '(error|err|result\.error|failureReason).*\.message|\.reason|String\((error|err)\)' apps/app/src packages/widgets/src --glob '!**/*.test.*' --glob '!**/*.spec.*' --glob '!**/locales/**'
```

## 검증 도구

| 도구 | 트리거 | 역할 | 상태 |
|---|---|---|---|
| `scripts/i18n/detect-hardcoded.ts` | `pnpm i18n:detect` | 한글 리터럴 1차 가드 — JSX/string/template literal/상수 객체 등 전부 | **active** |
| `scripts/i18n/verify-keys.ts` | `pnpm i18n:verify` | 4언어 키 셋 동기화 검증 — drift 발견 시 종료 코드 1 | **active** |
| Biome custom plugin | IDE / `pnpm lint` | JSX 텍스트 + 리터럴 실시간 경고 | **future** — `biome-plugins/README.md` 참조. Biome 2.4 GritQL 매칭 한계로 비활성. `detect-hardcoded.ts` 가 동일 영역 커버. |

CI 게이트에 강제 묶지 **않음** (과부담). 로컬 / PR 작성자 책임. PR 본문 체크리스트로 강제.

## 작업 시작 시 체크리스트 (스킬이 강제)

```
□ 새/수정 파일에 한글 리터럴이 있는가?
  ├─ Yes → useFeatureTranslation 추가 + locale 파일 ko.json 키 추가 → pnpm i18n:translate
  └─ No  → pass
□ feature/{name}/locales/ko.json 키 추가 시 ja/en/zh 도 동시 갱신했는가? (translate 스크립트로)
□ 사용자 노출 에러가 raw `message`/`reason` 대신 code 기반 helper + i18n fallback 을 사용하는가?
□ pnpm i18n:verify 통과하는가?
□ 변경된 화면에서 4개 언어 모두 깨지지 않는가? (overflow / 1줄 강제 깨짐 / 잘림)
```

## 옵트아웃

```tsx
// i18n-ignore-next-line — 디버그용 임시 로깅, 사용자 노출 아님
console.warn("저장 실패 — 캐시 invalidation 필요");
```

옵트아웃 코멘트는 PR 리뷰 시 반드시 1줄 사유 적힌 것만 허용.

## 자주 어기는 케이스

- **toast 메시지 함수 인자** — `toast.success("저장됨")` 같이 호출 인자에 한글이 박힌다. → `toast.success(t("save.done"))`.
- **상수 객체 label** — `const OPTIONS = [{ value: "ko", label: "한국어" }]` 처럼 표시되는 label. → `label: t("settings.locale.ko")`.
- **enum description** — 모달 description prop 에 한글. → `description={t(...)}`.
- **에러 메시지** — `throw new Error("프로젝트가 없습니다")` 가 toast 로 노출되면 한글로 사용자에 도달. → 노출 경로 별도로 i18n 처리.
- **raw 서버 원문** — `toast.error(error.message)`, `{result.error.message}`, `{log.failureReason}`. → `getAppErrorMessage(t, error, "errors.fallback")` 또는 feature 전용 i18n key.
