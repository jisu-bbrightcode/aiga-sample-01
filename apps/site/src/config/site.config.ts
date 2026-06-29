import type { SiteConfig } from "@/modules/types";

/**
 * Assembly manifest — the single file the builder edits to compose a product.
 * Flip a module's `enabled`, or toggle an auth provider, and the app
 * recomposes with no other code changes. Brand + SEO copy live here so the
 * public pages, metadata and structured data all read from one source.
 */
export const siteConfig: SiteConfig = {
  name: "AIGA",
  locale: "ko",
  seo: {
    url: "https://aiga.kr",
    tagline: "믿을 수 있는 의사·병원 큐레이션",
    description:
      "AIGA는 진료과·지역별로 검증된 의사와 병원을 큐레이션해 보여주는 의료 정보 서비스입니다. 회원가입 없이 의사·병원 정보를 탐색하고, 저장·예약 같은 액션에서만 로그인하세요.",
    keywords: [
      "의사 찾기",
      "병원 찾기",
      "명의",
      "진료과별 병원",
      "지역별 병원",
      "의료 큐레이션",
      "AIGA",
    ],
    ogImageAlt: "AIGA — 믿을 수 있는 의사·병원 큐레이션",
  },
  modules: {
    auth: {
      enabled: true,
      providers: {
        email: true,
        google: true,
        magicLink: true,
      },
    },
    // community: { enabled: false },  // reserved — added in a later increment
  },
};
