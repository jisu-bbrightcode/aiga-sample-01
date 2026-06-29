import posthog from "posthog-js";
import { sanitize } from "./sanitize";

/** alias 추적 플래그의 localStorage 키 — 앱 prefix 로 PostHog 내부 키와 구분 */
export function aliasFlagKey(anonId: string): string {
  return `product_builder_posthog_alias_done_${anonId}`;
}

/** alias 를 호출해야 하는가 — 익명 id 가 userId 와 다르고, 아직 alias 안 했을 때만 */
export function shouldAlias(
  anonId: string,
  userId: string,
  hasAliased: (anonId: string) => boolean,
): boolean {
  if (anonId === userId) return false;
  return !hasAliased(anonId);
}

function hasAliased(anonId: string): boolean {
  try {
    return localStorage.getItem(aliasFlagKey(anonId)) != null;
  } catch {
    return false; // storage 차단 — alias 안 했다고 간주 (매번 시도하지만 무해)
  }
}

function setAliasFlag(anonId: string): void {
  try {
    localStorage.setItem(aliasFlagKey(anonId), "1");
  } catch {
    // storage 차단 — 플래그 저장 실패. alias 가 다음 로그인에 재시도되지만 posthog.alias 자체는 무해
  }
}

function getAnonymousDistinctId(): string {
  return posthog.get_distinct_id();
}

function aliasAnonymousIdOnce(userId: string, anonId: string): void {
  if (!shouldAlias(anonId, userId, hasAliased)) return;
  posthog.alias(userId, anonId);
  setAliasFlag(anonId);
}

/**
 * 로그인 시 호출. 익명 → 로그인 동선을 alias 로 1회 연결한 뒤 identify.
 * 절대 throw 하지 않는다.
 */
export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    const anonId = getAnonymousDistinctId();
    if (anonId) aliasAnonymousIdOnce(userId, anonId);
    posthog.identify(userId, sanitize(properties));
  } catch {
    // swallow
  }
}

/**
 * 로그아웃 시 호출. posthog.reset() → 새 익명 id 발급 →
 * 다음 로그인은 새 alias 대상이 된다 (공유 브라우저 안전).
 */
export function resetUser(): void {
  if (typeof window === "undefined") return;
  try {
    const anonId = posthog.get_distinct_id();
    if (anonId) {
      try {
        localStorage.removeItem(aliasFlagKey(anonId));
      } catch {
        // storage 차단 — 플래그 제거 실패, 무해
      }
    }
    posthog.reset();
  } catch {
    // noop
  }
}
