/**
 * Admin user-management API (BBR-684 / PB-ADMIN-USERS-001).
 *
 * Thin fetch layer over the server's `admin/users` surface:
 *  - list/search  → GET  /api/admin/users
 *  - role change  → PATCH /api/admin/users/:id/role   (audited)
 *  - status change→ PATCH /api/admin/users/:id/status (audited)
 *
 * Errors never surface raw server detail to the UI — callers map the
 * thrown {@link AdminUsersError}.status to a friendly message.
 */
import { API_URL, getAuthHeaders } from "@/lib/api";

export type AdminAccessRole = "owner" | "admin" | "member";
export type AssignableRole = "admin" | "member";

/** List filter/sort surface (BBR-685 / PB-ADMIN-USERS-LIST-001). */
export type UserStatusFilter = "active" | "inactive";
export type UserAccessRoleFilter = "owner" | "admin" | "member" | "none";
export type UserSortField = "createdAt" | "name" | "status" | "lastActiveAt";
export type SortOrder = "asc" | "desc";

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  image: string | null;
  roles: string[];
  accessRole: AdminAccessRole | null;
  createdAt: string;
  lastActiveAt: string | null;
  emailVerified: boolean;
  isActive: boolean;
  // SCR-019 domain metrics. Optional: the current admin/users endpoint does not
  // emit these yet (신고 누적 / 병원 방문 인증 are domain data, not core user meta),
  // so the UI renders "—" until the server projection adds them.
  // ponytail: optional now, columns light up automatically when backend sends them.
  reportCount?: number;
  visitProofCount?: number;
}

export interface AdminUserListResponse {
  users: AdminUserItem[];
  total: number;
}

export class AdminUsersError extends Error {
  constructor(readonly status: number) {
    super(`admin_users_${status}`);
    this.name = "AdminUsersError";
  }
}

async function send<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    credentials: "include",
  });
  if (!response.ok) {
    throw new AdminUsersError(response.status);
  }
  return (await response.json()) as T;
}

export interface ListAdminUsersParams {
  limit: number;
  offset: number;
  q?: string;
  status?: UserStatusFilter;
  accessRole?: UserAccessRoleFilter;
  sort?: UserSortField;
  order?: SortOrder;
}

export function fetchAdminUsers(params: ListAdminUsersParams): Promise<AdminUserListResponse> {
  const search = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  const q = params.q?.trim();
  if (q) search.set("q", q);
  if (params.status) search.set("status", params.status);
  if (params.accessRole) search.set("accessRole", params.accessRole);
  if (params.sort) search.set("sort", params.sort);
  if (params.order) search.set("order", params.order);
  return send<AdminUserListResponse>(`/api/admin/users?${search.toString()}`);
}

/**
 * Mask an email for the list view so bulk PII is not exposed at a glance
 * (AC: 민감 정보는 목록에서 마스킹). Keeps the first character of the local part
 * and the domain so an admin can still recognize the account; full email
 * remains available in the detail dialog.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(local.length - 1, 2))}@${domain}`;
}

export function changeUserRole(
  userId: string,
  role: AssignableRole,
  reason: string | undefined,
): Promise<unknown> {
  return send(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role, reason: reason?.trim() || undefined }),
  });
}

export function changeUserStatus(
  userId: string,
  isActive: boolean,
  reason: string | undefined,
): Promise<unknown> {
  return send(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive, reason: reason?.trim() || undefined }),
  });
}

/** Map an admin-action failure to a friendly, non-technical message. */
export function adminActionErrorMessage(error: unknown): string {
  const status = error instanceof AdminUsersError ? error.status : 0;
  switch (status) {
    case 400:
      return "입력한 내용을 다시 확인해 주세요.";
    case 403:
      return "이 작업을 수행할 권한이 없거나, 허용되지 않는 변경입니다.";
    case 404:
      return "대상 사용자를 찾을 수 없습니다.";
    case 401:
      return "세션이 만료되었습니다. 다시 로그인해 주세요.";
    default:
      return "변경에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  }
}
