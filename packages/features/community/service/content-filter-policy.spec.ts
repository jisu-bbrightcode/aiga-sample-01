/**
 * content-filter-policy — pure URL/attachment policy unit tests (DB-free).
 */
import type { AutomodConfig } from "@repo/drizzle/schema";
import {
  combineDecision,
  evaluateAttachmentPolicy,
  evaluateLinkPolicy,
  extractUrls,
  getDomain,
  getExtension,
  resolveConfiguredAction,
} from "./content-filter-policy";

describe("extractUrls", () => {
  it("extracts http/https urls and dedupes", () => {
    const urls = extractUrls([
      "see https://a.com and http://b.com",
      "again https://a.com",
      null,
    ]);
    expect(urls.sort()).toEqual(["http://b.com", "https://a.com"]);
  });

  it("strips trailing punctuation", () => {
    expect(extractUrls(["go to https://example.com."])).toEqual(["https://example.com"]);
  });

  it("ignores non-http schemes and plain text", () => {
    expect(extractUrls(["mailto:x@y.com", "no links here", "ftp://z.com"])).toEqual([]);
  });
});

describe("getDomain", () => {
  it("lowercases host and strips www", () => {
    expect(getDomain("https://WWW.Example.com/path")).toBe("example.com");
  });
  it("returns null for unparseable", () => {
    expect(getDomain("not a url")).toBeNull();
  });
});

describe("getExtension", () => {
  it("extracts lowercased extension ignoring query", () => {
    expect(getExtension("https://cdn.x.com/a/b.PNG?v=1")).toBe("png");
  });
  it("returns null when no extension", () => {
    expect(getExtension("https://cdn.x.com/folder/")).toBeNull();
  });
});

describe("resolveConfiguredAction", () => {
  it("defaults to review", () => {
    expect(resolveConfiguredAction(undefined)).toBe("review");
    expect(resolveConfiguredAction("review")).toBe("review");
    expect(resolveConfiguredAction("block")).toBe("block");
  });
});

describe("evaluateLinkPolicy", () => {
  const urls = ["https://good.com/a", "https://evil.com/b"];

  it("returns null when filter disabled", () => {
    expect(evaluateLinkPolicy(urls, { linkPolicy: "block_all" })).toBeNull();
  });

  it("returns null for allow_all", () => {
    const cfg: AutomodConfig = { enableLinkFilter: true, linkPolicy: "allow_all" };
    expect(evaluateLinkPolicy(urls, cfg)).toBeNull();
  });

  it("block_all flags every url", () => {
    const cfg: AutomodConfig = { enableLinkFilter: true, linkPolicy: "block_all" };
    const v = evaluateLinkPolicy(urls, cfg);
    expect(v?.action).toBe("review");
    expect(v?.matchedTerms).toEqual(urls);
  });

  it("domain_list blacklist flags subdomains of blocked domain", () => {
    const cfg: AutomodConfig = {
      enableLinkFilter: true,
      linkPolicy: "domain_list",
      blockedDomains: ["evil.com"],
      linkFilterAction: "block",
    };
    const v = evaluateLinkPolicy(["https://sub.evil.com/x", "https://good.com"], cfg);
    expect(v?.action).toBe("block");
    expect(v?.matchedTerms).toEqual(["https://sub.evil.com/x"]);
  });

  it("domain_list whitelist flags anything outside allowedDomains", () => {
    const cfg: AutomodConfig = {
      enableLinkFilter: true,
      linkPolicy: "domain_list",
      allowedDomains: ["good.com"],
    };
    const v = evaluateLinkPolicy(urls, cfg);
    expect(v?.matchedTerms).toEqual(["https://evil.com/b"]);
  });

  it("returns null when nothing offends", () => {
    const cfg: AutomodConfig = {
      enableLinkFilter: true,
      linkPolicy: "domain_list",
      blockedDomains: ["nope.com"],
    };
    expect(evaluateLinkPolicy(["https://good.com"], cfg)).toBeNull();
  });
});

describe("evaluateAttachmentPolicy", () => {
  it("returns null when disabled", () => {
    expect(
      evaluateAttachmentPolicy(["https://x.com/a.exe"], { maxAttachments: 0 }),
    ).toBeNull();
  });

  it("flags exceeding maxAttachments", () => {
    const cfg: AutomodConfig = { enableAttachmentFilter: true, maxAttachments: 1 };
    const v = evaluateAttachmentPolicy(["https://x.com/a.png", "https://x.com/b.png"], cfg);
    expect(v?.ruleType).toBe("attachment");
    expect(v?.matchedTerms).toContain("count:2");
  });

  it("flags disallowed extensions", () => {
    const cfg: AutomodConfig = {
      enableAttachmentFilter: true,
      allowedAttachmentExtensions: ["png", "jpg"],
      attachmentFilterAction: "block",
    };
    const v = evaluateAttachmentPolicy(["https://x.com/a.png", "https://x.com/evil.exe"], cfg);
    expect(v?.action).toBe("block");
    expect(v?.matchedTerms).toEqual([".exe"]);
  });

  it("returns null when all attachments allowed", () => {
    const cfg: AutomodConfig = {
      enableAttachmentFilter: true,
      allowedAttachmentExtensions: ["png"],
      maxAttachments: 5,
    };
    expect(evaluateAttachmentPolicy(["https://x.com/a.png"], cfg)).toBeNull();
  });
});

describe("combineDecision", () => {
  it("allow when no violations", () => {
    expect(combineDecision([null, null])).toEqual({ action: "allow", violations: [] });
  });

  it("review when only review violations", () => {
    const d = combineDecision([
      { ruleType: "keyword", action: "review", matchedTerms: ["x"], reason: "r" },
      null,
    ]);
    expect(d.action).toBe("review");
    expect(d.violations).toHaveLength(1);
  });

  it("block dominates review", () => {
    const d = combineDecision([
      { ruleType: "keyword", action: "review", matchedTerms: ["x"], reason: "r" },
      { ruleType: "link", action: "block", matchedTerms: ["u"], reason: "r2" },
    ]);
    expect(d.action).toBe("block");
    expect(d.violations).toHaveLength(2);
  });
});
