// @ts-nocheck
export function parseLinearProjectId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const tryDecode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  // Plain id or slug-id.
  if (!value.includes("/")) return tryDecode(value);
  // URL form: https://linear.app/<org>/project/<slug>-<id>/...
  const match = value.match(/\/project\/([^/?#]+)/i);
  if (!match) return null;
  return tryDecode(match[1]);
}
