import { cn } from "@repo/ui/lib/utils";

const STATUS_CONFIG = {
  pending: { dot: "bg-gray-300", label: "미번역", text: "text-muted-foreground" },
  translated: { dot: "bg-amber-500", label: "진행중", text: "text-amber-700" },
  reviewed: { dot: "bg-blue-500", label: "검수중", text: "text-blue-700" },
  approved: { dot: "bg-green-500", label: "완료", text: "text-green-700" },
} as const;

type TranslationStatus = keyof typeof STATUS_CONFIG;

interface StatusBadgeProps {
  status: TranslationStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span className={cn("h-2 w-2 rounded-full", config.dot)} />
      <span className={config.text}>{config.label}</span>
    </span>
  );
}
