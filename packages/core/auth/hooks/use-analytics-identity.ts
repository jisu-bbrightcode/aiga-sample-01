/**
 * Analytics Identity Hook
 *
 * profileAtom + authenticatedAtom 을 구독해 PostHog identify/reset 을 자동 wiring.
 * - profile 존재 → identifyUser(id, { email, role })
 * - authenticated === false (확정 로그아웃) → resetUser()
 * - authenticated === null (로딩 중) + profile null → no-op (로딩 중 reset 방지)
 */
import { identifyUser, registerSuperProperties, resetUser } from "@repo/core/analytics/client";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { authenticatedAtom, profileAtom } from "../store";

export function useAnalyticsIdentity(): void {
  const profile = useAtomValue(profileAtom);
  const authenticated = useAtomValue(authenticatedAtom);

  // surface super property — 전 이벤트에 자동 첨부.
  useEffect(() => {
    registerSuperProperties({ surface: "web" });
  }, []);

  useEffect(() => {
    if (profile) {
      identifyUser(profile.id, { email: profile.email, role: profile.role });
    } else if (authenticated === false) {
      // 확정 로그아웃일 때만 reset — authenticated 가 null(로딩 중)이면 아무것도 안 함.
      // (profile === null 은 로그아웃 + 로딩 양쪽 모두를 의미하므로 그것만으론 부족)
      resetUser();
    }
    // profile null + authenticated null/true(로딩·전이) → no-op
  }, [profile, authenticated]);
}
