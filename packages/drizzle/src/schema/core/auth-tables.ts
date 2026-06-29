/**
 * Re-export from better-auth tables
 * 다른 core 스키마에서 auth-tables를 참조하므로 호환성 유지
 */
export { members as member, organizations as organization, users as user } from "./better-auth";
