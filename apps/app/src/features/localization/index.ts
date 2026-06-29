/**
 * Localization Feature — Client Entry Point
 */

export { AddLanguageDialog } from "./components/add-language-dialog";
export { GlossaryTable } from "./components/glossary-table";
export {
  useBulkUpdateTranslations,
  useCreateGlossaryEntry,
  useCreateLanguage,
  useDeleteGlossaryEntry,
  useUpdateGlossaryEntry,
  useUpdateLanguage,
  useUpdateTranslation,
} from "./hooks/use-localization-mutations";
export {
  useGlossary,
  useGlossaryEntry,
  useLanguage,
  useLanguages,
  useTranslation,
  useTranslationProgress,
  useTranslations,
} from "./hooks/use-localization-queries";
export { GlossaryPage } from "./pages/glossary-page";
export { LoreTranslationPage } from "./pages/lore-translation-page";
export { TranslationEditorPage } from "./pages/translation-editor-page";
export {
  createLocalizationRoutes,
  LOCALIZATION_PATH,
} from "./routes";
