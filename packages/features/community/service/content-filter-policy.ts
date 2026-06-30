/**
 * Pure content-filter policy (PB-COMM-FILTER-API-001).
 *
 * URL/첨부 정책을 평가하는 순수 함수 모음. DB나 외부 호출 없이 콘텐츠 텍스트와
 * 커뮤니티 automod 설정만으로 위반 여부를 판정한다. 금칙어(keyword) 검사는
 * 기존 CommunityKeywordFilterService 가 담당하고, 이 모듈은 link/attachment
 * 정책과 최종 결정 병합(combine)을 책임진다.
 */
import type { AutomodConfig } from "@repo/drizzle/schema";

export type FilterRuleType = "keyword" | "link" | "attachment";

/** allow = 통과, block = 거부(생성 차단), review = 자동 숨김 후 검토 큐. */
export type FilterDecisionAction = "allow" | "block" | "review";

export interface FilterViolation {
  ruleType: FilterRuleType;
  action: "block" | "review";
  matchedTerms: string[];
  reason: string;
}

export interface FilterDecision {
  action: FilterDecisionAction;
  violations: FilterViolation[];
}

// http/https 링크만 정책 대상. 닫는 괄호/따옴표/공백을 경계로 잘라낸다.
const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

/** 텍스트 배열에서 http(s) URL 을 추출한다(중복 제거, 후행 구두점 제거). */
export function extractUrls(texts: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    const matches = text.match(URL_REGEX);
    if (!matches) continue;
    for (const raw of matches) {
      // 후행 구두점(. , ! ? ; :) 제거 — 문장 끝 링크 보정.
      const cleaned = raw.replace(/[.,!?;:]+$/, "");
      found.add(cleaned);
    }
  }
  return [...found];
}

/** URL 에서 호스트를 소문자로 추출하고 선행 `www.` 를 제거한다. 실패 시 null. */
export function getDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

/** 정책 리스트 항목 정규화: 소문자, 선행 www./점 제거. */
function normalizeDomainEntry(entry: string): string {
  return entry
    .trim()
    .toLowerCase()
    .replace(/^\*?\.*/, "")
    .replace(/^www\./, "");
}

/** domain 이 리스트에 매칭되는가(정확 일치 또는 서브도메인). */
function domainMatches(domain: string, list: string[]): boolean {
  return list.some((entry) => {
    const norm = normalizeDomainEntry(entry);
    if (!norm) return false;
    return domain === norm || domain.endsWith(`.${norm}`);
  });
}

/** configured action → 기본값 review(더 안전: 차단 대신 숨김 후 검토). */
export function resolveConfiguredAction(
  action: "block" | "review" | undefined,
): "block" | "review" {
  return action === "block" ? "block" : "review";
}

/** URL 정책 평가. 위반이 없으면 null. */
export function evaluateLinkPolicy(urls: string[], config: AutomodConfig): FilterViolation | null {
  if (!config.enableLinkFilter || urls.length === 0) return null;

  const policy = config.linkPolicy ?? "allow_all";
  if (policy === "allow_all") return null;

  let offending: string[];
  if (policy === "block_all") {
    offending = [...urls];
  } else {
    // domain_list: allowedDomains(화이트리스트)가 있으면 목록 밖 도메인을 차단,
    // blockedDomains(블랙리스트)에 속하면 차단.
    const allowed = config.allowedDomains ?? [];
    const blocked = config.blockedDomains ?? [];
    offending = urls.filter((url) => {
      const domain = getDomain(url);
      if (!domain) return true; // 파싱 불가 URL 은 보수적으로 위반 처리.
      if (allowed.length > 0 && !domainMatches(domain, allowed)) return true;
      if (domainMatches(domain, blocked)) return true;
      return false;
    });
  }

  if (offending.length === 0) return null;

  return {
    ruleType: "link",
    action: resolveConfiguredAction(config.linkFilterAction),
    matchedTerms: offending,
    reason: `허용되지 않은 링크: ${offending.join(", ")}`,
  };
}

/** URL/파일 경로에서 확장자를 추출한다(소문자, 점 제외). 없으면 null. */
export function getExtension(url: string): string | null {
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url.split("?")[0] ?? url;
    }
  })();
  const segment = path.split("/").pop() ?? "";
  const dot = segment.lastIndexOf(".");
  if (dot <= 0 || dot === segment.length - 1) return null;
  return segment.slice(dot + 1).toLowerCase();
}

/** allowedExtensions 화이트리스트 밖의 첨부를 찾아 매칭 토큰으로 반환한다. */
function findDisallowedAttachments(mediaUrls: string[], allowedExt: string[]): string[] {
  if (allowedExt.length === 0) return [];
  const offending: string[] = [];
  for (const url of mediaUrls) {
    const ext = getExtension(url);
    if (!ext || !allowedExt.includes(ext)) {
      offending.push(ext ? `.${ext}` : url);
    }
  }
  return offending;
}

/** 첨부(mediaUrls) 정책 평가. 위반이 없으면 null. */
export function evaluateAttachmentPolicy(
  mediaUrls: string[],
  config: AutomodConfig,
): FilterViolation | null {
  if (!config.enableAttachmentFilter || mediaUrls.length === 0) return null;

  const reasons: string[] = [];
  const matched = new Set<string>();

  if (typeof config.maxAttachments === "number" && mediaUrls.length > config.maxAttachments) {
    reasons.push(`첨부 개수 초과(${mediaUrls.length}/${config.maxAttachments})`);
    matched.add(`count:${mediaUrls.length}`);
  }

  const allowedExt = (config.allowedAttachmentExtensions ?? []).map((e) =>
    e.trim().toLowerCase().replace(/^\./, ""),
  );
  const disallowed = findDisallowedAttachments(mediaUrls, allowedExt);
  if (disallowed.length > 0) {
    for (const token of disallowed) matched.add(token);
    reasons.push("허용되지 않은 첨부 형식");
  }

  if (matched.size === 0) return null;

  return {
    ruleType: "attachment",
    action: resolveConfiguredAction(config.attachmentFilterAction),
    matchedTerms: [...matched],
    reason: reasons.join("; "),
  };
}

/** 여러 위반을 하나의 결정으로 병합. block 이 review 보다 우선한다. */
export function combineDecision(violations: Array<FilterViolation | null>): FilterDecision {
  const real = violations.filter((v): v is FilterViolation => v !== null);
  if (real.length === 0) return { action: "allow", violations: [] };
  const action: FilterDecisionAction = real.some((v) => v.action === "block") ? "block" : "review";
  return { action, violations: real };
}
