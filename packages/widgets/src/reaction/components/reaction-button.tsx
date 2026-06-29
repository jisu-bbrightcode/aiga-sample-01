/**
 * ReactionButton Component
 *
 * Single reaction button (like)
 */
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { Heart } from "lucide-react";

export interface ReactionButtonProps {
  /** Reaction count */
  count: number;
  /** Active state (user has reacted) */
  active?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Disabled */
  disabled?: boolean;
  /** Size */
  size?: "sm" | "default" | "lg";
  /** Additional classes */
  className?: string;
}

export function ReactionButton({
  count,
  active = false,
  onClick,
  loading = false,
  disabled = false,
  size = "default",
  className,
}: ReactionButtonProps) {
  const sizeClasses = {
    sm: "h-8 px-2 text-sm",
    default: "h-9 px-3",
    lg: "h-10 px-4",
  };

  const iconSizes = {
    sm: "h-3.5 w-3.5",
    default: "h-4 w-4",
    lg: "h-5 w-5",
  };

  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(sizeClasses[size], className)}
    >
      <Heart className={cn(iconSizes[size], "mr-1.5", active && "fill-current")} />
      {count > 0 && <span>{count}</span>}
    </Button>
  );
}
