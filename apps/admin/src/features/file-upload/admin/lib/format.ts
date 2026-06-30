import { format } from "date-fns";
import { ko } from "date-fns/locale";

/** ISO timestamp → "yyyy.MM.dd HH:mm" (KST locale), `-` when absent/invalid. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "yyyy.MM.dd HH:mm", { locale: ko });
}

/** Byte count → human-readable size (e.g. "1.2 MB"), `-` when absent. */
export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
