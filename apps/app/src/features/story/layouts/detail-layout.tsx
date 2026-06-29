/**
 * Detail page layout: flex-1 editor area (centered Paper) + 260px meta sidebar.
 * Editor area: flex-1 min-w-0 p-sm overflow-y-auto, centered max-w-[720px].
 * Meta sidebar: 260px flex-shrink-0 py-2 overflow-y-auto, sections gap-4 (16px).
 *
 * 사이드바 공통 표준 (lore 엔티티 동일):
 *   <MetaSection title icon count>
 *     <SidebarItem leading primary secondary trailing onClick />
 *     <SidebarItem ... />
 *     <SidebarItemAdd label onClick />
 *   </MetaSection>
 */

import { IconMultiToggleGroup, IconToggleGroup } from "@repo/ui/components/icon-toggle";
import { cn } from "@repo/ui/lib/utils";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@repo/ui/shadcn/avatar";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { Switch } from "@repo/ui/shadcn/switch";
import { Textarea } from "@repo/ui/shadcn/textarea";
import type { ReactNode } from "react";

/* ============================================================================
 * DetailLayout
 * ========================================================================= */

interface DetailLayoutProps {
  editor: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}

export function DetailLayout({ editor, meta, className }: DetailLayoutProps) {
  return (
    <div className={cn("flex flex-1 overflow-hidden", className)}>
      {/* Main editor area */}
      <div className="flex min-w-0 flex-1 flex-col items-center overflow-y-auto p-sm">
        <div className="ml-1 w-full max-w-[720px] flex-1">{editor}</div>
      </div>

      {/* Meta sidebar — 공통 표준 */}
      {meta ? (
        <aside className="flex w-[260px] shrink-0 flex-col gap-4 overflow-y-auto py-2">
          {meta}
        </aside>
      ) : null}
    </div>
  );
}

/* ============================================================================
 * MetaSection — 사이드바 섹션 wrap
 *
 *   <MetaSection title="..." icon={...} count={N}>
 *     <SidebarItem ... />
 *   </MetaSection>
 *
 * - 헤더(있을 때): icon + h3 + 인라인 카운트
 * - 자식 간 space-y-0.5 (2px)
 * - outer padding 없음 — aside gap-4 만으로 섹션 구분
 * ========================================================================= */

interface MetaSectionProps {
  title?: string;
  icon?: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  dataEl?: string;
  className?: string;
}

export function MetaSection({ title, icon, count, children, dataEl, className }: MetaSectionProps) {
  return (
    <div className={cn("space-y-0.5", className)} data-el={dataEl}>
      {title ? (
        <div className="flex items-center gap-2 px-2 py-1.5">
          {icon}
          <h3 className="text-sm font-medium text-foreground/80">{title}</h3>
          {typeof count === "number" && count > 0 ? (
            <span className="text-base text-muted-foreground">{count}</span>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ============================================================================
 * SidebarItem — 사이드바 row 공통 컴포넌트
 *
 *   <SidebarItem
 *     leading={<Icon />}      // optional
 *     primary="제목"           // text-sm text-foreground
 *     secondary="부가 설명"    // optional, text-base text-muted-foreground
 *     onClick={() => ...}     // 클릭 시 Dialog 등
 *     ariaLabel="..."
 *     trailing={<Pencil />}   // optional, hover 시 노출
 *   />
 *
 * - 외곽: group flex px-2 py-1.5, hover:bg-muted (테두리 없음)
 * - leading 슬롯 (옵션): size-3.5 icon 또는 size-2 dot
 * - trailing 슬롯 (옵션): hover 시 opacity-0→100
 * ========================================================================= */

interface SidebarItemProps {
  leading?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  dataEl?: string;
}

export function SidebarItem({
  leading,
  primary,
  secondary,
  trailing,
  onClick,
  ariaLabel,
  dataEl,
}: SidebarItemProps) {
  const interactive = !!onClick;
  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-1.5",
        interactive && "hover:bg-muted",
      )}
      data-el={dataEl}
    >
      {interactive ? (
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-w-0 flex-1 justify-start gap-2 rounded-none bg-transparent p-0 text-left font-normal whitespace-normal hover:bg-transparent hover:text-foreground"
          aria-label={ariaLabel}
          onClick={onClick}
        >
          {leading ? <span className="shrink-0">{leading}</span> : null}
          <span className="block min-w-0 flex-1">
            <span className="block truncate text-sm text-foreground">{primary}</span>
            {secondary ? (
              <span className="block truncate text-base text-muted-foreground">{secondary}</span>
            ) : null}
          </span>
        </Button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {leading ? <span className="shrink-0">{leading}</span> : null}
          <span className="block min-w-0 flex-1">
            <span className="block truncate text-sm text-foreground">{primary}</span>
            {secondary ? (
              <span className="block truncate text-base text-muted-foreground">{secondary}</span>
            ) : null}
          </span>
        </div>
      )}
      {trailing ? (
        <span
          className={cn(
            "shrink-0",
            interactive && "opacity-0 transition-opacity group-hover:opacity-100",
          )}
        >
          {trailing}
        </span>
      ) : null}
    </div>
  );
}

/* ============================================================================
 * SidebarItemAdd — 사이드바 "+ 추가" 인라인 텍스트 버튼
 *
 *   <SidebarItemAdd label="목표 추가" onClick={...} />
 *
 * - text-base muted-foreground/60 → hover muted-foreground
 * - row 와 동일 padding (px-2 py-1.5)
 * ========================================================================= */

interface SidebarItemAddProps {
  label: string;
  onClick?: () => void;
  dataEl?: string;
}

export function SidebarItemAdd({ label, onClick, dataEl }: SidebarItemAddProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      data-el={dataEl}
      className="h-auto w-full justify-start gap-1 rounded-lg px-2 py-1.5 text-left text-sm font-normal text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
    >
      + {label}
    </Button>
  );
}

/* ============================================================================
 * Sidebar field controls — detail rail 안에서 쓰는 입력/선택/토글 표준
 *
 * 목표:
 * - sidebar row 밀도(px-2, text-base)를 유지한다.
 * - label/description/control 배치를 매번 page에서 새로 만들지 않는다.
 * - shadcn primitive는 여기에서만 조합하고 page는 의미 있는 field만 사용한다.
 * ========================================================================= */

interface SidebarFieldFrameProps {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  dataEl?: string;
  className?: string;
}

export function SidebarFieldFrame({
  label,
  description,
  children,
  dataEl,
  className,
}: SidebarFieldFrameProps) {
  return (
    <div className={cn("space-y-1.5 rounded-lg px-2 py-1.5", className)} data-el={dataEl}>
      <div className="space-y-0.5">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description ? (
          <div className="text-xs leading-4 text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

interface SidebarInputFieldProps {
  label: ReactNode;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  description?: ReactNode;
  onValueChange?: (value: string) => void;
  dataEl?: string;
}

export function SidebarInputField({
  label,
  value,
  defaultValue,
  placeholder,
  description,
  onValueChange,
  dataEl,
}: SidebarInputFieldProps) {
  return (
    <SidebarFieldFrame label={label} description={description} dataEl={dataEl}>
      <Input
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onChange={(event) => onValueChange?.(event.target.value)}
        className="h-8 bg-background text-base"
      />
    </SidebarFieldFrame>
  );
}

interface SidebarNumberFieldProps {
  label: ReactNode;
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: ReactNode;
  description?: ReactNode;
  onValueChange?: (value: number | null) => void;
  dataEl?: string;
}

export function SidebarNumberField({
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  unit,
  description,
  onValueChange,
  dataEl,
}: SidebarNumberFieldProps) {
  return (
    <SidebarFieldFrame label={label} description={description} dataEl={dataEl}>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          defaultValue={defaultValue}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = event.target.value;
            onValueChange?.(next === "" ? null : Number(next));
          }}
          className="h-8 bg-background text-base"
        />
        {unit ? <span className="shrink-0 text-xs text-muted-foreground">{unit}</span> : null}
      </div>
    </SidebarFieldFrame>
  );
}

interface SidebarTimeFieldProps {
  label: ReactNode;
  value?: string;
  defaultValue?: string;
  type?: "time" | "date" | "datetime-local";
  description?: ReactNode;
  onValueChange?: (value: string) => void;
  dataEl?: string;
}

export function SidebarTimeField({
  label,
  value,
  defaultValue,
  type = "time",
  description,
  onValueChange,
  dataEl,
}: SidebarTimeFieldProps) {
  return (
    <SidebarFieldFrame label={label} description={description} dataEl={dataEl}>
      <Input
        type={type}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => onValueChange?.(event.target.value)}
        className="h-8 bg-background text-base"
      />
    </SidebarFieldFrame>
  );
}

interface SidebarTextareaFieldProps extends SidebarInputFieldProps {
  rows?: number;
}

export function SidebarTextareaField({
  label,
  value,
  defaultValue,
  placeholder,
  description,
  onValueChange,
  rows = 3,
  dataEl,
}: SidebarTextareaFieldProps) {
  return (
    <SidebarFieldFrame label={label} description={description} dataEl={dataEl}>
      <Textarea
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        rows={rows}
        onChange={(event) => onValueChange?.(event.target.value)}
        className="min-h-20 resize-none bg-background text-base leading-5"
      />
    </SidebarFieldFrame>
  );
}

interface SidebarSelectFieldOption {
  value: string;
  label: ReactNode;
}

interface SidebarSelectFieldProps {
  label: ReactNode;
  value: string;
  options: SidebarSelectFieldOption[];
  description?: ReactNode;
  placeholder?: string;
  onValueChange: (value: string) => void;
  dataEl?: string;
}

export function SidebarSelectField({
  label,
  value,
  options,
  description,
  placeholder,
  onValueChange,
  dataEl,
}: SidebarSelectFieldProps) {
  const selected = options.find((option) => option.value === value);
  return (
    <SidebarFieldFrame label={label} description={description} dataEl={dataEl}>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next);
        }}
      >
        <SelectTrigger className="h-8 w-full bg-background text-base">
          <SelectValue>{selected?.label ?? placeholder}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SidebarFieldFrame>
  );
}

interface SidebarToggleFieldProps {
  label: ReactNode;
  checked: boolean;
  description?: ReactNode;
  onCheckedChange: (checked: boolean) => void;
  dataEl?: string;
}

export function SidebarToggleField({
  label,
  checked,
  description,
  onCheckedChange,
  dataEl,
}: SidebarToggleFieldProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5" data-el={dataEl}>
      <div className="min-w-0 space-y-0.5">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description ? (
          <div className="text-xs leading-4 text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={typeof label === "string" ? label : undefined}
      />
    </div>
  );
}

interface SidebarToggleButtonFieldProps {
  label: ReactNode;
  pressed: boolean;
  buttonLabel: ReactNode;
  description?: ReactNode;
  onPressedChange: (pressed: boolean) => void;
  dataEl?: string;
}

export function SidebarToggleButtonField({
  label,
  pressed,
  buttonLabel,
  description,
  onPressedChange,
  dataEl,
}: SidebarToggleButtonFieldProps) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5" data-el={dataEl}>
      <div className="min-w-0 space-y-0.5">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description ? (
          <div className="text-xs leading-4 text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <Button
        type="button"
        variant={pressed ? "secondary" : "outline"}
        size="sm"
        aria-pressed={pressed}
        onClick={() => onPressedChange(!pressed)}
        className="h-7 shrink-0 px-2.5 text-base shadow-none"
      >
        {buttonLabel}
      </Button>
    </div>
  );
}

interface SidebarChipToggleOption {
  id: string;
  label: ReactNode;
}

interface SidebarChipToggleFieldProps {
  label: ReactNode;
  options: SidebarChipToggleOption[];
  selectedIds: string[];
  description?: ReactNode;
  onToggle: (id: string, selected: boolean) => void;
  dataEl?: string;
}

export function SidebarChipToggleField({
  label,
  options,
  selectedIds,
  description,
  onToggle,
  dataEl,
}: SidebarChipToggleFieldProps) {
  return (
    <SidebarFieldFrame label={label} description={description} dataEl={dataEl}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const selected = selectedIds.includes(option.id);
          return (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={selected}
              onClick={() => onToggle(option.id, !selected)}
              className={cn(
                "h-7 rounded-full px-2.5 text-base shadow-none",
                selected && "border-foreground/10 bg-muted text-foreground",
              )}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </SidebarFieldFrame>
  );
}

interface SidebarIconToggleOption {
  id: string;
  label: string;
  icon: ReactNode;
}

interface SidebarIconToggleFieldProps {
  label: ReactNode;
  value: string;
  options: SidebarIconToggleOption[];
  description?: ReactNode;
  onValueChange: (value: string) => void;
  dataEl?: string;
}

export function SidebarIconToggleField({
  label,
  value,
  options,
  description,
  onValueChange,
  dataEl,
}: SidebarIconToggleFieldProps) {
  return (
    <SidebarFieldFrame label={label} description={description} dataEl={dataEl}>
      <IconToggleGroup
        value={value}
        onValueChange={(next) => {
          if (next) onValueChange(next);
        }}
        options={options}
      />
    </SidebarFieldFrame>
  );
}

interface SidebarIconMultiToggleFieldProps {
  label: ReactNode;
  selectedIds: string[];
  options: SidebarIconToggleOption[];
  description?: ReactNode;
  onValueChange: (selectedIds: string[]) => void;
  dataEl?: string;
}

export function SidebarIconMultiToggleField({
  label,
  selectedIds,
  options,
  description,
  onValueChange,
  dataEl,
}: SidebarIconMultiToggleFieldProps) {
  return (
    <SidebarFieldFrame label={label} description={description} dataEl={dataEl}>
      <IconMultiToggleGroup value={selectedIds} onValueChange={onValueChange} options={options} />
    </SidebarFieldFrame>
  );
}

interface SidebarAvatar {
  id: string;
  name: string;
  initials: string;
  color?: string;
}

interface SidebarAvatarFieldProps {
  label: ReactNode;
  avatars: SidebarAvatar[];
  description?: ReactNode;
  maxVisible?: number;
  onAvatarClick?: (id: string) => void;
  dataEl?: string;
}

export function SidebarAvatarField({
  label,
  avatars,
  description,
  maxVisible = 3,
  onAvatarClick,
  dataEl,
}: SidebarAvatarFieldProps) {
  const visible = avatars.slice(0, maxVisible);
  const hiddenCount = Math.max(avatars.length - visible.length, 0);
  return (
    <SidebarFieldFrame label={label} description={description} dataEl={dataEl}>
      <div className="flex items-center justify-between gap-3">
        <AvatarGroup>
          {visible.map((avatar) => (
            <Button
              key={avatar.id}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={avatar.name}
              onClick={() => onAvatarClick?.(avatar.id)}
              className="size-6 rounded-full p-0"
            >
              <Avatar size="sm">
                <AvatarFallback
                  className="text-xs text-background"
                  style={{ backgroundColor: avatar.color ?? "#5A7A8F" }}
                >
                  {avatar.initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          ))}
          {hiddenCount > 0 ? (
            <AvatarGroupCount>
              <span className="text-xs">+{hiddenCount}</span>
            </AvatarGroupCount>
          ) : null}
        </AvatarGroup>
        <div className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
          {avatars.map((avatar) => avatar.name).join(", ")}
        </div>
      </div>
    </SidebarFieldFrame>
  );
}
