/**
 * Project metadata & mode configuration
 *
 * APP_MODE is set at Scaffold time. "saas" = default (backward compatible).
 * Scaffold Engine generates this file with the appropriate mode value.
 */

export type AppMode = "saas" | "b2b2c";

/** Scaffold Engine이 프로젝트 생성 시 이 값을 설정한다 */
export const APP_MODE: AppMode = "saas";

export const project = {
  name: import.meta.env.VITE_APP_NAME ?? "Product Builder",
  mode: APP_MODE,
} as const;

/**
 * 모드별 라벨 — 같은 UI 요소가 모드에 따라 다른 텍스트를 표시
 */
const labels = {
  saas: {
    sidebarTitle: "Admin",
    menuGroup: "메뉴",
    dashboard: "대시보드",
    userManagement: "사용자 관리",
    welcomeSubtitle: "시스템 관리 대시보드",
    signInSubtitle: "관리자 로그인",
    signInButton: "관리자 로그인",
    signInNote: "Owner 또는 Admin 권한이 필요합니다",
    profile: "프로필",
    goToApp: "앱으로 이동",
    logout: "로그아웃",
  },
  b2b2c: {
    sidebarTitle: "관리",
    menuGroup: "메뉴",
    dashboard: "대시보드",
    userManagement: "고객 관리",
    welcomeSubtitle: "내 가게 관리",
    signInSubtitle: "사장님 로그인",
    signInButton: "로그인",
    signInNote: "사업자 계정으로 로그인하세요",
    profile: "내 정보",
    goToApp: "내 사이트 보기",
    logout: "로그아웃",
  },
} as const;

export type AdminLabels = (typeof labels)[AppMode];

export function getLabels(): AdminLabels {
  return labels[APP_MODE];
}
