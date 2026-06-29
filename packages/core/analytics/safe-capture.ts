import { sanitize } from "./sanitize";

let capturing = false;

/**
 * 모든 PostHog capture 의 공통 토대.
 * - sanitize 로 민감 키 마스킹
 * - try/catch 로 절대 throw 하지 않음 (전역 에러 핸들러에서 호출돼도 안전)
 * - re-entrancy 가드로 무한 재귀 차단
 */
export function safeCapture(
  event: string,
  buildProps: () => Record<string, unknown>,
  capture: (event: string, props: Record<string, unknown>) => void,
): void {
  if (capturing) return;
  capturing = true;
  try {
    const props = sanitize(buildProps()) ?? {};
    capture(event, props);
  } catch {
    // swallow — capture/sanitize/buildProps 어디서 throw 해도 무해
  } finally {
    capturing = false;
  }
}

/** 테스트 전용 — 모듈 전역 재귀가드 플래그 초기화 */
export function __resetClientCaptureState(): void {
  capturing = false;
}
