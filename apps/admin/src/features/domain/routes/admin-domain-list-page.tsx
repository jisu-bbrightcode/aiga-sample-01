import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Link } from "@tanstack/react-router";
import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { DOMAIN_ADMIN_DEFAULT_PAGE_SIZE } from "../constants";
import { useDomainResources } from "../hooks/use-domain-resources";
import { DomainFilters } from "../pages/domain-filters";
import { DomainTable } from "../pages/domain-table";
import type {
  DomainResourceSortField,
  DomainResourceStatus,
  DomainResourceType,
  SortOrder,
} from "../types";

/**
 * Admin Domain Resource List Page — `/domain`.
 *
 * 핵심 도메인 리소스(의사/병원)를 검색·필터·정렬·페이지네이션으로 운영자가
 * 탐색하는 화면. PB-ADMIN-DOMAIN-LIST-001 / BBR-678.
 */
export function AdminDomainListPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<DomainResourceType | undefined>();
  const [status, setStatus] = useState<DomainResourceStatus | undefined>();
  const [sort, setSort] = useState<DomainResourceSortField>("updatedAt");
  const [order, setOrder] = useState<SortOrder>("desc");

  // Debounce the free-text search so each keystroke doesn't fire a request.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const { data, isLoading, isFetching, isError, error, refetch } = useDomainResources({
    page,
    limit: DOMAIN_ADMIN_DEFAULT_PAGE_SIZE,
    search: search || undefined,
    type,
    status,
    sort,
    order,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 0;

  const handleTypeChange = (next?: DomainResourceType) => {
    setType(next);
    setPage(1);
  };

  const handleStatusChange = (next?: DomainResourceStatus) => {
    setStatus(next);
    setPage(1);
  };

  const handleSortChange = (field: DomainResourceSortField) => {
    if (field === sort) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(field);
      setOrder(field === "name" ? "asc" : "desc");
    }
    setPage(1);
  };

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">도메인 리소스</h1>
          <p className="text-muted-foreground">의사·병원 큐레이션 카탈로그를 검색하고 관리합니다</p>
        </div>
        <Button render={<Link to="/domain/new" />} size="sm" className="w-fit shrink-0">
          <Plus className="mr-2 size-3.5" />
          리소스 생성
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>리소스 목록</CardTitle>
              <CardDescription>
                상태와 최근 변경 정보를 확인하고 검색·필터·정렬할 수 있습니다
              </CardDescription>
            </div>
            <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
              <RefreshCw className={isFetching ? "mr-2 size-3.5 animate-spin" : "mr-2 size-3.5"} />
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <DomainFilters
            search={searchInput}
            type={type}
            status={status}
            onSearchChange={setSearchInput}
            onTypeChange={handleTypeChange}
            onStatusChange={handleStatusChange}
          />

          {isError ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="text-destructive">
                {error instanceof Error ? error.message : "목록을 불러오지 못했습니다."}
              </div>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                다시 시도
              </Button>
            </div>
          ) : (
            <DomainTable
              resources={items}
              isLoading={isLoading}
              sort={sort}
              order={order}
              onSortChange={handleSortChange}
            />
          )}

          {!isError && total > 0 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                총 {total.toLocaleString("ko-KR")}개 · {page} / {Math.max(totalPages, 1)} 페이지
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1 || isFetching}
                >
                  이전
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={page >= totalPages || isFetching}
                >
                  다음
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
