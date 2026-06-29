/**
 * 속성 테이블. key-value 쌍 목록 + "속성 추가" 링크.
 * 상세 페이지 메타 사이드바에서 사용.
 */

import { cn } from "@repo/ui/lib/utils";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";

interface Props {
  properties: { key: string; value: string | ReactNode }[];
  onAddProperty?: () => void;
  className?: string;
}

export function PropertyTable({ properties, onAddProperty, className }: Props) {
  return (
    <div className={cn("flex flex-col", className)} data-testid="property-table">
      <div className="flex flex-col gap-3">
        {properties.map((prop) => (
          <div key={prop.key} className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{prop.key}</span>
            <span className="text-sm">{prop.value}</span>
          </div>
        ))}
      </div>
      {onAddProperty && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-fit gap-1 text-xs text-muted-foreground"
          onClick={onAddProperty}
          data-testid="property-table.add"
        >
          <Plus className="size-3.5" />
          <span>속성 추가</span>
        </Button>
      )}
    </div>
  );
}
