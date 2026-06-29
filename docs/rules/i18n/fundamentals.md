# i18n Fundamentals

Product Builder i18n 기본 구조. 라이브러리는 **i18next + react-i18next** 유지, 상태는 **jotai `atomWithStorage`**.

## 지원 언어

| 코드 | 이름 | 마스터 | 비고 |
|---|---|---|---|
| `ko` | 한국어 | ✅ | 사람이 작성 |
| `en` | English | 자동 | AI 번역 |
| `ja` | 日本語 | 자동 | AI 번역 |
| `zh` | 中文 (간체) | 자동 | AI 번역 |

확장: `packages/core/i18n/types.ts` 의 `Language` 타입 + `scripts/i18n/glossary.json` 키 + `language-store.ts` matcher 셋만 늘리면 된다.

## 부팅 흐름

```
[부팅 — 동기, React mount 전]
  apps/app/src/lib/feature-i18n.ts
    ├─ 1회 마이그 (atlas_language → language)
    └─ getOrCreateI18n({ defaultLanguage: getInitialLanguage(), resources, fallbackLanguage: "en" })

getInitialLanguage()
  1) localStorage.language       (사용자 명시 선택)
  2) navigator.languages         (사용자 환경 — 첫 방문)
  3) "en"                        (fallback)
```

`user_preferences.locale` (DB) 는 **사용하지 않는다**. 클라이언트 단일 진실의 원천 = `localStorage.language`.

## 상태 접근

| 용도 | 사용 |
|---|---|
| React 컴포넌트에서 언어 읽기/쓰기 | `const [lang, setLang] = useLanguage()` (`@repo/core/i18n`) |
| 번역 텍스트 사용 | `const { t } = useFeatureTranslation("auth")` |
| Provider 등록 | `<I18nextProvider i18n={i18n}>` (`apps/app/src/App.tsx` 이미 적용) |

## 파일 구조

```
packages/core/i18n/
  create-i18n.ts                   # getOrCreateI18n 싱글톤
  language-store.ts                # languageAtom + useLanguage hook + detectNavigatorLanguage
  use-feature-translation.ts       # useFeatureTranslation(namespace)
  get-translation.ts               # SSR/script-side 번역
  types.ts                         # Language 타입
  index.ts                         # public re-export

apps/app/src/
  lib/feature-i18n.ts              # 부팅 진입점 + resources 등록 + 1회 마이그
  pages/auth/locales/{ko,en,ja,zh}.json
  features/{name}/locales/{ko,en,ja,zh}.json
```

신규 feature locale 등록:
1. `apps/app/src/features/{name}/locales/{ko,en,ja,zh}.json` 생성.
2. `apps/app/src/features/{name}/locales/index.ts` 에서 4언어 re-export.
3. `apps/app/src/lib/feature-i18n.ts` 의 `resources` 객체에 namespace 추가.

## 키 네이밍

- 전 키 **camelCase**, dot-separated path.
- leaf 만 텍스트, 중간 노드는 그룹.
- placeholder = i18next 기본 `{{name}}`.
- 복수형 = i18next `_one` / `_other` suffix.

## namespace 규약

| 위치 | namespace | 예시 |
|---|---|---|
| `features/{name}/locales/` | `{name}` (kebab 그대로) | `document.toolbar.bold` |
| `packages/widgets/src/{name}/locales/` | `widget.{name}` | `widget.notification.empty` |
| `packages/ui/locales/` | `ui` | `ui.confirm.cancel` |
| `pages/{name}/locales/` | `page.{name}` | `page.settings.profileTab` |
| 기존 `auth` | `auth` (호환) | `auth.signIn.title` |
