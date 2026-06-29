/**
 * Admin Users Page - core user/profile metadata list.
 *
 * User sanctions are domain-specific. Community bans stay in community
 * membership/moderation tables, not on the core Better Auth user row.
 */

import { cn } from "@repo/ui/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/shadcn/avatar";
import { Button } from "@repo/ui/shadcn/button";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { API_URL, getAuthHeaders } from "../../lib/api";

interface UserItem {
  id: string;
  name: string;
  email: string;
  image: string | null;
  roles: string[];
  createdAt: string;
  emailVerified: boolean;
  isActive: boolean;
}

interface UserListResponse {
  users: UserItem[];
  total: number;
}

interface RoleInfo {
  label: string;
  color: string;
}

const DEFAULT_ROLE_INFO: RoleInfo = { label: "User", color: "bg-gray-100 text-gray-600" };

const ROLE_LABELS: Record<string, RoleInfo> = {
  owner: { label: "Owner", color: "bg-purple-100 text-purple-700" },
  admin: { label: "Admin", color: "bg-blue-100 text-blue-700" },
  member: { label: "Member", color: "bg-emerald-100 text-emerald-700" },
  user: DEFAULT_ROLE_INFO,
};

const PAGE_SIZE = 20;
const USER_ROW_SKELETON_KEYS = [
  "user-skeleton-1",
  "user-skeleton-2",
  "user-skeleton-3",
  "user-skeleton-4",
  "user-skeleton-5",
];
const ADMIN_USERS_ERROR_MESSAGE =
  "사용자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";

async function fetchAdminUsers(page: number): Promise<UserListResponse> {
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  });
  const response = await fetch(`${API_URL}/api/admin/users?${params.toString()}`, {
    headers: getAuthHeaders(),
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`admin_users_${response.status}`);
  }
  return (await response.json()) as UserListResponse;
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers(page);
      setUsers(data.users);
      setTotal(data.total);
    } catch (e) {
      console.error("[admin-users] list failed", e);
      setError(ADMIN_USERS_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAdminUsers(page);
        if (cancelled) return;
        setUsers(data.users);
        setTotal(data.total);
      } catch (e) {
        if (cancelled) return;
        console.error("[admin-users] list failed", e);
        setError(ADMIN_USERS_ERROR_MESSAGE);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6">
      <AdminUsersHeader total={total} loading={loading} onRefresh={refreshUsers} />
      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          {error}
        </div>
      ) : null}

      <UsersTable users={users} loading={loading} />

      {totalPages > 1 ? (
        <AdminUsersPagination
          page={page}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}

function AdminUsersHeader({
  total,
  loading,
  onRefresh,
}: {
  total: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <Users className="size-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">사용자 관리</h1>
          <p className="text-[13px] text-muted-foreground">전체 {total}명의 사용자</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
        className="gap-1.5"
      >
        <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        새로고침
      </Button>
    </div>
  );
}

function AdminUsersPagination({
  page,
  total,
  totalPages,
  onPageChange,
}: {
  page: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between text-[13px] text-muted-foreground">
      <span>
        {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} / {total}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function UsersTable({ users, loading }: { users: UserItem[]; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-2.5 text-left font-medium">사용자</th>
            <th className="px-4 py-2.5 text-left font-medium">역할</th>
            <th className="px-4 py-2.5 text-left font-medium">상태</th>
            <th className="px-4 py-2.5 text-left font-medium">가입일</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <UserTableSkeleton /> : null}
          {!loading && users.length === 0 ? <UserTableEmpty /> : null}
          {!loading && users.length > 0
            ? users.map((user) => <UserRow key={user.id} user={user} />)
            : null}
        </tbody>
      </table>
    </div>
  );
}

function UserTableSkeleton() {
  return USER_ROW_SKELETON_KEYS.map((key) => (
    <tr key={key} className="border-b">
      <td colSpan={4} className="px-4 py-3">
        <div className="h-5 w-full animate-pulse rounded bg-muted" />
      </td>
    </tr>
  ));
}

function UserTableEmpty() {
  return (
    <tr>
      <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
        사용자가 없습니다
      </td>
    </tr>
  );
}

function UserRow({ user }: { user: UserItem }) {
  const primaryRole =
    user.roles.find((role) => role === "owner" || role === "admin") ?? user.roles[0] ?? "user";
  const roleInfo = ROLE_LABELS[primaryRole] ?? DEFAULT_ROLE_INFO;

  return (
    <tr className="border-b last:border-0 transition-colors hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback className="text-[11px]">
              {user.name?.charAt(0)?.toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate text-[12px] text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            roleInfo.color,
          )}
        >
          {primaryRole === "owner" || primaryRole === "admin" ? (
            <ShieldCheck className="size-3" />
          ) : (
            <UserCheck className="size-3" />
          )}
          {roleInfo.label}
        </span>
      </td>

      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            user.isActive
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600",
          )}
        >
          <Check className="size-3" />
          {user.isActive ? "활성" : "비활성"}
        </span>
      </td>

      <td className="px-4 py-3 text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString("ko-KR")}
      </td>
    </tr>
  );
}
