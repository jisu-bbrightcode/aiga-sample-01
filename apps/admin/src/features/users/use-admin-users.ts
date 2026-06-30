/**
 * useAdminUsers — list/search/filter/sort state for the admin Users page.
 *
 * Owns pagination, a debounced search query, status/role filters, sort
 * field+order, and a manual refetch trigger so the page component stays small.
 * No manual memoization (React Compiler).
 *
 * BBR-685 extends the BBR-684 search list with the filter + sort surface.
 */
import { useEffect, useState } from "react";
import {
  type AdminUserItem,
  fetchAdminUsers,
  type SortOrder,
  type UserAccessRoleFilter,
  type UserSortField,
  type UserStatusFilter,
} from "./api";

export const ADMIN_USERS_PAGE_SIZE = 20;
const LIST_ERROR_MESSAGE = "사용자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";

export type StatusFilterValue = UserStatusFilter | "all";
export type AccessRoleFilterValue = UserAccessRoleFilter | "all";

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatusState] = useState<StatusFilterValue>("all");
  const [accessRole, setAccessRoleState] = useState<AccessRoleFilterValue>("all");
  const [sort, setSort] = useState<UserSortField>("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Debounce the search box; reset to the first page on a new query.
  useEffect(() => {
    const handle = setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken is a deliberate manual-refetch trigger.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAdminUsers({
          limit: ADMIN_USERS_PAGE_SIZE,
          offset: page * ADMIN_USERS_PAGE_SIZE,
          q: query || undefined,
          status: status === "all" ? undefined : status,
          accessRole: accessRole === "all" ? undefined : accessRole,
          sort,
          order,
        });
        if (cancelled) return;
        setUsers(data.users);
        setTotal(data.total);
      } catch {
        if (!cancelled) setError(LIST_ERROR_MESSAGE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, query, status, accessRole, sort, order, reloadToken]);

  // Changing a filter resets to the first page so results stay coherent.
  function setStatus(next: StatusFilterValue) {
    setStatusState(next);
    setPage(0);
  }

  function setAccessRole(next: AccessRoleFilterValue) {
    setAccessRoleState(next);
    setPage(0);
  }

  // Toggle direction when re-selecting the active column, else switch column
  // with a sensible default direction (dates desc, name/status asc).
  function toggleSort(field: UserSortField) {
    if (field === sort) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder(field === "createdAt" || field === "lastActiveAt" ? "desc" : "asc");
    }
    setPage(0);
  }

  return {
    users,
    total,
    page,
    setPage,
    searchInput,
    setSearchInput,
    status,
    setStatus,
    accessRole,
    setAccessRole,
    sort,
    order,
    toggleSort,
    loading,
    error,
    refetch: () => setReloadToken((t) => t + 1),
  };
}
