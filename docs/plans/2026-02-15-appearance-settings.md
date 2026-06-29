# Appearance Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 테마(Light/Dark/System)와 언어(ko/en)를 전환할 수 있는 설정 모달 구현

**Architecture:** `packages/core/theme/`에 테마 인프라(Jotai atom + ThemeProvider)를 만들고, `apps/app/src/features/settings/`에 Widget Feature로 설정 모달 UI를 구현. FOUC 방지 인라인 스크립트 + 기존 i18n 인프라 활용.

**Tech Stack:** Jotai (atomWithStorage), Tailwind CSS (.dark 클래스), i18next, shadcn/ui (Dialog, Select), lucide-react

**Design Doc:** `docs/plans/2026-02-15-appearance-settings-design.md`

---

### Task 1: 테마 인프라 — Jotai Atom + Hook

`packages/core/theme/`에 테마 상태 관리 모듈을 생성합니다. `atomWithStorage`로 localStorage 연동하고, system 모드일 때 OS 설정을 해석하는 derived atom을 만듭니다.

**Files:**
- Create: `packages/core/theme/store.ts`
- Create: `packages/core/theme/use-theme.ts`
- Create: `packages/core/theme/index.ts`
- Modify: `packages/core/package.json`

**Step 1: store.ts 생성**

```typescript
// packages/core/theme/store.ts
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";

/**
 * 사용자가 선택한 테마 모드 (localStorage 연동)
 */
export const themeAtom = atomWithStorage<ThemeMode>(THEME_STORAGE_KEY, "system");

/**
 * system 모드일 때 OS 설정을 해석한 실제 테마
 * - light/dark: 그대로 반환
 * - system: matchMedia로 OS 설정 확인
 */
export const resolvedThemeAtom = atom<"light" | "dark">((get) => {
  const theme = get(themeAtom);
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
});
```

**Step 2: use-theme.ts 생성**

```typescript
// packages/core/theme/use-theme.ts
import { useAtom, useAtomValue } from "jotai";
import { themeAtom, resolvedThemeAtom } from "./store";
import type { ThemeMode } from "./store";

export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);
  const resolvedTheme = useAtomValue(resolvedThemeAtom);

  return { theme, setTheme, resolvedTheme };
}

export type { ThemeMode };
```

**Step 3: index.ts 생성**

```typescript
// packages/core/theme/index.ts
export { themeAtom, resolvedThemeAtom, THEME_STORAGE_KEY } from "./store";
export type { ThemeMode } from "./store";
export { useTheme } from "./use-theme";
```

**Step 4: package.json에 export 추가**

`packages/core/package.json`의 `exports`에 추가:

```json
"./theme": "./theme/index.ts"
```

**Step 5: 빌드 확인**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 6: 커밋**

```bash
git add packages/core/theme/ packages/core/package.json
git commit -m "feat(core): 테마 인프라 — themeAtom, resolvedThemeAtom, useTheme"
```

---

### Task 2: ThemeProvider 컴포넌트

`resolvedThemeAtom` 값에 따라 `document.documentElement`에 `.dark` 클래스를 토글하는 Provider를 만듭니다. OS 설정 변경 감지(system 모드)도 포함.

**Files:**
- Create: `packages/core/theme/theme-provider.tsx`
- Modify: `packages/core/theme/index.ts`

**Step 1: theme-provider.tsx 생성**

```typescript
// packages/core/theme/theme-provider.tsx
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { themeAtom, resolvedThemeAtom } from "./store";

interface Props {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: Props) {
  const theme = useAtomValue(themeAtom);
  const resolvedTheme = useAtomValue(resolvedThemeAtom);

  // .dark 클래스 토글
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [resolvedTheme]);

  // system 모드일 때 OS 설정 변경 감지
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      if (e.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  return <>{children}</>;
}
```

**Step 2: index.ts에 export 추가**

`packages/core/theme/index.ts`에 추가:

```typescript
export { ThemeProvider } from "./theme-provider";
```

**Step 3: 빌드 확인**

Run: `cd packages/core && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 4: 커밋**

```bash
git add packages/core/theme/
git commit -m "feat(core): ThemeProvider — .dark 클래스 토글 + OS 설정 변경 감지"
```

---

### Task 3: FOUC 방지 + App에 ThemeProvider 연결

페이지 로드 시 테마 깜빡임 방지를 위해 `index.html`에 인라인 스크립트를 추가하고, `App.tsx`에 `ThemeProvider`를 연결합니다.

**Files:**
- Modify: `apps/app/index.html`
- Modify: `apps/app/src/App.tsx`

**Step 1: index.html에 FOUC 방지 스크립트 추가**

`apps/app/index.html`의 `<head>` 끝에 인라인 스크립트 추가 (`</head>` 바로 위):

```html
    <script>
      (function() {
        try {
          var raw = localStorage.getItem('theme');
          var theme = raw ? JSON.parse(raw) : 'system';
          var isDark = theme === '"dark"' || theme === 'dark' ||
            (theme !== '"light"' && theme !== 'light' &&
             window.matchMedia('(prefers-color-scheme: dark)').matches);
          if (isDark) document.documentElement.classList.add('dark');
        } catch(e) {}
      })();
    </script>
```

> **주의**: `atomWithStorage`는 값을 JSON.stringify하여 저장하므로, localStorage에는 `"system"` (따옴표 포함)으로 저장됩니다. `JSON.parse`로 읽어야 합니다.

**Step 2: App.tsx에 ThemeProvider 추가**

`apps/app/src/App.tsx`를 수정:

```typescript
// import 추가
import { ThemeProvider } from "@repo/core/theme";

// App 컴포넌트에서 JotaiProvider 안, HydrateAtoms 다음에 ThemeProvider 래핑
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <JotaiProvider>
          <HydrateAtoms>
            <ThemeProvider>
              <AuthSync>
                <RouterProvider router={router} />
                <Toaster position="top-right" richColors />
              </AuthSync>
            </ThemeProvider>
          </HydrateAtoms>
        </JotaiProvider>
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

**Step 3: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 4: 커밋**

```bash
git add apps/app/index.html apps/app/src/App.tsx
git commit -m "feat(app): FOUC 방지 스크립트 + ThemeProvider 연결"
```

---

### Task 4: 설정 모달 UI — Widget Feature

`apps/app/src/features/settings/`에 설정 모달을 구현합니다. 테마 선택(3개 카드 버튼)과 언어 선택(Select 드롭다운)을 포함.

**Files:**
- Create: `apps/app/src/features/settings/hooks/use-settings-modal.ts`
- Create: `apps/app/src/features/settings/components/theme-selector.tsx`
- Create: `apps/app/src/features/settings/components/language-selector.tsx`
- Create: `apps/app/src/features/settings/components/settings-modal.tsx`
- Create: `apps/app/src/features/settings/index.ts`

**Step 1: use-settings-modal.ts 생성**

```typescript
// apps/app/src/features/settings/hooks/use-settings-modal.ts
import { atom, useAtom } from "jotai";

const settingsModalOpenAtom = atom(false);

export function useSettingsModal() {
  const [open, setOpen] = useAtom(settingsModalOpenAtom);
  return { open, setOpen };
}

export { settingsModalOpenAtom };
```

**Step 2: theme-selector.tsx 생성**

```typescript
// apps/app/src/features/settings/components/theme-selector.tsx
import { useTheme } from "@repo/core/theme";
import type { ThemeMode } from "@repo/core/theme";
import { cn } from "@repo/ui/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";

interface Props {}

export function ThemeSelector({}: Props) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">테마</label>
      <div className="grid grid-cols-3 gap-3">
        {THEME_OPTIONS.map((option) => (
          <ThemeCard
            key={option.value}
            icon={option.icon}
            label={option.label}
            selected={theme === option.value}
            onClick={() => setTheme(option.value)}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Components
 * -----------------------------------------------------------------------------------------------*/

interface ThemeCardProps {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}

function ThemeCard({ icon, label, selected, onClick }: ThemeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-colors",
        selected
          ? "border-primary ring-2 ring-primary bg-primary/5"
          : "border-border hover:bg-muted/30",
      )}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------------------------*/

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: "light", label: "Light", icon: <Sun className="size-5" /> },
  { value: "dark", label: "Dark", icon: <Moon className="size-5" /> },
  { value: "system", label: "System", icon: <Monitor className="size-5" /> },
];
```

**Step 3: language-selector.tsx 생성**

```typescript
// apps/app/src/features/settings/components/language-selector.tsx
import { useTranslation } from "@repo/core/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";

interface Props {}

export function LanguageSelector({}: Props) {
  const { i18n } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">언어</label>
      <Select
        value={i18n.language}
        onValueChange={(value) => i18n.changeLanguage(value)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------------------------*/

const LANGUAGE_OPTIONS = [
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
];
```

**Step 4: settings-modal.tsx 생성**

```typescript
// apps/app/src/features/settings/components/settings-modal.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/shadcn/dialog";
import { useSettingsModal } from "../hooks/use-settings-modal";
import { ThemeSelector } from "./theme-selector";
import { LanguageSelector } from "./language-selector";

interface Props {}

export function SettingsModal({}: Props) {
  const { open, setOpen } = useSettingsModal();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>설정</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6 py-2">
          <ThemeSelector />
          <LanguageSelector />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 5: index.ts 생성**

```typescript
// apps/app/src/features/settings/index.ts
export { SettingsModal } from "./components/settings-modal";
export { useSettingsModal, settingsModalOpenAtom } from "./hooks/use-settings-modal";
```

**Step 6: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 7: 커밋**

```bash
git add apps/app/src/features/settings/
git commit -m "feat(settings): 설정 모달 UI — 테마 선택 + 언어 선택"
```

---

### Task 5: 앱에 설정 모달 연결

`AppShell01` 헤더의 사용자 DropdownMenu에 "설정" 항목을 추가하고, `SettingsModal`을 레이아웃에 마운트합니다.

**Files:**
- Modify: `apps/app/src/layouts/blocks/app-shell-01.tsx`

**Step 1: import 추가 및 DropdownMenu에 설정 항목 추가**

`apps/app/src/layouts/blocks/app-shell-01.tsx`를 수정합니다.

import 추가:
```typescript
import { Settings } from "lucide-react";
import { SettingsModal, useSettingsModal } from "@features/settings";
```

`AppShellHeader` 함수 내에 `useSettingsModal` 추가:
```typescript
const { setOpen: setSettingsOpen } = useSettingsModal();
```

DropdownMenu의 `Profile` 항목과 `Separator` 사이에 "설정" 항목 추가:
```typescript
<DropdownMenuItem onClick={() => setSettingsOpen(true)} className="cursor-pointer">
  <Settings className="mr-2 size-4" />
  설정
</DropdownMenuItem>
```

`AppShell01` 함수의 `</SidebarProvider>` 직전에 `SettingsModal` 추가:
```typescript
<SettingsModal />
```

**Step 2: 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 3: 커밋**

```bash
git add apps/app/src/layouts/blocks/app-shell-01.tsx
git commit -m "feat(app): 사용자 메뉴에 설정 항목 추가 + SettingsModal 마운트"
```

---

### Task 6: system-admin에도 ThemeProvider + 설정 연결

`apps/system-admin`에도 동일하게 ThemeProvider와 FOUC 방지를 적용합니다.

**Files:**
- Modify: `apps/system-admin/index.html`
- Modify: `apps/system-admin/src/App.tsx` (또는 메인 진입점)

**Context:** system-admin의 구조를 먼저 확인하고 apps/app과 동일한 패턴으로 ThemeProvider를 추가합니다. 설정 모달은 system-admin에서도 필요하면 동일 패턴으로 추가하되, 이 Task에서는 ThemeProvider 연결만 수행합니다.

**Step 1: system-admin 진입점 확인**

`apps/system-admin/src/App.tsx` 또는 `apps/system-admin/src/main.tsx`를 읽어서 구조를 파악합니다.

**Step 2: index.html에 FOUC 방지 스크립트 추가**

Task 3과 동일한 인라인 스크립트를 `apps/system-admin/index.html`의 `<head>` 끝에 추가합니다.

**Step 3: App.tsx에 ThemeProvider 추가**

```typescript
import { ThemeProvider } from "@repo/core/theme";
// JotaiProvider 안, 최상위에 ThemeProvider 래핑
```

**Step 4: 빌드 확인**

Run: `cd apps/system-admin && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 5: 커밋**

```bash
git add apps/system-admin/
git commit -m "feat(system-admin): ThemeProvider + FOUC 방지 스크립트 적용"
```

---

### Task 7: 전체 빌드 검증

모든 패키지/앱에 대해 TypeScript 빌드를 검증합니다.

**Step 1: 전체 빌드**

```bash
cd packages/core && pnpm tsc --noEmit
cd apps/app && pnpm tsc --noEmit
cd apps/system-admin && pnpm tsc --noEmit
```

Expected: 모두 에러 없음

**Step 2: git status 확인**

설정 관련 파일만 변경되었는지 확인합니다.

**Step 3: 최종 커밋 (필요 시)**

빌드 중 수정이 있었다면 추가 커밋.
