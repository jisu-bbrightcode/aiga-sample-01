import { LIST_ROW_HEIGHT } from "@repo/ui/lib/list-row";
import { cn } from "@repo/ui/lib/utils";
import { Input } from "@repo/ui/shadcn/input";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import type { CSSProperties, JSX, KeyboardEvent, ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";

export const PICKER_ROW_HEIGHT = LIST_ROW_HEIGHT;
export const PICKER_LIST_MAX_HEIGHT = 240;
export const PICKER_POPOVER_WIDTH = 320;
export const PICKER_POPOVER_HEAD_HEIGHT = 36;
export const PICKER_POPOVER_PADDING = 12;
export const PICKER_POPOVER_CHROME =
  "rounded-lg border border-border bg-[#faf8f2] shadow-md overflow-hidden";

interface PickerPanelHeadProps {
  readonly label: string;
  readonly hint?: string;
}

export function PickerPanelHead({ label, hint }: PickerPanelHeadProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap px-3 py-2 text-xs">
      <span className="font-medium text-foreground">{label}</span>
      {hint ? (
        <span className="ml-auto truncate font-mono text-xs text-muted-foreground/80">{hint}</span>
      ) : (
        <span className="ml-auto" />
      )}
      <span className="text-muted-foreground/50">?</span>
    </div>
  );
}

interface PickerSearchFieldProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder: string;
  readonly ariaLabel?: string;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly readOnly?: boolean;
  readonly preventMouseDownDefault?: boolean;
}

export function PickerSearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  onKeyDown,
  readOnly = false,
  preventMouseDownDefault = false,
}: PickerSearchFieldProps): JSX.Element {
  return (
    <div className="flex items-center gap-2 px-3 pb-1" data-picker-search>
      <Search className="size-3.5 shrink-0 text-muted-foreground" />
      <Input
        type="text"
        role="searchbox"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        readOnly={readOnly}
        onMouseDown={(event) => {
          event.stopPropagation();
          if (preventMouseDownDefault) event.preventDefault();
        }}
        placeholder={placeholder}
        className="h-7 w-full border-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0"
      />
    </div>
  );
}

interface PickerVirtualListProps<T> {
  readonly items: readonly T[];
  readonly empty: ReactNode;
  readonly className?: string;
  readonly rowHeight?: number;
  readonly maxHeight?: number;
  readonly overscan?: number;
  readonly renderRow: (item: T, ctx: PickerVirtualRowContext) => ReactNode;
}

export interface PickerVirtualRowContext {
  readonly index: number;
  readonly style: CSSProperties;
}

export function PickerVirtualList<T>({
  items,
  empty,
  className,
  rowHeight = PICKER_ROW_HEIGHT,
  maxHeight = PICKER_LIST_MAX_HEIGHT,
  overscan = 8,
  renderRow,
}: PickerVirtualListProps<T>): JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const fallbackItems =
    virtualItems.length === 0 && items.length > 0
      ? items
          .slice(0, Math.min(items.length, Math.ceil(maxHeight / rowHeight) + overscan))
          .map((_item, index) => ({
            index,
            start: index * rowHeight,
          }))
      : virtualItems;
  const totalRowHeight = Math.max(virtualizer.getTotalSize(), items.length * rowHeight);
  const viewportHeight = Math.min(maxHeight, totalRowHeight);

  useLayoutEffect(() => {
    const scroller = parentRef.current;
    if (!scroller) return;
    scroller.scrollTop = 0;
    virtualizer.scrollToOffset?.(0);
    virtualizer.measure?.();
  }, [virtualizer]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => virtualizer.measure?.());
    return () => cancelAnimationFrame(frame);
  }, [virtualizer]);

  if (items.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div
      ref={parentRef}
      data-picker-virtual-list
      className={cn("overflow-y-auto px-1.5 pb-1.5", className)}
      style={{ height: viewportHeight, maxHeight }}
    >
      <div className="relative" style={{ height: totalRowHeight }}>
        {fallbackItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          if (!item) return null;
          return renderRow(item, {
            index: virtualItem.index,
            style: {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: rowHeight,
              transform: `translateY(${virtualItem.start}px)`,
            },
          });
        })}
      </div>
    </div>
  );
}

export function PickerEmptyState({ children }: { readonly children: ReactNode }): JSX.Element {
  return <div className="px-3 py-6 text-center text-xs text-muted-foreground">{children}</div>;
}
