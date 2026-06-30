/**
 * Admin Users Page — user/profile management (BBR-684 / PB-ADMIN-USERS-001).
 *
 * List + search of core user/profile metadata, with a detail dialog that
 * exposes the two audited management actions (접근 역할 변경 / 계정 상태 변경).
 *
 * User sanctions are domain-specific. Community bans stay in community
 * membership/moderation tables, not on the core Better Auth user row; this
 * page manages account-level access role (org membership) and active status.
 */

import { cn } from "@repo/ui/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/shadcn/avatar";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { AdminUserItem } from "../../features/users/api";
import { ADMIN_USERS_PAGE_SIZE, useAdminUsers } from "../../features/users/use-admin-users";
import { UserDetailDialog } from "../../features/users/user-detail-dialog";

interface RoleInfo {
  label: string;
  color: string;
}

const ACCESS_ROLE_INFO: Record<string, RoleInfo> = {
  owner: { label: "소유자", color: "bg-purple-100 text-purple-700" },
  admin: { label: "관리자", color: "bg-blue-100 text-blue-700" },
  member: { label: "멤버", color: "bg-emerald-100 text-emerald-700" },
  none: { label: "일반 사용자", color: "bg-gray-100 text-gray-600" },
};

const USER_ROW_SKELETON_KEYS = [
  "user-skeleton-1",
  "user-skeleton-2",
  "user-skeleton-3",
  "user-skeleton-4",
  "user-skeleton-5",
];

export function AdminUsersPage() {
  const { users, total, page, setPage, searchInput, setSearchInput, loading, error, refetch } =
    useAdminUsers();
  const [selected, setSelected] = useState<AdminUserItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const totalPages = Math.ceil(total / ADMIN_USERS_PAGE_SIZE);

  function openDetail(user: AdminUserItem) {
    setSelected(user);
    setDialogOpen(true);
  }

  return (
    <div className="p-6">
      <AdminUsersHeader total={total} loading={loading} onRefresh={refetch} />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="이름 또는 이메일로 검색"
          className="pl-8"
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-[13px] text-destructive">
          {error}
        </div>
      ) : null}

      <UsersTable users={users} loading={loading} onSelect={openDetail} />

      {totalPages > 1 ? (
        <AdminUsersPagination
          page={page}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : null}

      <UserDetailDialog
        user={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onChanged={refetch}
      />
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
        {page * ADMIN_USERS_PAGE_SIZE + 1}-{Math.min((page + 1) * ADMIN_USERS_PAGE_SIZE, total)} /{" "}
        {total}
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

function UsersTable({
  users,
  loading,
  onSelect,
}: {
  users: AdminUserItem[];
  loading: boolean;
  onSelect: (user: AdminUserItem) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-2.5 text-left font-medium">사용자</th>
            <th className="px-4 py-2.5 text-left font-medium">접근 역할</th>
            <th className="px-4 py-2.5 text-left font-medium">상태</th>
            <th className="px-4 py-2.5 text-left font-medium">가입일</th>
          </tr>
        </thead>
        <tbody>
          {loading ? <UserTableSkeleton /> : null}
          {!loading && users.length === 0 ? <UserTableEmpty /> : null}
          {!loading && users.length > 0
            ? users.map((user) => <UserRow key={user.id} user={user} onSelect={onSelect} />)
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

function UserRow({
  user,
  onSelect,
}: {
  user: AdminUserItem;
  onSelect: (user: AdminUserItem) => void;
}) {
  const accessRole = user.accessRole ?? "none";
  const roleInfo = ACCESS_ROLE_INFO[accessRole] ?? ACCESS_ROLE_INFO.none;
  const isPrivileged = accessRole === "owner" || accessRole === "admin";

  return (
    <tr
      className="border-b last:border-0 cursor-pointer transition-colors hover:bg-muted/30"
      onClick={() => onSelect(user)}
    >
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
            roleInfo?.color,
          )}
        >
          {isPrivileged ? <ShieldCheck className="size-3" /> : <UserCheck className="size-3" />}
          {roleInfo?.label}
        </span>
      </td>

      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600",
          )}
        >
          {user.isActive ? "활성" : "정지"}
        </span>
      </td>

      <td className="px-4 py-3 text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString("ko-KR")}
      </td>
    </tr>
  );
}
