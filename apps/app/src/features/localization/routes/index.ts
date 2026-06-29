/**
 * Localization Feature Routes
 *
 * /p/$projectId/localization                → /localization/lore 로 redirect
 * /p/$projectId/localization/lore           → 세계관 번역
 * /p/$projectId/localization/glossary       → 용어 사전
 * /p/$projectId/localization/editor/$langId → 번역 에디터
 */

import type { AnyRoute } from "@tanstack/react-router";
import { createRoute, redirect } from "@tanstack/react-router";
import { type ComponentType, createElement, lazy, Suspense } from "react";
import { AppQuietLoadingState } from "@/components/app-loading";

const GlossaryPage = lazy(() =>
  import("../pages/glossary-page").then((m) => ({ default: m.GlossaryPage })),
);
const LoreTranslationPage = lazy(() =>
  import("../pages/lore-translation-page").then((m) => ({ default: m.LoreTranslationPage })),
);
const TranslationEditorPage = lazy(() =>
  import("../pages/translation-editor-page").then((m) => ({
    default: m.TranslationEditorPage,
  })),
);

export const LOCALIZATION_PATH = "/localization";

function PageFallback() {
  return createElement(AppQuietLoadingState, { label: "페이지 로딩 중..." });
}

function withSuspense<P extends object>(Cmp: ComponentType<P>) {
  return (props: P) =>
    createElement(Suspense, { fallback: createElement(PageFallback) }, createElement(Cmp, props));
}

const GlossaryPageS = withSuspense(GlossaryPage);
const LoreTranslationPageS = withSuspense(LoreTranslationPage);
const TranslationEditorPageS = withSuspense(TranslationEditorPage);

export function createLocalizationRoutes<T extends AnyRoute>(parentRoute: T) {
  // /localization 진입 시 세계관 번역으로 리다이렉트.
  const indexRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: "/localization",
    beforeLoad: ({ params }) => {
      throw redirect({
        to: "/p/$projectId/localization/lore",
        params: params as { projectId: string },
      });
    },
  });

  const loreRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: "/localization/lore",
    component: LoreTranslationPageS,
  });

  const glossaryRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: "/localization/glossary",
    component: GlossaryPageS,
  });

  const editorRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: "/localization/editor/$langId",
    component: TranslationEditorPageS,
  });

  return [indexRoute, loreRoute, glossaryRoute, editorRoute] as const;
}
