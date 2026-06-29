/**
 * Built-in cover patterns for project cards. Optimized 720x1080 (book ratio)
 * jpegs in /apps/app/public/patterns/. Vintage textures + abstract pattern
 * mix — analog feel preferred by writer customers.
 *
 * The default pattern for a project is picked deterministically from its id
 * via `defaultPatternFor`, so cards stay stable across reloads when the
 * user hasn't chosen a cover yet.
 */

export const PROJECT_PATTERNS: readonly string[] = [
  "/patterns/pattern-01.jpg",
  "/patterns/pattern-02.jpg",
  "/patterns/pattern-03.jpg",
  "/patterns/pattern-04.jpg",
  "/patterns/pattern-05.jpg",
  "/patterns/pattern-06.jpg",
  "/patterns/pattern-07.jpg",
  "/patterns/pattern-08.jpg",
  "/patterns/pattern-09.jpg",
  "/patterns/pattern-10.jpg",
  "/patterns/pattern-11.jpg",
  "/patterns/pattern-12.jpg",
  "/patterns/pattern-13.jpg",
  "/patterns/pattern-14.jpg",
  "/patterns/pattern-15.jpg",
  "/patterns/pattern-16.jpg",
];

export function defaultPatternFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PROJECT_PATTERNS[Math.abs(hash) % PROJECT_PATTERNS.length] ?? PROJECT_PATTERNS[0]!;
}
