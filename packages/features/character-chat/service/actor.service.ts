import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  characterActorSnapshots,
  characterActors,
  characterChatListPreferences,
  characterChatMessages,
  characterChatThreads,
  storyCharacters,
} from "@repo/drizzle/schema";
import { Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import {
  DEFAULT_CHARACTER_CHAT_MODEL,
  DEFAULT_CHARACTER_CHAT_MODEL_NAME,
  DEFAULT_CHARACTER_CHAT_MODEL_PROVIDER,
} from "../model-defaults";

@Injectable()
export class ActorService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async getActorByCharacter(characterId: string) {
    const actor = await this.db.query.characterActors.findFirst({
      where: and(eq(characterActors.characterId, characterId), isNull(characterActors.deletedAt)),
    });
    return actor ?? null;
  }

  async listActors(projectId: string) {
    return this.db.query.characterActors.findMany({
      where: and(eq(characterActors.projectId, projectId), isNull(characterActors.deletedAt)),
      with: { character: true },
    });
  }

  async prepareActor(input: { projectId: string; characterId: string; userId: string }) {
    const { projectId, characterId, userId } = input;

    const existing = await this.db.query.characterActors.findFirst({
      where: and(eq(characterActors.characterId, characterId), isNull(characterActors.deletedAt)),
    });

    if (existing) {
      const updated = await this.db
        .update(characterActors)
        .set({ status: "preparing", enabled: true, disabledAt: null })
        .where(eq(characterActors.id, existing.id))
        .returning()
        .then((r) => r[0]);
      if (!updated) throw new NotFoundException("Actor not found after update");

      const character = await this.db.query.storyCharacters.findFirst({
        where: eq(storyCharacters.id, characterId),
      });

      // 재활성화 시 snapshot 갱신
      await this.db.insert(characterActorSnapshots).values({
        actorId: updated.id,
        projectId,
        characterId,
        personaSummary: character?.description ?? "",
        speechStyle: "",
        backgroundSummary: character?.body ?? "",
        toolScope: [
          "readCharacterProfile",
          "readCharacterRelations",
          "readWorldLore",
          "readLocations",
          "readFactions",
        ],
        safetyRules: "캐릭터 지식 범위 밖 정보 사용 금지. 공식 설정 변경 불가.",
        modelConfig: DEFAULT_CHARACTER_CHAT_MODEL,
        sourceUpdatedAt: character?.updatedAt ?? new Date(),
      });

      const ready = await this.db
        .update(characterActors)
        .set({ status: "ready", sourceUpdatedAt: new Date() })
        .where(eq(characterActors.id, updated.id))
        .returning()
        .then((r) => r[0]);
      if (!ready) throw new NotFoundException("Actor not found after ready update");

      // 재활성화 시 hidden preference 초기화 — sidebar에 다시 노도하기 위해
      await this.db
        .update(characterChatListPreferences)
        .set({ hiddenAt: null })
        .where(
          and(
            eq(characterChatListPreferences.actorId, ready.id),
            isNull(characterChatListPreferences.deletedAt),
          ),
        );

      await this._createGreeting(
        ready.id,
        projectId,
        characterId,
        userId,
        character?.name ?? "오퍼레이터",
        {
          personaSummary: character?.description ?? "",
          speechStyle: "",
          backgroundSummary: character?.body ?? "",
          modelProvider: DEFAULT_CHARACTER_CHAT_MODEL_PROVIDER,
          modelName: DEFAULT_CHARACTER_CHAT_MODEL_NAME,
        },
      );
      return ready;
    }

    const actor = await this.db
      .insert(characterActors)
      .values({
        projectId,
        characterId,
        createdByUserId: userId,
        status: "preparing",
        enabled: true,
      })
      .returning()
      .then((r) => r[0]);
    if (!actor) throw new NotFoundException("Actor not found after insert");

    // character 정보 조회 (스냅샷 생성용)
    const character = await this.db.query.storyCharacters.findFirst({
      where: eq(storyCharacters.id, characterId),
    });

    // Profile Snapshot 생성 — Actor 준비 확인 직후 저장
    // 저장 대상: persona, speech, background, toolScope, safetyRules, modelConfig, sourceUpdatedAt
    await this.db.insert(characterActorSnapshots).values({
      actorId: actor.id,
      projectId,
      characterId,
      personaSummary: character?.description ?? "",
      speechStyle: "",
      backgroundSummary: character?.body ?? "",
      toolScope: [
        "readCharacterProfile",
        "readCharacterRelations",
        "readWorldLore",
        "readLocations",
        "readFactions",
      ],
      safetyRules: "캐릭터 지식 범위 밖 정보 사용 금지. 공식 설정 변경 불가.",
      modelConfig: DEFAULT_CHARACTER_CHAT_MODEL,
      sourceUpdatedAt: character?.updatedAt ?? new Date(),
    });

    // ready 전환
    const ready = await this.db
      .update(characterActors)
      .set({ status: "ready", sourceUpdatedAt: new Date() })
      .where(eq(characterActors.id, actor.id))
      .returning()
      .then((r) => r[0]);
    if (!ready) throw new NotFoundException("Actor not found after ready update");

    // Fix 1: 첫 인사 메시지 생성 (AI Runtime LLM 호출)
    await this._createGreeting(
      ready.id,
      projectId,
      characterId,
      userId,
      character?.name ?? "오퍼레이터",
      {
        personaSummary: character?.description ?? "",
        speechStyle: "",
        backgroundSummary: character?.body ?? "",
        modelProvider: DEFAULT_CHARACTER_CHAT_MODEL_PROVIDER,
        modelName: DEFAULT_CHARACTER_CHAT_MODEL_NAME,
      },
    );

    return ready;
  }

  private async _generateGreetingText(
    characterName: string,
    snapshot: {
      personaSummary: string;
      speechStyle: string;
      backgroundSummary: string;
      modelProvider: string;
      modelName: string;
    },
  ): Promise<string> {
    const fallback = `${characterName}입니다. 만나서 반갑습니다.`;
    const aiRuntimeUrl = process.env.AI_RUNTIME_URL ?? "http://localhost:3003";
    try {
      const res = await fetch(`${aiRuntimeUrl}/api/chat/greeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorSnapshotData: snapshot, characterName }),
      });
      if (!res.ok) {
        console.warn("[operator-chat] greeting non-2xx, using fallback", res.status);
        return fallback;
      }
      const data = (await res.json()) as { text?: string };
      const text = (data.text ?? "").trim();
      return text || fallback;
    } catch (e) {
      console.warn("[operator-chat] greeting fetch failed, using fallback", e);
      return fallback;
    }
  }

  private async _createGreeting(
    actorId: string,
    projectId: string,
    characterId: string,
    userId: string,
    characterName: string,
    snapshot: {
      personaSummary: string;
      speechStyle: string;
      backgroundSummary: string;
      modelProvider: string;
      modelName: string;
    },
  ): Promise<void> {
    const [thread] = await this.db
      .insert(characterChatThreads)
      .values({ projectId, characterId, actorId, userId, title: "첫 대화" })
      .returning();
    if (!thread) return;

    const greeting = await this._generateGreetingText(characterName, snapshot);
    const [greetingMsg] = await this.db
      .insert(characterChatMessages)
      .values({
        threadId: thread.id,
        role: "assistant",
        status: "completed",
        content: greeting,
        completedAt: new Date(),
      })
      .returning();
    if (!greetingMsg) return;

    await this.db
      .update(characterActors)
      .set({ greetingMessageId: greetingMsg.id })
      .where(eq(characterActors.id, actorId));
  }

  async disableActor(actorId: string) {
    const actor = await this.db.query.characterActors.findFirst({
      where: and(eq(characterActors.id, actorId), isNull(characterActors.deletedAt)),
    });
    if (!actor) throw new NotFoundException("Actor not found");

    const [updated] = await this.db
      .update(characterActors)
      .set({ status: "disabled", enabled: false, disabledAt: new Date() })
      .where(eq(characterActors.id, actorId))
      .returning();
    return updated;
  }
}
