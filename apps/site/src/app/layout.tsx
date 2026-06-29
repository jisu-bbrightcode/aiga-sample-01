import type { Metadata } from "next";
import "./globals.css";
import { ModuleProviders } from "@/components/module-providers";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/config/site.config";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: "콘텐츠를 바로 제공하는 웹 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={siteConfig.locale}>
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <ModuleProviders>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        </ModuleProviders>
      </body>
    </html>
  );
}
