/**
 * Feature i18n
 *
 * 4언어 (ko/en/ja/zh) i18n 인스턴스 부트스트랩.
 * 우선순위:
 *   1) localStorage.language       (사용자가 명시 선택)
 *   2) navigator.languages         (사용자 환경 — 첫 방문)
 *   3) "en"                        (fallback)
 *
 * 신규 feature locale 등록은 아래 `resources` 객체에 직접 추가한다 (4언어 모두).
 */

import type { Language } from "@repo/core/i18n";
import { getOrCreateI18n, LANG_STORAGE_KEY } from "@repo/core/i18n";
import * as identityVerificationLocales from "../features/identity-verification/locales";
import * as storyLocales from "../features/story/locales";
import * as appLocales from "../locales";
import * as authLocales from "../pages/auth/locales";
import * as designSystemLocales from "../pages/designsystem/locales";
import * as settingsLocales from "../pages/settings/locales";

// 1회 마이그레이션: atlas_language → language (2026-05 도입)
// 일정 기간 후 제거 가능.
if (typeof window !== "undefined") {
  try {
    const legacy = window.localStorage.getItem("atlas_language");
    if (legacy && !window.localStorage.getItem(LANG_STORAGE_KEY)) {
      window.localStorage.setItem(LANG_STORAGE_KEY, legacy);
    }
    if (legacy !== null) {
      window.localStorage.removeItem("atlas_language");
    }
  } catch {
    // localStorage 접근 실패는 무시 (SSR / 권한 차단 등).
  }
}

function toSupportedLanguage(value: string | null | undefined): Language | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.startsWith("ko")) return "ko";
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("zh")) return "zh";
  return null;
}

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";

  const savedLanguage = toSupportedLanguage(window.localStorage.getItem(LANG_STORAGE_KEY));
  if (savedLanguage) return savedLanguage;

  if (typeof navigator !== "undefined") {
    for (const language of navigator.languages ?? [navigator.language]) {
      const supportedLanguage = toSupportedLanguage(language);
      if (supportedLanguage) return supportedLanguage;
    }
  }

  return "en";
}

export const i18n = getOrCreateI18n({
  defaultLanguage: getInitialLanguage(),
  fallbackLanguage: "en",
  resources: {
    ko: {
      auth: authLocales.ko,
      app: appLocales.ko,
      "feature.story": storyLocales.ko,
      "feature.identityVerification": identityVerificationLocales.ko,
      "page.designsystem": designSystemLocales.ko,
      "page.settings": settingsLocales.ko,
    },
    en: {
      auth: authLocales.en,
      app: appLocales.en,
      "feature.story": storyLocales.en,
      "feature.identityVerification": identityVerificationLocales.en,
      "page.designsystem": designSystemLocales.en,
      "page.settings": settingsLocales.en,
    },
    ja: {
      auth: authLocales.ja,
      app: appLocales.ja,
      "feature.story": storyLocales.ja,
      "feature.identityVerification": identityVerificationLocales.ja,
      "page.designsystem": designSystemLocales.ja,
      "page.settings": settingsLocales.ja,
    },
    zh: {
      auth: authLocales.zh,
      app: appLocales.zh,
      "feature.story": storyLocales.zh,
      "feature.identityVerification": identityVerificationLocales.zh,
      "page.designsystem": designSystemLocales.zh,
      "page.settings": settingsLocales.zh,
    },
  },
  debug: import.meta.env.DEV,
});
