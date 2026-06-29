/**
 * better-auth `/auth/**` mock 헬퍼 — auth-{signin,signup,forgot,reset} spec 공통.
 *
 * - `AuthRequest` : 캡처된 요청의 method / url / postData
 * - `parsePostData` : JSON 파싱 가능하면 객체, 아니면 raw text
 *
 * 개별 spec 의 `installAuthMock` 은 시나리오 분기가 다르므로 그대로 두고,
 * 본 헬퍼는 type 과 parsePostData 만 공유한다.
 */

import type { Route } from "@playwright/test";

export interface AuthRequest {
  method: string;
  url: string;
  postData: unknown;
}

export function parsePostData(route: Route): unknown {
  const request = route.request();
  try {
    return request.postDataJSON();
  } catch {
    return request.postData();
  }
}
