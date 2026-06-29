# biome-plugins

i18n 가드용 Biome v2 GritQL plugin 후보. **현재 비활성 — `detect-hardcoded.ts` 가 1차 가드.**

## 상태 (2026-05)

- Biome 2.4.12 GritQL plugin 은 compile pass 시점만 안정. `$str <: r"[가-힣]"` 형식의 정규식 매칭이 실행 단계에서 동작하지 않음을 POC 로 확인.
- `biome.json` 의 `plugins` 등록은 해제. `no-hardcoded-korean.grit` 파일은 차후 Biome 강화 시 재시도를 위해 보관.
- 그 사이 가드: `pnpm i18n:detect` (`scripts/i18n/detect-hardcoded.ts`).

## 재시도 조건

- Biome 가 GritQL 정규식 매칭 + 진단 emit 을 공식 지원 (release note 에 명시) 시.
- `biome.json` 에 `"plugins": ["./biome-plugins/no-hardcoded-korean.grit"]` 다시 추가 + `__fixtures__/korean-sample.ts` 로 동작 확인.

## 파일

- `no-hardcoded-korean.grit` — 한글 문자열 리터럴 매칭 GritQL 패턴 (현재 미동작).
- `__fixtures__/korean-sample.ts` — Biome 가 한글 리터럴을 감지하는지 확인하기 위한 회귀 픽스처.
