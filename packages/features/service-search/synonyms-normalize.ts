import { normalizeQuery } from "./normalize";

/**
 * Synonym-specific normalization (FR-003 / BBR-533).
 *
 * Reuses `normalizeQuery` (lowercase, trim, collapse whitespace) so a stored
 * synonym `term` is canonicalized exactly like an incoming search query —
 * that's what makes query-time expansion match. All helpers are pure and
 * return new values.
 */

/** Canonical synonym term — same rule as a normalized search query. */
export const normalizeSynonymTerm = normalizeQuery;

/**
 * Clean an expansions list relative to its canonical term:
 * - normalize each entry (lowercase / trim / collapse whitespace)
 * - drop empties and any entry equal to the canonical term
 * - de-duplicate, preserving first-seen order
 */
export function normalizeExpansions(raw: readonly string[], canonicalTerm: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const value = normalizeQuery(item);
    if (value.length === 0 || value === canonicalTerm || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }
  return out;
}
