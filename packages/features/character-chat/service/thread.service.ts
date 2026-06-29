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
import { and, asc, eq, isNull } from "drizzle-orm";
import { DEFAULT_CHARACTER_CHAT_MODEL } from "../model-defaults";

/**
 * 첫 user message로 thread title 생성. 앞 30자 + ellipsis.
 * 공백/개행 정리, fallback "새 대화".
 */
function buildThreadTitle(userMessage: string): string {
  const trimmed = userMessage.replace(/\s+/g, " ").trim();
  if (!trimmed) return "새 대화";
  return trimmed.length <= 30 ? trimmed : `${trimmed.slice(0, 30)}…`;
}

@Injectable()
export class ThreadService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async listThreads(projectId: string, characterId: string, userId: string) {
    return this.db.query.characterChatThreads.findMany({
      where: and(
        eq(characterChatThreads.projectId, projectId),
        eq(characterChatThreads.characterId, characterId),
        eq(characterChatThreads.userId, userId),
        isNull(characterChatThreads.deletedAt),
        isNull(characterChatThreads.archivedAt),
      ),
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
    });
  }

  async createThread(input: {
    projectId: string;
    characterId: string;
    actorId: string;
    userId: string;
    title?: string;
  }) {
    const [thread] = await this.db.insert(characterChatThreads).values(input).returning();
    return thread;
  }

  async createChatSession(input: {
    projectId: string;
    characterId: string;
    userId: string;
    userMessage: string;
  }): Promise<{
    threadId: string;
    userMessageId: string;
    streamToken: string;
    actorSnapshotData: Record<string, unknown>;
  }> {
    const { projectId, characterId, userId, userMessage } = input;

    // actor 조회
    const actor = await this.db.query.characterActors.findFirst({
      where: and(
        eq(characterActors.projectId, projectId),
        eq(characterActors.characterId, characterId),
        isNull(characterActors.deletedAt),
      ),
    });
    if (!actor || actor.status !== "ready") {
      throw new NotFoundException("Actor not ready");
    }

    // thread 생성 (없으면)
    const existingThread = await this.db.query.characterChatThreads.findFirst({
      where: and(
        eq(characterChatThreads.projectId, projectId),
        eq(characterChatThreads.characterId, characterId),
        eq(characterChatThreads.userId, userId),
        isNull(characterChatThreads.deletedAt),
        isNull(characterChatThreads.archivedAt),
      ),
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
    });

    let thread = existingThread;
    if (!thread) {
      // 첫 user message로 thread title 자동 생성 (cheap: 앞 30자)
      const title = buildThreadTitle(userMessage);
      const [created] = await this.db
        .insert(characterChatThreads)
        .values({ projectId, characterId, actorId: actor.id, userId, title })
        .returning();
      if (!created) throw new NotFoundException("Failed to create thread");
      thread = created;
    }

    // user message 즉시 저장
    const [userMsg] = await this.db
      .insert(characterChatMessages)
      .values({
        threadId: thread.id,
        role: "user",
        status: "completed",
        content: userMessage,
      })
      .returning();
    if (!userMsg) throw new NotFoundException("Failed to save user message");

    // actor snapshot 조회 — 캐릭터 공식 설정이 더 최신이면 갱신
    const snapshot = await this.db.query.characterActorSnapshots.findFirst({
      where: and(
        eq(characterActorSnapshots.actorId, actor.id),
        isNull(characterActorSnapshots.deletedAt),
      ),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    // 스펙: chat session 생성 시 snapshot sourceUpdatedAt 비교 후 필요하면 갱신
    if (snapshot) {
      const character = await this.db.query.storyCharacters.findFirst({
        where: eq(storyCharacters.id, characterId),
      });
      const characterUpdatedAt = character?.updatedAt?.getTime() ?? 0;
      const snapshotSourceAt = snapshot.sourceUpdatedAt?.getTime() ?? 0;
      if (characterUpdatedAt > snapshotSourceAt) {
        await this.db.insert(characterActorSnapshots).values({
          actorId: actor.id,
          projectId,
          characterId,
          personaSummary: character?.description ?? "",
          speechStyle: "",
          backgroundSummary: character?.body ?? "",
          toolScope: ["readCharacterProfile", "readCharacterRelations", "readWorldLore"],
          safetyRules: "캐릭터 지식 범위 밖 정보 사용 금지.",
          modelConfig: DEFAULT_CHARACTER_CHAT_MODEL,
          sourceUpdatedAt: character?.updatedAt ?? new Date(),
        });
      }
    }

    // streamToken: 간단한 base64 인코딩 (MVP — 프로덕션에서는 JWT)
    const tokenPayload = {
      threadId: thread.id,
      actorId: actor.id,
      userMessageId: userMsg.id,
      userId,
      exp: Date.now() + 60_000, // 1분
    };
    const streamToken = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");

    // operator source snapshot 정보 (snapshot이 없으면 actor 기본값 사용)
    const actorSnapshotData = snapshot
      ? {
          personaSummary: snapshot.personaSummary ?? "",
          speechStyle: snapshot.speechStyle ?? "",
          backgroundSummary: snapshot.backgroundSummary ?? "",
          modelProvider: actor.modelProvider,
          modelName: actor.modelName,
          toolScope: snapshot.toolScope ?? actor.toolScope ?? [],
        }
      : {
          personaSummary: "",
          speechStyle: "",
          backgroundSummary: "",
          toolScope: actor.toolScope ?? [],
          modelProvider: actor.modelProvider,
          modelName: actor.modelName,
        };

    return { threadId: thread.id, userMessageId: userMsg.id, streamToken, actorSnapshotData };
  }

  async saveAssistantMessage(input: {
    threadId: string;
    content: string;
    status: "completed" | "failed" | "interrupted";
    tokenUsage?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(characterChatMessages).values({
      threadId: input.threadId,
      role: "assistant",
      status: input.status,
      content: input.content,
      tokenUsage: input.tokenUsage ?? {},
      completedAt: new Date(),
    });
  }

  /**
   * Streaming partial save 용 upsert. messageId가 있으면 update, 없으면 insert해 반환.
   * status=streaming 중간 저장 + status=completed/failed/interrupted 최종 저장 모두 이 API를 사용.
   */
  async upsertAssistantMessage(input: {
    messageId?: string;
    threadId: string;
    content: string;
    status: "streaming" | "completed" | "failed" | "interrupted";
    tokenUsage?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    if (input.messageId) {
      const isFinal = input.status !== "streaming";
      const [updated] = await this.db
        .update(characterChatMessages)
        .set({
          content: input.content,
          status: input.status,
          tokenUsage: input.tokenUsage ?? {},
          ...(isFinal ? { completedAt: new Date() } : {}),
        })
        .where(eq(characterChatMessages.id, input.messageId))
        .returning({ id: characterChatMessages.id });
      if (updated) return updated;
      // 업데이트 대상 없으면 fallthrough → insert
    }
    const [inserted] = await this.db
      .insert(characterChatMessages)
      .values({
        ...(input.messageId ? { id: input.messageId } : {}),
        threadId: input.threadId,
        role: "assistant",
        status: input.status,
        content: input.content,
        tokenUsage: input.tokenUsage ?? {},
        completedAt: input.status === "streaming" ? null : new Date(),
      })
      .returning({ id: characterChatMessages.id });
    if (!inserted) throw new NotFoundException("Failed to upsert assistant message");
    return inserted;
  }

  async listMessages(threadId: string, userId: string) {
    const thread = await this.db.query.characterChatThreads.findFirst({
      where: and(
        eq(characterChatThreads.id, threadId),
        eq(characterChatThreads.userId, userId),
        isNull(characterChatThreads.deletedAt),
      ),
    });
    if (!thread) throw new NotFoundException("Thread not found");

    return this.db.query.characterChatMessages.findMany({
      where: and(
        eq(characterChatMessages.threadId, threadId),
        isNull(characterChatMessages.deletedAt),
      ),
      orderBy: [asc(characterChatMessages.createdAt)],
    });
  }

  // ── DM 목록 숨김/표시 (character_chat_list_preferences) ──

  async hideChatItem(input: { userId: string; projectId: string; actorId: string }) {
    const existing = await this.db.query.characterChatListPreferences.findFirst({
      where: and(
        eq(characterChatListPreferences.userId, input.userId),
        eq(characterChatListPreferences.actorId, input.actorId),
        isNull(characterChatListPreferences.deletedAt),
      ),
    });
    if (existing) {
      const [updated] = await this.db
        .update(characterChatListPreferences)
        .set({ hiddenAt: new Date() })
        .where(eq(characterChatListPreferences.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await this.db
      .insert(characterChatListPreferences)
      .values({ ...input, hiddenAt: new Date() })
      .returning();
    return created;
  }

  async showChatItem(input: { userId: string; actorId: string }) {
    await this.db
      .update(characterChatListPreferences)
      .set({ hiddenAt: null })
      .where(
        and(
          eq(characterChatListPreferences.userId, input.userId),
          eq(characterChatListPreferences.actorId, input.actorId),
          isNull(characterChatListPreferences.deletedAt),
        ),
      );
  }

  async getHiddenActorIds(userId: string, projectId: string): Promise<string[]> {
    const prefs = await this.db.query.characterChatListPreferences.findMany({
      where: and(
        eq(characterChatListPreferences.userId, userId),
        eq(characterChatListPreferences.projectId, projectId),
        isNull(characterChatListPreferences.deletedAt),
      ),
    });
    return prefs.filter((p) => p.hiddenAt !== null).map((p) => p.actorId);
  }

  /**
   * (user, project, actor) 조합의 last_opened_thread_id를 업데이트.
   * preferences row가 없으면 생성.
   */
  async setLastOpenedThread(input: {
    userId: string;
    projectId: string;
    actorId: string;
    threadId: string;
  }): Promise<void> {
    const existing = await this.db.query.characterChatListPreferences.findFirst({
      where: and(
        eq(characterChatListPreferences.userId, input.userId),
        eq(characterChatListPreferences.actorId, input.actorId),
        isNull(characterChatListPreferences.deletedAt),
      ),
    });
    if (existing) {
      await this.db
        .update(characterChatListPreferences)
        .set({ lastOpenedThreadId: input.threadId })
        .where(eq(characterChatListPreferences.id, existing.id));
      return;
    }
    await this.db.insert(characterChatListPreferences).values({
      userId: input.userId,
      projectId: input.projectId,
      actorId: input.actorId,
      lastOpenedThreadId: input.threadId,
    });
  }

  /**
   * (user, actor) 조합의 last_opened_thread_id를 조회. 없으면 null.
   */
  async getLastOpenedThread(userId: string, actorId: string): Promise<string | null> {
    const pref = await this.db.query.characterChatListPreferences.findFirst({
      where: and(
        eq(characterChatListPreferences.userId, userId),
        eq(characterChatListPreferences.actorId, actorId),
        isNull(characterChatListPreferences.deletedAt),
      ),
    });
    return pref?.lastOpenedThreadId ?? null;
  }
}
