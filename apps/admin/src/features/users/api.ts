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

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  image: string | null;
  roles: string[];
  accessRole: AdminAccessRole | null;
  createdAt: string;
  emailVerified: boolean;
  isActive: boolean;
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
}

export function fetchAdminUsers(params: ListAdminUsersParams): Promise<AdminUserListResponse> {
  const search = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  const q = params.q?.trim();
  if (q) search.set("q", q);
  return send<AdminUserListResponse>(`/api/admin/users?${search.toString()}`);
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
