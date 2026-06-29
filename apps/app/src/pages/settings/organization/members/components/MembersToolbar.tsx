/**
 * MembersToolbar — search input + filter select + CSV export + invite.
 */
import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { Search } from "lucide-react";

export type MembersFilter = "all" | "admins" | "pending" | "agents";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  filter: MembersFilter;
  onFilterChange: (v: MembersFilter) => void;
  onExport: () => void;
  onInvite: () => void;
}

export function MembersToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onExport,
  onInvite,
}: Props) {
  const { t } = useFeatureTranslation("page.settings");
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("members.toolbar.searchPlaceholder")}
          className="pl-9"
        />
      </div>
      <Select value={filter} onValueChange={(v) => v && onFilterChange(v as MembersFilter)}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="admins">Admins</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="agents">Agents</SelectItem>
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" onClick={onExport}>
        {t("members.toolbar.export")}
      </Button>
      <Button type="button" onClick={onInvite}>
        {t("members.toolbar.invite")}
      </Button>
    </div>
  );
}
