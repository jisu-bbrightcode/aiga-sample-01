import type { ReactNode } from "react";
import { Toggle } from "../_shadcn/toggle";
import { ToggleGroup, ToggleGroupItem } from "../_shadcn/toggle-group";
import { cn } from "../lib/utils";

export interface IconToggleOption<T extends string = string> {
  id: T;
  label: string;
  icon: ReactNode;
}

interface IconToggleGroupProps<T extends string = string> {
  options: IconToggleOption<T>[];
  value: T | null;
  onValueChange?: (value: T | null) => void;
  allowOff?: boolean;
  className?: string;
  buttonClassName?: string;
}

export function IconToggleGroup<T extends string = string>({
  options,
  value,
  onValueChange,
  allowOff = false,
  className,
  buttonClassName,
}: IconToggleGroupProps<T>) {
  return (
    <ToggleGroup
      value={value ? [value] : []}
      onValueChange={(next) => {
        const selected = next[0] as T | undefined;
        if (!selected && !allowOff) return;
        onValueChange?.(selected ?? null);
      }}
      className={iconToggleGroupClassName(className)}
      spacing={0}
      data-el="icon-toggle-group"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.id}
          value={option.id}
          title={option.label}
          aria-label={option.label}
          onClick={() => {
            if (allowOff && value === option.id) onValueChange?.(null);
          }}
          className={iconToggleItemClassName(buttonClassName)}
        >
          {option.icon}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

interface IconMultiToggleGroupProps<T extends string = string> {
  options: IconToggleOption<T>[];
  value: T[];
  onValueChange?: (value: T[]) => void;
  className?: string;
  buttonClassName?: string;
}

export function IconMultiToggleGroup<T extends string = string>({
  options,
  value,
  onValueChange,
  className,
  buttonClassName,
}: IconMultiToggleGroupProps<T>) {
  return (
    <ToggleGroup
      multiple
      value={value}
      onValueChange={(next) => onValueChange?.(next as T[])}
      className={iconToggleGroupClassName(className)}
      spacing={0}
      data-el="icon-toggle-group"
    >
      {options.map((option) => {
        return (
          <ToggleGroupItem
            key={option.id}
            value={option.id}
            title={option.label}
            aria-label={option.label}
            className={iconToggleItemClassName(buttonClassName)}
          >
            {option.icon}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

interface IconToggleButtonProps {
  label: string;
  active: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function IconToggleButton({
  label,
  active,
  children,
  onClick,
  className,
}: IconToggleButtonProps) {
  return (
    <Toggle
      type="button"
      pressed={active}
      onPressedChange={() => onClick?.()}
      title={label}
      aria-label={label}
      className={iconToggleButtonClassName(className)}
    >
      {children}
    </Toggle>
  );
}

function iconToggleGroupClassName(className?: string) {
  return cn("h-7 rounded-md bg-muted/60 p-0.5", className);
}

function iconToggleItemClassName(className?: string) {
  return cn(
    "grid h-6 min-h-6 w-6 min-w-6 place-items-center !rounded-[calc(var(--radius-md)-2px)] p-0 text-muted-foreground shadow-none transition-colors",
    "bg-transparent hover:bg-muted hover:text-foreground",
    "aria-pressed:!rounded-[calc(var(--radius-md)-2px)] aria-pressed:bg-background aria-pressed:text-sidebar-foreground aria-pressed:shadow-sm",
    "data-[state=on]:!rounded-[calc(var(--radius-md)-2px)] data-[state=on]:bg-background data-[state=on]:text-sidebar-foreground data-[state=on]:shadow-sm",
    className,
  );
}

function iconToggleButtonClassName(className?: string) {
  return cn(
    "grid h-6 min-h-6 w-6 min-w-6 place-items-center rounded-md p-0 text-muted-foreground shadow-none transition-colors",
    "bg-transparent hover:bg-muted hover:text-foreground",
    "aria-pressed:bg-[rgba(31,29,24,0.06)] aria-pressed:text-sidebar-foreground aria-pressed:shadow-none",
    "data-[state=on]:bg-[rgba(31,29,24,0.06)] data-[state=on]:text-sidebar-foreground",
    className,
  );
}
