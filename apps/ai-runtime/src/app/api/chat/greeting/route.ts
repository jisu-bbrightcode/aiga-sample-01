/**
 * @design-ref 06-Mastra Runtime.md § First Greeting
 *
 * 첫 인사 생성 엔드포인트. Actor 준비 직후 1회 호출.
 * Streaming이 아니라 generate로 짧은 인사를 한 번에 받는다.
 */
import { Agent } from "@mastra/core/agent";
import type { NextRequest } from "next/server";
import { buildCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { resolveGatewayProviderOptions, resolveModel } from "@/lib/model-factory";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ActorSnapshotData {
  personaSummary: string;
  speechStyle: string;
  backgroundSummary: string;
  modelProvider: string;
  modelName: string;
}

interface GreetingRequestBody {
  actorSnapshotData: ActorSnapshotData;
  characterName: string;
}

function buildGreetingInstructions(
  snapshot: ActorSnapshotData,
  characterName: string,
): string {
  const parts: string[] = [
    `당신은 "${characterName}"입니다.`,
    `지금은 작가가 당신과 처음 만나는 순간입니다.`,
    `한 문장 또는 짧은 두 문장으로 인사하세요. 절대 길게 말하지 마세요.`,
    `"무엇을 도와드릴까요?" 같은 비서 톤은 절대 사용하지 마세요.`,
    `당신의 말투, 세계관, 정체성이 한 마디에 드러나야 합니다.`,
    `자기소개를 거창하게 하지 말고, 그 순간 당신이 자연스럽게 할 말을 하세요.`,
  ];

  if (snapshot.personaSummary) parts.push(`\n## 페르소나\n${snapshot.personaSummary}`);
  if (snapshot.speechStyle) parts.push(`\n## 말투\n${snapshot.speechStyle}`);
  if (snapshot.backgroundSummary) parts.push(`\n## 배경\n${snapshot.backgroundSummary}`);

  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GreetingRequestBody;
    const { actorSnapshotData: snapshot, characterName } = body;
    if (!snapshot || !characterName) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: buildCorsHeaders(req.headers),
      });
    }

    // AI_MOCK 모드: 비용 없이 fixed 문자열 반환 (E2E 용)
    if (process.env.AI_MOCK === "true") {
      return Response.json(
        { text: `[mock] ${characterName}, 첫 만남이군.` },
        { headers: buildCorsHeaders(req.headers) },
      );
    }

    const agent = new Agent({
      id: `greeting-${characterName}`,
      name: characterName,
      instructions: buildGreetingInstructions(snapshot, characterName),
      model: resolveModel({
        modelProvider: snapshot.modelProvider,
        modelName: snapshot.modelName,
      }),
      defaultOptions: {
        providerOptions: resolveGatewayProviderOptions(),
      },
    });

    const result = await agent.generate([
      { role: "user", content: "첫 인사를 한 문장으로 해주세요." },
    ]);

    const text = typeof result.text === "string" ? result.text.trim() : "";
    if (!text) {
      return Response.json(
        { error: "Empty greeting" },
        { status: 502, headers: buildCorsHeaders(req.headers) },
      );
    }
    return Response.json({ text }, { headers: buildCorsHeaders(req.headers) });
  } catch (e) {
    console.error("[ai-runtime] greeting error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: buildCorsHeaders(req.headers, undefined, { "Content-Type": "application/json" }),
    });
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req);
}
