/**
 * Network mock / 응답 대기 헬퍼 (apps/app).
 *
 * - `fulfillJson` : `page.route` 핸들러 안에서 200 + json 응답.
 * - `waitForTrpc` : `/trpc/<procedure>` 200 OK 응답 대기.
 */

import type { Page, Route } from "@playwright/test";

export function fulfillJson(route: Route, body: unknown): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export interface WaitForTrpcOptions {
  /** path match — default `/trpc/${procedure}` substring. */
  exactPath?: boolean;
  /** 타임아웃 ms. default 20_000. */
  timeout?: number;
}

export function waitForTrpc(
  page: Page,
  procedure: string,
  { exactPath = false, timeout = 20_000 }: WaitForTrpcOptions = {},
): ReturnType<Page["waitForResponse"]> {
  const needle = `/trpc/${procedure}`;
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    const matches = exactPath ? url.pathname === needle : response.url().includes(needle);
    return matches && response.ok();
  }, { timeout });
}
