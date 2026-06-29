// @ts-nocheck
/**
 * VibeProxy model providers for Pi.
 *
 * VibeProxy manages Claude CLI / Codex CLI / Copilot / Gemini / Antigravity
 * credentials itself. Pi only sends requests to the local proxy with a dummy
 * API key.
 *
 * Requirements:
 * - VibeProxy running on http://localhost:8317
 * - Desired accounts connected in VibeProxy settings
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface VibeProxyModel {
  id: string;
  owned_by?: string;
}

const VIBEPROXY_BASE = process.env.VIBEPROXY_BASE_URL ?? "http://localhost:8317";
const DUMMY_API_KEY = process.env.VIBEPROXY_API_KEY ?? "dummy-not-used";
const COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

function isClaudeModel(id: string, owner?: string): boolean {
  return owner === "anthropic" || id.startsWith("claude-") || id.startsWith("gemini-claude-");
}

function displayName(id: string, owner?: string): string {
  const prefix = owner ? `${owner}: ` : "";
  return `VibeProxy ${prefix}${id}`;
}

function contextWindowFor(id: string, _owner?: string): number {
  // Legacy Claude 3.x tops out at 200K. Claude 4 family (Sonnet/Opus 4+) supports 1M.
  if (/^claude-3[-.]/i.test(id)) return 200_000;
  return 1_000_000;
}

function openAiModel(model: VibeProxyModel) {
  const id = model.id;
  return {
    id,
    name: displayName(id, model.owned_by),
    reasoning: /gpt|gemini|qwen|glm|claude/i.test(id),
    input: ["text", "image"],
    cost: COST,
    contextWindow: contextWindowFor(id, model.owned_by),
    maxTokens: 32_000,
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: true,
    },
  };
}

function anthropicModel(model: VibeProxyModel) {
  const id = model.id;
  return {
    id,
    name: displayName(id, model.owned_by),
    reasoning: true,
    input: ["text", "image"],
    cost: COST,
    contextWindow: contextWindowFor(id, model.owned_by),
    maxTokens: 32_000,
  };
}

async function fetchVibeProxyModels(): Promise<VibeProxyModel[]> {
  try {
    const response = await fetch(`${VIBEPROXY_BASE}/v1/models`);
    if (!response.ok) return [];
    const payload = (await response.json()) as { data?: VibeProxyModel[] };
    return Array.isArray(payload.data) ? payload.data.filter((model) => model.id) : [];
  } catch {
    return [];
  }
}

function fallbackModels(): VibeProxyModel[] {
  return [
    { id: "gpt-5.5", owned_by: "openai" },
    { id: "gpt-5.3-codex", owned_by: "openai" },
    { id: "claude-opus-4-7", owned_by: "anthropic" },
    { id: "claude-sonnet-4-6", owned_by: "anthropic" },
    { id: "gemini-3.1-pro-preview", owned_by: "antigravity" },
  ];
}

export default async function vibeproxyProvider(pi: ExtensionAPI) {
  const discovered = await fetchVibeProxyModels();
  const models = discovered.length > 0 ? discovered : fallbackModels();

  pi.registerProvider("vibeproxy-openai", {
    name: "VibeProxy OpenAI-compatible",
    baseUrl: `${VIBEPROXY_BASE}/v1`,
    apiKey: DUMMY_API_KEY,
    api: "openai-completions",
    models: models.map(openAiModel),
  });

  pi.registerProvider("vibeproxy-anthropic", {
    name: "VibeProxy Anthropic-compatible",
    baseUrl: VIBEPROXY_BASE,
    apiKey: DUMMY_API_KEY,
    api: "anthropic-messages",
    models: models.filter((model) => isClaudeModel(model.id, model.owned_by)).map(anthropicModel),
  });
}
