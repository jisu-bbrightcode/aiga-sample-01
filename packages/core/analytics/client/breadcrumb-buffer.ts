import type { LogLevel } from "../types";
export type { LogLevel };

export interface Breadcrumb {
  ts: number;
  level: LogLevel;
  ns: string;
  message: string;
  attrs?: Record<string, unknown>;
}

const MAX_BREADCRUMBS = 50;

// JS context(=윈도우) 당 1개. 멀티 윈도우 간 집계하지 않음 (의도).
const buffer: Breadcrumb[] = [];

export function pushBreadcrumb(b: Breadcrumb): void {
  buffer.push(b);
  if (buffer.length > MAX_BREADCRUMBS) buffer.shift();
}

export function getBreadcrumbs(): Breadcrumb[] {
  return [...buffer];
}

/** 테스트 전용 — 모듈 전역 buffer 초기화 */
export function __resetBreadcrumbs(): void {
  buffer.length = 0;
}
