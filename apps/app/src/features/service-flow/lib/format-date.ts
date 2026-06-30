/**
 * Format an ISO timestamp as a compact `YYYY.MM.DD` date for list rows.
 * Returns an empty string for missing/invalid input so the UI never renders
 * "Invalid Date". Pure — no locale/runtime dependency, safe to unit test.
 */
export function formatServiceDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}
