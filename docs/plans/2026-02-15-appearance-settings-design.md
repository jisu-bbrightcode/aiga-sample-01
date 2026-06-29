# Appearance 설정 디자인 문서

> **Feature:** settings (Widget Feature)
> **날짜:** 2026-02-15
> **상태:** 승인 완료

## 목표

앱 어디서든 열 수 있는 설정 모달을 통해 테마(Light/Dark/System)와 언어(한국어/English)를 전환할 수 있는 기본 Appearance 기능 제공.

## 핵심 결정사항

| 항목 | 결정 |
|------|------|
| Feature 타입 | Widget Feature (라우트 없음, 모달 UI) |
| 설정 항목 | 테마 (Light/Dark/System) + 언어 (ko/en) |
| 저장 방식 | localStorage만 (DB 없음) |
| 상태 관리 | Jotai atom (localStorage 연동) |
| 테마 기본값 | System (OS 설정 따라감) |
| 언어 기본값 | 한국어 |
| 적용 방식 | 변경 즉시 적용 (저장 버튼 없음) |

## 아키텍처

### 패키지 구조

```
packages/core/theme/           ← 테마 인프라 (atom, provider, hook)
├── index.ts                   # public exports
├── store.ts                   # themeAtom, resolvedThemeAtom
├── theme-provider.tsx         # ThemeProvider (html .dark 클래스 관리)
└── use-theme.ts               # useTheme hook

apps/app/src/features/settings/  ← 설정 모달 UI (Widget Feature)
├── index.ts
├── components/
│   ├── settings-modal.tsx     # Dialog 컴포넌트
│   ├── theme-selector.tsx     # 3개 카드 버튼
│   └── language-selector.tsx  # Select 드롭다운
└── hooks/
    └── use-settings-modal.ts  # 모달 open/close atom
```

### 기존 인프라 활용

- **다크모드 CSS**: `apps/app/src/styles.css`에 `.dark` 클래스 + oklch 색상 변수 이미 정의됨
- **i18n**: i18next 프레임워크 + `useFeatureTranslation` 훅 이미 존재
- **Jotai**: 프로젝트 전체에서 사용 중

## 상태 관리

```typescript
// packages/core/theme/store.ts
type ThemeMode = "light" | "dark" | "system";

// localStorage "theme" 키와 연동
const themeAtom = atomWithStorage<ThemeMode>("theme", "system");

// system일 때 OS 설정 해석한 실제 테마
const resolvedThemeAtom = atom<"light" | "dark">((get) => {
  const theme = get(themeAtom);
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
});
```

```typescript
// 언어는 기존 i18n 인프라 활용
// i18n.changeLanguage("ko" | "en")
// localStorage "language" 키에 자동 저장
```

## UI 설계

### 모달 레이아웃

```
┌─────────────────────────────────────┐
│ 설정                            [✕] │
├─────────────────────────────────────┤
│                                     │
│ 테마                                │
│ ┌─────────┐┌─────────┐┌──────────┐ │
│ │ ☀ Light ││ 🌙 Dark ││ 💻 System│ │
│ └─────────┘└─────────┘└──────────┘ │
│                                     │
│ 언어                                │
│ ┌─────────────────────────────────┐ │
│ │ 한국어                        ▾ │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### 테마 선택 (ThemeSelector)

- 3개 카드 버튼 가로 배치 (`grid grid-cols-3 gap-3`)
- 각 카드: 아이콘 + 라벨, `rounded-lg border p-3`
- 선택된 카드: `ring-2 ring-primary border-primary`
- 미선택 카드: `border-border hover:bg-muted/30`
- 아이콘: Sun (Light), Moon (Dark), Monitor (System) — lucide-react

### 언어 선택 (LanguageSelector)

- shadcn/ui Select 컴포넌트
- 옵션: 한국어, English
- 변경 시 `i18n.changeLanguage()` 즉시 호출

### 진입점

앱 헤더/사이드바의 사용자 아바타 DropdownMenu에 "설정" 항목 추가.

```typescript
// 기존 사용자 메뉴에 추가
<DropdownMenuItem onClick={() => setSettingsOpen(true)}>
  <Settings className="size-4" />
  설정
</DropdownMenuItem>
```

## ThemeProvider

```typescript
// packages/core/theme/theme-provider.tsx
// resolvedThemeAtom 값에 따라 document.documentElement에 .dark 클래스 토글
// useEffect로 matchMedia change 이벤트 리스닝 (system 모드일 때)
```

### Provider 연결

```typescript
// apps/app/src/main.tsx (또는 root layout)
<ThemeProvider>
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>
</ThemeProvider>
```

## 데이터 흐름

```
사용자가 테마 변경
  → themeAtom 업데이트
  → localStorage에 자동 저장
  → resolvedThemeAtom 재계산
  → ThemeProvider가 .dark 클래스 토글
  → CSS 변수 자동 전환

사용자가 언어 변경
  → i18n.changeLanguage() 호출
  → localStorage에 자동 저장
  → 모든 useFeatureTranslation 훅 자동 리렌더
```

## FOUC 방지

페이지 로드 시 테마 깜빡임 방지를 위해 `index.html`의 `<head>`에 인라인 스크립트 추가:

```html
<script>
  (function() {
    const theme = localStorage.getItem('theme');
    const isDark = theme === 'dark' ||
      (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) document.documentElement.classList.add('dark');
  })();
</script>
```
