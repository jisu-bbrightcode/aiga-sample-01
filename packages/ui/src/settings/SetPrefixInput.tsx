/**
 * SetPrefixInput — prefix-labeled input (e.g. product-builder.app/{handle}).
 *
 * Wraps shadcn Input with a leading prefix slot — the prefix is a tile
 * background (muted) and the input itself is borderless flush against it.
 * Outer wrapper carries the border + ring so focus state lights the whole
 * pill including the prefix.
 */
import { Input } from "@repo/ui/shadcn/input";
import { cn } from "../lib/utils";

interface Props {
  prefix: string;
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
}

export function SetPrefixInput({
  prefix,
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder,
  invalid,
  disabled,
  id,
}: Props) {
  return (
    <div
      className={cn(
        "flex h-7 items-stretch overflow-hidden rounded-md ring-1 ring-input transition focus-within:ring-2 focus-within:ring-ring",
        invalid && "ring-destructive focus-within:ring-destructive",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="flex select-none items-center bg-muted px-3 font-mono text-xs text-muted-foreground">
        {prefix}
      </span>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="h-full flex-1 rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
    </div>
  );
}
