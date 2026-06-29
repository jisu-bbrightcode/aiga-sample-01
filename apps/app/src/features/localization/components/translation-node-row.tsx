import { StatusBadge } from "./status-badge";

interface TranslationNodeRowProps {
  sourceText: string;
  status: "pending" | "translated" | "reviewed" | "approved";
  onClick?: () => void;
}

export function TranslationNodeRow({ sourceText, status, onClick }: TranslationNodeRowProps) {
  return (
    <button
      className="flex w-full items-center rounded-lg px-3 text-left transition-colors hover:bg-muted"
      style={{ height: 36 }}
      onClick={onClick}
    >
      <span className="flex-1 truncate text-base font-medium text-foreground/90">
        {sourceText}
      </span>
      <StatusBadge status={status} />
    </button>
  );
}
