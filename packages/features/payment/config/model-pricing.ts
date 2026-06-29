/**
 * Model cost calculation — token → cents.
 *
 * Uses hardcoded pricing table as the source of truth for now
 * (DB table `payment_model_pricing` is the long-term owner; this module
 * is the runtime fallback used by AiUsageMeterService until a DB-backed
 * resolver is wired in a later task).
 *
 * Pricing unit: cents per 1M tokens (to match Anthropic/OpenAI pricing page).
 * Formula: ceil((inputTokens / 1_000_000) * inputCentsPer1M
 *               + (outputTokens / 1_000_000) * outputCentsPer1M)
 * Minimum = 1 cent per call (avoid zero-cost no-ops).
 */

interface ModelPrice {
  inputCentsPer1M: number;
  outputCentsPer1M: number;
}

/**
 * Hardcoded model pricing (cents per 1M tokens).
 * Source: Anthropic pricing page as of 2026-04.
 * claude-sonnet-4: input $3/1M = 300 cents, output $15/1M = 1500 cents.
 * claude-haiku-3: input $0.25/1M = 25 cents, output $1.25/1M = 125 cents.
 */
const MODEL_PRICING: Record<string, ModelPrice> = {
  "claude-sonnet-4": { inputCentsPer1M: 300, outputCentsPer1M: 1500 },
  "claude-sonnet-3-5": { inputCentsPer1M: 300, outputCentsPer1M: 1500 },
  "claude-haiku-3-5": { inputCentsPer1M: 25, outputCentsPer1M: 125 },
  "claude-haiku-3": { inputCentsPer1M: 25, outputCentsPer1M: 125 },
  "claude-opus-4": { inputCentsPer1M: 1500, outputCentsPer1M: 7500 },
};

const DEFAULT_PRICING: ModelPrice = { inputCentsPer1M: 300, outputCentsPer1M: 1500 };

/**
 * Calculate actual cost in cents for a completed AI call.
 * Returns an integer (rounded up), minimum 1.
 */
export function calculateModelCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const raw =
    (inputTokens / 1_000_000) * pricing.inputCentsPer1M +
    (outputTokens / 1_000_000) * pricing.outputCentsPer1M;
  return Math.max(1, Math.ceil(raw));
}
