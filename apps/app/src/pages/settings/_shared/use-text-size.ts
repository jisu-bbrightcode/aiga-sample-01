/**
 * useTextSize — single source of truth for the user's preferred text size
 * within the settings redesign. Persists to localStorage (instant, used by
 * the index.html bootstrap script for zero-flicker first paint) and applies
 * the value to `<html data-text-size>` so the per-level absolute --fs-* tokens
 * (packages/ui/src/typography.css) cascade through every text-*
 * tailwind utility.
 *
 * Server persistence (user_preferences key='text_size') is wired up in
 * Phase 1's TextSizeSection — this hook intentionally stays UI-only so it
 * can be used before login (settings preview, etc.).
 */
import { useCallback, useEffect, useState } from "react";

export type TextSize = "sm" | "md" | "lg";

const STORAGE_KEY = "product-builder:text-size";

function read(): TextSize {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "md" || v === "lg" ? v : "sm";
  } catch {
    return "sm";
  }
}

function applyToDOM(v: TextSize) {
  if (typeof document === "undefined") return;
  if (v === "sm") {
    delete document.documentElement.dataset.textSize;
  } else {
    document.documentElement.dataset.textSize = v;
  }
}

export function useTextSize() {
  const [size, setSizeState] = useState<TextSize>(read);

  useEffect(() => {
    applyToDOM(size);
  }, [size]);

  const setSize = useCallback((next: TextSize) => {
    try {
      if (next === "sm") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private mode, server) — apply DOM only.
    }
    setSizeState(next);
  }, []);

  return { size, setSize };
}
