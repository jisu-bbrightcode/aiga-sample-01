import { z } from "zod";
import { parseStoryDocOrNull } from "../lib/parse-story-doc";

/**
 * Feature flag — set STORY_DOC_VALIDATOR_ENABLED=false to disable strict
 * Document JSON validation server-side (fail-open). Default: enabled.
 *
 * Read at module load. Tests using `vi.resetModules()` (or jest equivalent)
 * can flip the flag and re-import for transition assertions (Phase 9.1).
 */
const VALIDATOR_ENABLED = process.env.STORY_DOC_VALIDATOR_ENABLED !== "false";

/**
 * Reusable zod refinement for the `body` column on every story entity DTO.
 * - `null` is allowed (post-wipe / unset state).
 * - Non-null strings must parse as a valid Product Builder document JSON.
 * - When the validator is disabled, all values pass (fail-open rollback).
 */
export const storyDocString = z
  .string()
  .nullable()
  .refine(
    (val) => {
      if (!VALIDATOR_ENABLED) return true;
      return val === null || parseStoryDocOrNull(val) !== null;
    },
    { message: "Document JSON 형식만 허용" },
  );
