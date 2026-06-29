/**
 * Feature i18n
 *
 * 🤖 ATLAS CLI MANAGED
 * Feature 추가/제거 시 CLI가 이 파일을 업데이트합니다
 */
import { getOrCreateI18n } from "@repo/core/i18n";
// Feature locale imports
// [ATLAS:LOCALES_IMPORTS]
import * as authLocales from "../features/auth/locales";

// [/ATLAS:LOCALES_IMPORTS]

export const i18n = getOrCreateI18n({
  defaultLanguage: "ko",
  fallbackLanguage: "en",
  resources: {
    ko: {
      // [ATLAS:LOCALES_KO]
      auth: authLocales.ko,
      // [/ATLAS:LOCALES_KO]
    },
    en: {
      // [ATLAS:LOCALES_EN]
      auth: authLocales.en,
      // [/ATLAS:LOCALES_EN]
    },
    ja: {
      auth: authLocales.en,
    },
    zh: {
      auth: authLocales.en,
    },
  },
  debug: import.meta.env.DEV,
});
