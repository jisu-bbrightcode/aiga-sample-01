/**
 * Standard list / row / option row height in pixels for virtualized lists.
 *
 * Mirrors the `h-8` Tailwind utility (32px) used by static list rows, so the
 * virtualizer windowing geometry stays in sync with the design token.
 *
 * A virtualizer (`@tanstack/react-virtual`) needs a numeric pixel height to
 * compute scroll offsets and the visible window — this cannot be a Tailwind
 * className. This constant is the single source of truth for that value;
 * import it instead of hardcoding `32`.
 */
export const LIST_ROW_HEIGHT = 32;
