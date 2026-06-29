/**
 * 비즈니스 행동 이벤트 이름 중앙 상수.
 * 퍼널/Retention/Paths 인사이트가 이 문자열에 묶이므로 변경 시 히스토리가 끊긴다.
 */
export const ANALYTICS_EVENTS = {
  // Auth / Activation
  SIGNUP_COMPLETED: "signup_completed",
  LOGIN_COMPLETED: "login_completed",
  LOGOUT: "logout",
  // Onboarding
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_STEP_COMPLETED: "onboarding_step_completed",
  ONBOARDING_COMPLETED: "onboarding_completed",
  // Project / Workspace
  PROJECT_CREATED: "project_created",
  PROJECT_OPENED: "project_opened",
  PROJECT_DELETED: "project_deleted",
  WORKSPACE_SWITCHED: "workspace_switched",
  // Story 창작
  ENTITY_CREATED: "entity_created",
  ENTITY_VIEWED: "entity_viewed",
  ENTITY_UPDATED: "entity_updated",
  ENTITY_DELETED: "entity_deleted",
  DRAFT_CREATED: "draft_created",
  // Document editor
  EDITOR_OPENED: "editor_opened",
  EDITOR_SAVED: "editor_saved",
  // AI
  AI_CHAT_MESSAGE_SENT: "ai_chat_message_sent",
  AI_MODE_SELECTED: "ai_mode_selected",
  // Monetization
  PRICING_VIEWED: "pricing_viewed",
  CHECKOUT_STARTED: "checkout_started",
  SUBSCRIPTION_ACTIVATED: "subscription_activated",
  SUBSCRIPTION_PLAN_CHANGED: "subscription_plan_changed",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
  TOPUP_COMPLETED: "topup_completed",
  USAGE_LIMIT_REACHED: "usage_limit_reached",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
