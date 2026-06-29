/**
 * @design-ref 06-Mastra Runtime.md § Runtime Agent Construction
 *
 * AI Runtime이 Vercel AI Gateway 모델 정책을 소유한다.
 * actor snapshot의 modelProvider/modelName은 레거시 입력으로만 받으며 직접 provider 선택에 사용하지 않는다.
 */
import { gateway, type GatewayModelId } from "@ai-sdk/gateway";

export interface ModelSelector {
  modelProvider?: string;
  modelName?: string;
}

const DEFAULT_GATEWAY_MODEL = "openai/gpt-4o-mini";
const DEFAULT_GATEWAY_FALLBACK_MODELS = ["google/gemini-2.5-flash", "anthropic/claude-3.5-haiku"];

function parseModelList(raw: string | undefined): string[] {
  if (!raw) return [];
  const models = raw
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return Array.from(new Set(models));
}

export function resolveGatewayModelId(): string {
  return process.env.AI_GATEWAY_MODEL?.trim() || DEFAULT_GATEWAY_MODEL;
}

export function resolveGatewayFallbackModels(primaryModel = resolveGatewayModelId()): string[] {
  const configured = parseModelList(process.env.AI_GATEWAY_FALLBACK_MODELS);
  const fallbackModels = configured.length > 0 ? configured : DEFAULT_GATEWAY_FALLBACK_MODELS;
  return fallbackModels.filter((model) => model !== primaryModel);
}

export function resolveGatewayProviderOptions():
  | { gateway: { models: string[] } }
  | undefined {
  const models = resolveGatewayFallbackModels();
  if (models.length === 0) return undefined;
  return { gateway: { models } };
}

export function resolveModel(_selector: ModelSelector = {}): ReturnType<typeof gateway> {
  return gateway(resolveGatewayModelId() as GatewayModelId);
}

export const FALLBACK_MODEL_INFO = {
  provider: "gateway",
  name: DEFAULT_GATEWAY_MODEL,
  fallbackModels: DEFAULT_GATEWAY_FALLBACK_MODELS,
};
