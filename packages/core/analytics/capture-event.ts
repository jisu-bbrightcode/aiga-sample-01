import posthog from "posthog-js";
import { safeCapture } from "./safe-capture";
import { sanitize } from "./sanitize";

const phCapture = (event: string, props: Record<string, unknown>) => posthog.capture(event, props);

/**
 * 비즈니스 행동 이벤트 캡처. SSR-safe(window 없으면 no-op), 절대 throw 안 함.
 * 컨텍스트는 event name 이 아니라 properties 로 (ANALYTICS_EVENTS 상수 사용 권장).
 */
export function captureEvent(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  safeCapture(event, () => ({ ...properties }), phCapture);
}

/**
 * project group 설정. 호출 후의 capture 들은 PostHog 에서 이 project 그룹에 자동 귀속 →
 * "프로젝트당 캔버스 사용량" 류 group analytics 가능.
 */
export function setProjectGroup(projectId: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    posthog.group("project", projectId, sanitize(props));
  } catch {
    // swallow
  }
}

/** 전 이벤트 공통 super property 등록 (surface / app_version / plan / locale). */
export function registerSuperProperties(props: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    posthog.register(sanitize(props) ?? {});
  } catch {
    // swallow
  }
}
