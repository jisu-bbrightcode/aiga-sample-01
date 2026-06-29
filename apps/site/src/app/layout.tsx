import type { Metadata } from "next";
import "./globals.css";
import { ModuleProviders } from "@/components/module-providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/config/site.config";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${siteConfig.name} · ${siteConfig.seo.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.seo.description,
  keywords: siteConfig.seo.keywords,
  applicationName: siteConfig.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    locale: siteConfig.locale === "ko" ? "ko_KR" : siteConfig.locale,
    url: SITE_URL,
    title: `${siteConfig.name} · ${siteConfig.seo.tagline}`,
    description: siteConfig.seo.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} · ${siteConfig.seo.tagline}`,
    description: siteConfig.seo.description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={siteConfig.locale}>
      <body className="bg-background text-foreground flex min-h-dvh flex-col antialiased">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <ModuleProviders>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
          <SiteFooter />
        </ModuleProviders>
      </body>
    </html>
  );
}
