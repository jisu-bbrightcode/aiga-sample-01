import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/shadcn/table";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowDown, ArrowUp, ArrowUpDown, Star } from "lucide-react";
import { DomainStatusBadge } from "../components/domain-status-badge";
import { DomainTypeBadge } from "../components/domain-type-badge";
import type { DomainResource, DomainResourceSortField, SortOrder } from "../types";

interface DomainTableProps {
  resources: DomainResource[];
  isLoading?: boolean;
  sort: DomainResourceSortField;
  order: SortOrder;
  onSortChange: (field: DomainResourceSortField) => void;
}

function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "yyyy.MM.dd HH:mm", { locale: ko });
}

interface SortableHeaderProps {
  field: DomainResourceSortField;
  label: string;
  sort: DomainResourceSortField;
  order: SortOrder;
  onSortChange: (field: DomainResourceSortField) => void;
}

function SortableHeader({ field, label, sort, order, onSortChange }: SortableHeaderProps) {
  const active = sort === field;
  const Icon = active ? (order === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSortChange(field)}
        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
        aria-label={`${label} 정렬`}
      >
        {label}
        <Icon className={active ? "size-3.5" : "size-3.5 text-muted-foreground"} />
      </button>
    </TableHead>
  );
}

/**
 * 도메인 리소스(의사/병원) 목록 테이블.
 *
 * Shows operational state (lifecycle status + most-recent edit) per the
 * acceptance criteria; sensitive fields are never projected here.
 */
export function DomainTable({ resources, isLoading, sort, order, onSortChange }: DomainTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">조건에 맞는 도메인 리소스가 없습니다.</div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader
            field="name"
            label="이름"
            sort={sort}
            order={order}
            onSortChange={onSortChange}
          />
          <TableHead>유형</TableHead>
          <SortableHeader
            field="status"
            label="상태"
            sort={sort}
            order={order}
            onSortChange={onSortChange}
          />
          <TableHead>지역</TableHead>
          <TableHead>진료과</TableHead>
          <TableHead>명의</TableHead>
          <SortableHeader
            field="updatedAt"
            label="최근 수정"
            sort={sort}
            order={order}
            onSortChange={onSortChange}
          />
        </TableRow>
      </TableHeader>
      <TableBody>
        {resources.map((resource) => (
          <TableRow key={`${resource.type}:${resource.id}`}>
            <TableCell className="font-medium">
              <div>{resource.name}</div>
              <div className="text-xs text-muted-foreground">{resource.slug}</div>
            </TableCell>
            <TableCell>
              <DomainTypeBadge type={resource.type} />
            </TableCell>
            <TableCell>
              <DomainStatusBadge status={resource.status} />
            </TableCell>
            <TableCell>{resource.regionName ?? "-"}</TableCell>
            <TableCell>{resource.specialtyName ?? "-"}</TableCell>
            <TableCell>
              {resource.isFeatured ? (
                <Star className="size-4 fill-yellow-400 text-yellow-400" aria-label="명의" />
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDateTime(resource.updatedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
