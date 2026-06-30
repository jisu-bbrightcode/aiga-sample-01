/**
 * useAdminUsers — list/search state for the admin Users page (BBR-684).
 *
 * Owns pagination, a debounced search query, and a manual refetch trigger so
 * the page component stays small. No manual memoization (React Compiler).
 */
import { useEffect, useState } from "react";
import { type AdminUserItem, fetchAdminUsers } from "./api";

export const ADMIN_USERS_PAGE_SIZE = 20;
const LIST_ERROR_MESSAGE = "사용자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
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
  }, [page, query, reloadToken]);

  return {
    users,
    total,
    page,
    setPage,
    searchInput,
    setSearchInput,
    loading,
    error,
    refetch: () => setReloadToken((t) => t + 1),
  };
}
