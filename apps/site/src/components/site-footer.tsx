import Link from "next/link";
import { siteConfig } from "@/config/site.config";

const FOOTER_LINKS: Array<{ label: string; href: string }> = [
  { label: "의사 찾기", href: "/doctors" },
  { label: "병원 찾기", href: "/hospitals" },
  { label: "서비스 소개", href: "/about" },
  { label: "이용 안내", href: "/pricing" },
];

/** Public footer — reinforces internal linking for crawlers and brand context. */
export function SiteFooter() {
  return (
    <footer className="border-border-subtle border-t">
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-foreground font-semibold">{siteConfig.name}</p>
          <p className="mt-1 max-w-prose">{siteConfig.seo.tagline}</p>
        </div>
        <nav aria-label="footer">
          <ul className="flex flex-wrap gap-4">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-foreground">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
