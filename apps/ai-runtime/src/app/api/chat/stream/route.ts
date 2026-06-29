import { Agent } from "@mastra/core/agent";
import type { MessageListInput } from "@mastra/core/agent/message-list";
import { createTool } from "@mastra/core/tools";
import { buildCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { resolveGatewayProviderOptions, resolveModel } from "@/lib/model-factory";
import type { NextRequest } from "next/server";
import { z } from "zod";

// ── Read-only Lore Tools ──
// 캐릭터가 공식 설정 데이터를 참조할 수 있는 read-only tools
// Domain Server에 REST 호출로 조회

const DOMAIN_URL = process.env.DOMAIN_SERVER_URL ?? "http://localhost:3002";

async function domainGet(path: string, auth: string, query?: Record<string, string>): Promise<unknown> {
  const url = new URL(`/api${path}`, DOMAIN_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url, { headers: { Authorization: auth } });
  if (!res.ok) return null;
  return res.json();
}

function buildLoreTools(
  projectId: string,
  characterId: string,
  authHeader: string,
  toolScope?: string[],
) {
  const readCharacterProfile = createTool({
    id: "readCharacterProfile",
    description:
      "현재 캐릭터의 공식 설정 데이터를 출력합니다. 이름, 설명, 배경, 성격, 관계 등을 포함합니다.",
    inputSchema: z.object({}),
    outputSchema: z.unknown(),
    execute: async () => domainGet(`/story/characters/${characterId}`, authHeader),
  });

  const readCharacterRelations = createTool({
    id: "readCharacterRelations",
    description:
      "이 캐릭터와 다른 세계관 엔티티(캐릭터, 장소, 세력 등) 사이의 관계 정보를 가져옵니다.",
    inputSchema: z.object({}),
    outputSchema: z.unknown(),
    execute: async () =>
      domainGet("/story/relations", authHeader, {
        projectId,
        entityId: characterId,
        entityType: "character",
      }),
  });

  const readWorldLore = createTool({
    id: "readWorldLore",
    description: "세계관 목록을 가져옵니다. 세계 설정과 배경 정보를 포함합니다.",
    inputSchema: z.object({}),
    outputSchema: z.unknown(),
    execute: async () => domainGet("/story/worlds", authHeader, { projectId }),
  });

  const readLocations = createTool({
    id: "readLocations",
    description: "프로젝트의 장소 목록을 가져옵니다.",
    inputSchema: z.object({}),
    outputSchema: z.unknown(),
    execute: async () => domainGet("/story/locations", authHeader, { projectId }),
  });

  const readFactions = createTool({
    id: "readFactions",
    description: "프로젝트의 세력/조직 목록을 가져옵니다.",
    inputSchema: z.object({}),
    outputSchema: z.unknown(),
    execute: async () => domainGet("/story/factions", authHeader, { projectId }),
  });

  const all = {
    readCharacterProfile,
    readCharacterRelations,
    readWorldLore,
    readLocations,
    readFactions,
  } as const;

  // toolScope가 주어지면 화이트리스트 적용, 없으면 전체 허용
  if (!toolScope || toolScope.length === 0) return all;
  const allowed: Record<string, (typeof all)[keyof typeof all]> = {};
  for (const [name, tool] of Object.entries(all)) {
    if (toolScope.includes(name)) allowed[name] = tool;
  }
  return allowed;
}

export const runtime = "nodejs";
export const maxDuration = 60;

// Fix 5: active stream 제한 (project/user/character 단위)
const activeStreams = new Map<string, number>();
const MAX_STREAMS_PER_KEY = 1;

function streamKey(payload: StreamTokenPayload, characterId: string): string {
  return `${payload.userId}:${characterId}`;
}

interface StreamTokenPayload {
  threadId: string;
  actorId: string;
  userMessageId: string;
  userId: string;
  exp: number;
}

interface StreamRequestBody {
  streamToken: string;
  userMessage: string;
  actorSnapshotData: {
    personaSummary: string;
    speechStyle: string;
    backgroundSummary: string;
    modelProvider: string;
    modelName: string;
    toolScope?: string[];
  };
  threadMessages?: Array<{ role: "user" | "assistant"; content: string }>;
  characterName?: string;
  characterId?: string;
}

function buildCharacterInstructions(
  snapshot: StreamRequestBody["actorSnapshotData"],
  characterName: string,
): string {
  const parts: string[] = [
    `당신은 "${characterName}"입니다.`,
    `이것은 기술 지원 챗봇이 아닙니다. 작가가 자신이 만든 캐릭터를 탐색하는 창작 대화입니다.`,
    `"무엇을 도와드릴까요?" 같은 비서 톤을 절대 사용하지 마세요.`,
    `캐릭터로서 자연스럽게, 캐릭터의 말투와 감정선을 유지하며 대화하세요.`,
    `모르는 것은 단정하지 마세요. 캐릭터 관점에서 추측하거나 질문하세요.`,
    `공식 설정과 충돌하는 내용은 단정하지 마세요.`,
    `대화 중 나온 내용은 공식 설정이 아닙니다. 작가가 승인하기 전까지 대화 맥락으로만 취급하세요.`,
    `공식 설정을 확인해야 할 때는 read-only 도구를 사용하세요: 명령을 호출해 캐릭터 프로필/관계/세계관/장소/세력/퀴스트를 조회하고, 그 결과를 근거로 답하세요. 도구 결과 없으면 캐릭터 관점의 추측/질문으로 돌아가세요.`,
  ];

  if (snapshot.personaSummary) parts.push(`\n## 페르소나\n${snapshot.personaSummary}`);
  if (snapshot.speechStyle) parts.push(`\n## 말투\n${snapshot.speechStyle}`);
  if (snapshot.backgroundSummary) parts.push(`\n## 배경\n${snapshot.backgroundSummary}`);

  return parts.join("\n");
}

interface AgentBuildInput {
  snapshot: StreamRequestBody["actorSnapshotData"];
  characterName: string;
  actorId: string;
  projectId: string;
  characterId: string;
  authHeader: string;
}

function toMastraMessage(message: { role: "user" | "assistant"; content: string }) {
  if (message.role === "assistant") {
    return { role: "assistant" as const, content: message.content };
  }
  return { role: "user" as const, content: message.content };
}

function buildCharacterAgent(opts: AgentBuildInput): Agent {
  const { snapshot, characterName, actorId, projectId, characterId, authHeader } = opts;
  const tools = buildLoreTools(projectId, characterId, authHeader, snapshot.toolScope);
  return new Agent({
    id: `character-${actorId}`,
    name: characterName,
    instructions: buildCharacterInstructions(snapshot, characterName),
    model: resolveModel({
      modelProvider: snapshot.modelProvider,
      modelName: snapshot.modelName,
    }),
    defaultOptions: {
      providerOptions: resolveGatewayProviderOptions(),
    },
    tools,
  });
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const body: StreamRequestBody = await req.json();
    const {
      streamToken,
      userMessage,
      actorSnapshotData,
      threadMessages = [],
      characterName = "캐릭터",
      characterId = "unknown",
    } = body;

    // streamToken 검증
    let payload: StreamTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(streamToken, "base64url").toString()) as StreamTokenPayload;
      if (payload.exp < Date.now()) {
        return new Response(JSON.stringify({ error: "Stream token expired" }), {
          status: 401,
          headers: buildCorsHeaders(req.headers),
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid stream token" }), {
        status: 401,
        headers: buildCorsHeaders(req.headers),
      });
    }

    // Fix 5: active stream 제한
    const key = streamKey(payload, characterId);
    const current = activeStreams.get(key) ?? 0;
    if (current >= MAX_STREAMS_PER_KEY) {
      return new Response(JSON.stringify({ error: "Already streaming for this character" }), {
        status: 429,
        headers: buildCorsHeaders(req.headers),
      });
    }
    activeStreams.set(key, current + 1);

    // Fix 2: client disconnect 감지용 AbortController
    const abortController = new AbortController();
    req.signal.addEventListener("abort", () => abortController.abort());

    // AI_MOCK=true: E2E 전용 mock 모드
    if (process.env.AI_MOCK === "true") {
      const mockResponse = `[${characterName}] ${buildCharacterInstructions(actorSnapshotData, characterName).split("\n")[0]} | "${userMessage}"`;
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for (const char of mockResponse) {
              if (abortController.signal.aborted) break;
              controller.enqueue(
                new TextEncoder().encode(`data: ${JSON.stringify({ text: char })}\n\n`),
              );
              await new Promise((r) => globalThis.setTimeout(r, 10));
            }
            controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          } finally {
            controller.close();
            activeStreams.set(key, (activeStreams.get(key) ?? 1) - 1);
          }
        },
      });
      return new Response(stream, {
        headers: buildCorsHeaders(req.headers, undefined, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        }),
      });
    }

    // Mastra operator agent 구성 (request 시점, snapshot 기반)
    const authHeader = req.headers.get("Authorization") ?? "";
    const agent = buildCharacterAgent({
      snapshot: actorSnapshotData,
      characterName,
      actorId: payload.actorId,
      projectId: characterId, // streamToken payload에 projectId 추가 필요 — 현재 characterId로 대체
      characterId,
      authHeader,
    });

    const messages: MessageListInput = [
      ...threadMessages.slice(-10).map(toMastraMessage),
      { role: "user", content: userMessage },
    ];

    // AI SDK v6 Gateway models require Mastra's current stream path.
    const mastraResult = await agent.stream(messages);

    const encoder = new TextEncoder();
    let accumulated = "";
    let finalStatus: "streaming" | "completed" | "interrupted" | "failed" = "completed";
    const domainUrl = process.env.DOMAIN_SERVER_URL ?? "http://localhost:3002";
    let assistantMessageId: string | undefined;
    let lastSaveAt = 0;
    let lastSavedLen = 0;
    const THROTTLE_MS = 1000;
    const THROTTLE_CHARS = 200;

    const upsert = async (
      status: "streaming" | "completed" | "interrupted" | "failed",
      duration?: number,
    ): Promise<void> => {
      try {
        const res = await fetch(`${domainUrl}/api/operator-chat/chat-sessions/assistant/upsert`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: assistantMessageId,
            threadId: payload.threadId,
            content: accumulated,
            status,
            tokenUsage: duration === undefined ? undefined : { durationMs: duration },
            streamToken,
          }),
        });
        if (!res.ok) {
          console.error("[ai-runtime] upsertAssistant non-2xx:", res.status, await res.text().catch(() => ""));
          return;
        }
        const data = (await res.json()) as { id?: string };
        const newId = data?.id;
        if (newId && !assistantMessageId) assistantMessageId = newId;
      } catch (e) {
        console.error("[ai-runtime] upsertAssistant fetch failed:", e);
      }
    };

    const readable = new ReadableStream({
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SSE stream + abort + throttle save
      async start(controller) {
        try {
          for await (const chunk of mastraResult.textStream) {
            // Fix 2: client disconnect → interrupted
            if (abortController.signal.aborted) {
              finalStatus = "interrupted";
              break;
            }
            accumulated += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));

            // throttle partial save
            const now = Date.now();
            if (
              now - lastSaveAt >= THROTTLE_MS ||
              accumulated.length - lastSavedLen >= THROTTLE_CHARS
            ) {
              lastSaveAt = now;
              lastSavedLen = accumulated.length;
              await upsert("streaming");
            }
          }
        } catch (e) {
          finalStatus = abortController.signal.aborted ? "interrupted" : "failed";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          activeStreams.set(key, (activeStreams.get(key) ?? 1) - 1);

          const duration = Date.now() - startedAt;
          // final save (이미 partial로 insert된 row의 status + content 업데이트)
          await upsert(finalStatus, duration);
        }
      },
    });

    return new Response(readable, {
      headers: buildCorsHeaders(req.headers, undefined, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      }),
    });
  } catch (error) {
    console.error("[ai-runtime] stream error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: buildCorsHeaders(req.headers),
    });
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req);
}
