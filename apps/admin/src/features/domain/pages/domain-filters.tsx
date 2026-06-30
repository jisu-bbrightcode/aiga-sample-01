import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import type { DomainResourceStatus, DomainResourceType } from "../types";
import { DOMAIN_STATUS_LABELS, DOMAIN_TYPE_LABELS } from "../types";

interface DomainFiltersProps {
  search: string;
  type?: DomainResourceType;
  status?: DomainResourceStatus;
  onSearchChange: (search: string) => void;
  onTypeChange: (type?: DomainResourceType) => void;
  onStatusChange: (status?: DomainResourceStatus) => void;
}

const TYPE_OPTIONS = Object.keys(DOMAIN_TYPE_LABELS) as DomainResourceType[];
const STATUS_OPTIONS = Object.keys(DOMAIN_STATUS_LABELS) as DomainResourceStatus[];

/**
 * 도메인 리소스 목록 필터 (검색어 / 유형 / 상태).
 */
export function DomainFilters({
  search,
  type,
  status,
  onSearchChange,
  onTypeChange,
  onStatusChange,
}: DomainFiltersProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end">
      {/* 이름/슬러그 검색 */}
      <div className="flex-1">
        <Label htmlFor="domain-search">검색 (이름 또는 슬러그)</Label>
        <Input
          id="domain-search"
          placeholder="의사·병원 이름 또는 slug"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
          className="mt-1"
        />
      </div>

      {/* 유형 필터 */}
      <div className="w-full md:w-[180px]">
        <Label htmlFor="domain-type">유형</Label>
        <Select
          value={type ?? "all"}
          onValueChange={(v: string | null) =>
            onTypeChange(v === "all" || !v ? undefined : (v as DomainResourceType))
          }
        >
          <SelectTrigger id="domain-type" className="mt-1">
            <SelectValue placeholder="전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {DOMAIN_TYPE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 상태 필터 */}
      <div className="w-full md:w-[180px]">
        <Label htmlFor="domain-status">상태</Label>
        <Select
          value={status ?? "all"}
          onValueChange={(v: string | null) =>
            onStatusChange(v === "all" || !v ? undefined : (v as DomainResourceStatus))
          }
        >
          <SelectTrigger id="domain-status" className="mt-1">
            <SelectValue placeholder="전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {DOMAIN_STATUS_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
