import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site.config";

/**
 * Default Open Graph / Twitter card image, generated at the edge. As a root
 * `opengraph-image`, Next applies it to every route that does not declare its
 * own — guaranteeing an `og:image` on all public pages with no binary asset.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = siteConfig.seo.ogImageAlt ?? siteConfig.name;

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color: "#f8fafc",
      }}
    >
      <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: "-0.02em" }}>
        {siteConfig.name}
      </div>
      <div style={{ marginTop: 24, fontSize: 40, color: "#94a3b8", maxWidth: 900 }}>
        {siteConfig.seo.tagline}
      </div>
    </div>,
    size,
  );
}
