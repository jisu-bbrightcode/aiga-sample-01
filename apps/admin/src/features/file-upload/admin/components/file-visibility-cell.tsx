import { Globe, Lock } from "lucide-react";
import { FILE_VISIBILITY_LABELS, type FileVisibility } from "../types";

/** 공개/비공개 표시 (아이콘 + 라벨). */
export function FileVisibilityCell({ visibility }: { visibility: FileVisibility }) {
  const Icon = visibility === "public" ? Globe : Lock;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Icon className="size-3.5 text-muted-foreground" />
      {FILE_VISIBILITY_LABELS[visibility]}
    </span>
  );
}
