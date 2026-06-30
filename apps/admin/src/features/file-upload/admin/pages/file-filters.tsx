import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { Switch } from "@repo/ui/shadcn/switch";
import {
  FILE_SOURCE_LABELS,
  FILE_STATUS_LABELS,
  FILE_VISIBILITY_LABELS,
  type FileSource,
  type FileStatus,
  type FileVisibility,
} from "../types";

export interface FileFilterValues {
  ownerUserId: string;
  targetType: string;
  targetId: string;
  contentType: string;
  status?: FileStatus;
  visibility?: FileVisibility;
  source?: FileSource;
  includeDeleted: boolean;
}

interface FileFiltersProps {
  values: FileFilterValues;
  onChange: (patch: Partial<FileFilterValues>) => void;
}

const STATUS_OPTIONS = Object.keys(FILE_STATUS_LABELS) as FileStatus[];
const VISIBILITY_OPTIONS = Object.keys(FILE_VISIBILITY_LABELS) as FileVisibility[];
const SOURCE_OPTIONS = Object.keys(FILE_SOURCE_LABELS) as FileSource[];

/**
 * 관리자 파일 목록 필터/검색.
 *
 * The `GET /admin/files` endpoint filters by structured fields (no free-text
 * search), so search is expressed through owner / target / MIME / status /
 * visibility / source — plus an explicit "삭제 포함" toggle to inspect and
 * restore soft-deleted files.
 */
export function FileFilters({ values, onChange }: FileFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <Label htmlFor="filter-owner">소유자 ID</Label>
          <Input
            id="filter-owner"
            placeholder="user id"
            value={values.ownerUserId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ ownerUserId: e.target.value })
            }
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="filter-target-type">대상 유형</Label>
          <Input
            id="filter-target-type"
            placeholder="예: hospital"
            value={values.targetType}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ targetType: e.target.value })
            }
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="filter-target-id">대상 ID</Label>
          <Input
            id="filter-target-id"
            value={values.targetId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ targetId: e.target.value })
            }
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <Label htmlFor="filter-content-type">MIME 타입</Label>
          <Input
            id="filter-content-type"
            placeholder="예: image/png"
            value={values.contentType}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange({ contentType: e.target.value })
            }
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="filter-status">상태</Label>
          <Select
            value={values.status ?? "all"}
            onValueChange={(v: string | null) =>
              onChange({ status: v === "all" || !v ? undefined : (v as FileStatus) })
            }
          >
            <SelectTrigger id="filter-status" className="mt-1">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {FILE_STATUS_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-visibility">공개 여부</Label>
          <Select
            value={values.visibility ?? "all"}
            onValueChange={(v: string | null) =>
              onChange({ visibility: v === "all" || !v ? undefined : (v as FileVisibility) })
            }
          >
            <SelectTrigger id="filter-visibility" className="mt-1">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {VISIBILITY_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {FILE_VISIBILITY_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-source">출처</Label>
          <Select
            value={values.source ?? "all"}
            onValueChange={(v: string | null) =>
              onChange({ source: v === "all" || !v ? undefined : (v as FileSource) })
            }
          >
            <SelectTrigger id="filter-source" className="mt-1">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {SOURCE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {FILE_SOURCE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="filter-include-deleted"
          checked={values.includeDeleted}
          onCheckedChange={(checked: boolean) => onChange({ includeDeleted: checked })}
          size="sm"
        />
        <Label htmlFor="filter-include-deleted">삭제된 파일 포함</Label>
      </div>
    </div>
  );
}
