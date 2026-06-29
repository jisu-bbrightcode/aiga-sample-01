import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useEffect } from "react";
import { getI18n } from "./create-i18n";
import type { Language } from "./types";

export const LANG_STORAGE_KEY = "language";

export function detectNavigatorLanguage(): Language {
  if (typeof navigator === "undefined") return "en";
  const tags = navigator.languages ?? (navigator.language ? [navigator.language] : []);
  for (const tag of tags) {
    const n = tag.toLowerCase();
    if (n.startsWith("ko")) return "ko";
    if (n.startsWith("en")) return "en";
    if (n.startsWith("ja")) return "ja";
    if (n.startsWith("zh")) return "zh";
  }
  return "en";
}

export const languageAtom = atomWithStorage<Language>(LANG_STORAGE_KEY, detectNavigatorLanguage());

export function useLanguage() {
  const [language, setLanguage] = useAtom(languageAtom);
  useEffect(() => {
    const i18n = getI18n();
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language]);
  return [language, setLanguage] as const;
}
