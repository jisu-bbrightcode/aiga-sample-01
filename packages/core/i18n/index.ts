// i18n 인스턴스 생성

// react-i18next에서 필요한 것들 re-export
export { I18nextProvider, useTranslation } from "react-i18next";
export { createI18n, getI18n, getOrCreateI18n } from "./create-i18n";
export { getTranslation } from "./get-translation";
export {
  detectNavigatorLanguage,
  LANG_STORAGE_KEY,
  languageAtom,
  useLanguage,
} from "./language-store";
// 타입
export type {
  I18nConfig,
  I18nInstance,
  I18nResources,
  Language,
  TranslationResources,
} from "./types";
// 번역 훅 및 함수
export { useFeatureTranslation } from "./use-feature-translation";
export type {
  UserFacingErrorMessageOptions,
  UserFacingTranslate,
} from "./user-facing-error";
export {
  getUserFacingErrorCode,
  getUserFacingErrorMessage,
} from "./user-facing-error";
