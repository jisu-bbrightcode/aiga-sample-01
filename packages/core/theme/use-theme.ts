import { useAtom, useAtomValue } from "jotai";
import type { ThemeMode } from "./store";
import { resolvedThemeAtom, themeAtom } from "./store";

export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);
  const resolvedTheme = useAtomValue(resolvedThemeAtom);
  return { theme, setTheme, resolvedTheme };
}

export type { ThemeMode };
