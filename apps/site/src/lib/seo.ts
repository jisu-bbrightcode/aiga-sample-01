import type { Metadata } from "next";
import { siteConfig } from "@/config/site.config";

/**
 * Canonical origin for the public site. Prefer the deploy-time env var so the
 * same build can target preview/production domains; fall back to the brand URL
 * declared in `site.config.ts`. No trailing slash.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? siteConfig.seo.url).replace(
  /\/+$/,
  "",
);

/** Resolve a site-relative path to an absolute canonical URL. */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

const OG_LOCALE = siteConfig.locale === "ko" ? "ko_KR" : siteConfig.locale;

interface BuildMetadataInput {
  /** Page title (without the brand suffix — the layout template adds it). */
  title?: string;
  description?: string;
  /** Site-relative path used for the canonical + OG url. */
  path?: string;
  type?: "website" | "article" | "profile";
  /** Set true for thin/auth-only pages that should stay out of the index. */
  noIndex?: boolean;
}

/**
 * Single source of truth for per-page metadata: builds `title`, `description`,
 * `alternates.canonical`, Open Graph and Twitter card fields. The Open Graph
 * image is provided by the file-based `opengraph-image` convention, so it is
 * intentionally not set here (Next merges it in automatically).
 */
export function buildMetadata({
  title,
  description,
  path = "/",
  type = "website",
  noIndex,
}: BuildMetadataInput = {}): Metadata {
  const url = absoluteUrl(path);
  const desc = description ?? siteConfig.seo.description;
  const fullTitle = title
    ? `${title} · ${siteConfig.name}`
    : `${siteConfig.name} · ${siteConfig.seo.tagline}`;

  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type,
      url,
      siteName: siteConfig.name,
      title: fullTitle,
      description: desc,
      locale: OG_LOCALE,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: desc,
    },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
  };
}
