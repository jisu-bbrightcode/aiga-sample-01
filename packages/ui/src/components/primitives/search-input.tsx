/**
 * 검색 입력 필드. Search 아이콘 + 단축키 힌트(Command+K).
 * shadcn Input 사용.
 */

import { cn } from "@repo/ui/lib/utils";
import { Search } from "lucide-react";
import { Input } from "~/components/ui/input";

interface Props {
  placeholder?: string;
  onSearch?: (value: string) => void;
  className?: string;
}

export function SearchInput({ placeholder = "검색...", onSearch, className }: Props) {
  return (
    <div className={cn("relative", className)} data-testid="search-input">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        className="pl-8 pr-12"
        onChange={(e) => onSearch?.(e.target.value)}
        data-testid="search-input-field"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        ⌘K
      </kbd>
    </div>
  );
}
