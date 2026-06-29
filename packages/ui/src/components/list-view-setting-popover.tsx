"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "../_shadcn/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../_shadcn/select";
import { Switch } from "../_shadcn/switch";
import { cn } from "../lib/utils";

export interface ListViewSettingOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface ListViewSettingProperty {
  id: string;
  label: string;
  enabled: boolean;
  disabled?: boolean;
}

export interface ListViewSettingPopoverLabels {
  trigger: string;
  title: string;
  description: string;
  grouping: string;
  ordering: string;
  recent: string;
  showSubItems: string;
  displayProperties: string;
}

export interface ListViewSettingPopoverProps {
  groupingValue: string;
  groupingOptions: ListViewSettingOption[];
  onGroupingChange: (value: string) => void;
  orderingValue: string;
  orderingOptions: ListViewSettingOption[];
  onOrderingChange: (value: string) => void;
  recentValue: string;
  recentOptions: ListViewSettingOption[];
  onRecentChange: (value: string) => void;
  properties: ListViewSettingProperty[];
  onPropertyToggle: (id: string, enabled: boolean) => void;
  showSubItems?: boolean;
  onShowSubItemsChange?: (checked: boolean) => void;
  labels: ListViewSettingPopoverLabels;
  className?: string;
}

export function ListViewSettingPopover({
  groupingValue,
  groupingOptions,
  onGroupingChange,
  orderingValue,
  orderingOptions,
  onOrderingChange,
  recentValue,
  recentOptions,
  onRecentChange,
  properties,
  onPropertyToggle,
  showSubItems,
  onShowSubItemsChange,
  labels,
  className,
}: ListViewSettingPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            title={labels.trigger}
            aria-label={labels.trigger}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          />
        }
      >
        <SlidersHorizontal className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn("w-[300px] max-w-[calc(100vw-2rem)] gap-0 p-0", className)}
      >
        <PopoverHeader className="gap-1 px-5 pt-5 pb-4">
          <PopoverTitle>{labels.title}</PopoverTitle>
          <PopoverDescription>{labels.description}</PopoverDescription>
        </PopoverHeader>

        <div className="space-y-3 px-5 pb-3">
          <SettingSelectRow
            label={labels.grouping}
            value={groupingValue}
            options={groupingOptions}
            onValueChange={onGroupingChange}
          />
          <SettingSelectRow
            label={labels.ordering}
            value={orderingValue}
            options={orderingOptions}
            onValueChange={onOrderingChange}
          />
          <SettingSelectRow
            label={labels.recent}
            value={recentValue}
            options={recentOptions}
            onValueChange={onRecentChange}
          />
          {typeof showSubItems === "boolean" && onShowSubItemsChange ? (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-muted-foreground">
                {labels.showSubItems}
              </span>
              <Switch checked={showSubItems} onCheckedChange={onShowSubItemsChange} />
            </div>
          ) : null}
        </div>

        <div className="px-5 pt-3 pb-5">
          <p className="mb-3 text-sm font-semibold">{labels.displayProperties}</p>
          <div className="flex flex-wrap gap-2">
            {properties.map((property) => (
              <button
                key={property.id}
                type="button"
                disabled={property.disabled}
                aria-pressed={property.enabled}
                onClick={() => onPropertyToggle(property.id, !property.enabled)}
                className={cn(
                  "h-7 rounded-full border px-3 text-sm font-medium shadow-xs transition-colors",
                  property.enabled
                    ? "border-border bg-secondary text-secondary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted",
                  property.disabled && "cursor-not-allowed opacity-60",
                )}
              >
                {property.label}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SettingSelectRow({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: ListViewSettingOption[];
  onValueChange: (value: string) => void;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}>
        <SelectTrigger className="min-w-32 justify-between">
          <SelectValue>{selectedLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger={false}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
