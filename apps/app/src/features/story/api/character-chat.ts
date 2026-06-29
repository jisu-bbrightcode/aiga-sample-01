import type { QueryKey } from "@tanstack/react-query";
import { $api, apiClient } from "@/lib/api";

export interface CharacterChatActor {
  id: string;
  characterId: string;
  status: "not_enabled" | "preparing" | "ready" | "failed" | "disabled";
  displayName?: string | null;
  character?: { name?: string | null } | null;
}

export interface CharacterChatThread {
  id: string;
  title?: string | null;
}

export interface CharacterChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content?: string | null;
  status?: "pending" | "streaming" | "completed" | "failed" | "interrupted";
}

export interface CharacterChatSession {
  threadId: string;
  userMessageId: string;
  streamToken: string;
  actorSnapshotData: Record<string, unknown>;
}

export const characterChatKeys = {
  actorByCharacter: (characterId: string) =>
    [
      "get",
      "/api/operator-chat/actors/by-character/{characterId}",
      { params: { path: { characterId } } },
    ] as const,
  actors: (projectId: string) =>
    ["get", "/api/operator-chat/actors", { params: { query: { projectId } } }] as const,
  hiddenActorIds: (projectId: string) =>
    [
      "get",
      "/api/operator-chat/chat-list/hidden-actor-ids",
      { params: { query: { projectId } } },
    ] as const,
  lastOpenedThread: (actorId: string) =>
    [
      "get",
      "/api/operator-chat/chat-list/last-opened",
      { params: { query: { actorId } } },
    ] as const,
  threads: (projectId: string, characterId: string) =>
    [
      "get",
      "/api/operator-chat/threads",
      { params: { query: { projectId, characterId } } },
    ] as const,
  messages: (threadId: string) =>
    [
      "get",
      "/api/operator-chat/threads/{threadId}/messages",
      { params: { path: { threadId } } },
    ] as const,
};

function requireData<T>(data: T | undefined): T {
  if (data === undefined) {
    throw new Error("REST response body missing");
  }
  return data;
}

export function useCharacterActorByCharacter(characterId: string) {
  return $api.useQuery(
    "get",
    "/api/operator-chat/actors/by-character/{characterId}",
    {
      params: { path: { characterId } },
    },
    {
      enabled: !!characterId,
      queryKey: characterChatKeys.actorByCharacter(characterId) as QueryKey,
      refetchInterval: (query) => {
        const actor = query.state.data as CharacterChatActor | null | undefined;
        return actor?.status === "preparing" ? 2000 : false;
      },
      select: (data) => (data ?? null) as CharacterChatActor | null,
    },
  );
}

export function useCharacterActors(projectId: string) {
  return $api.useQuery(
    "get",
    "/api/operator-chat/actors",
    {
      params: { query: { projectId } },
    },
    {
      enabled: !!projectId,
      queryKey: characterChatKeys.actors(projectId) as QueryKey,
      select: (data) => data as unknown as CharacterChatActor[],
    },
  );
}

export async function prepareCharacterActor(input: { projectId: string; characterId: string }) {
  const { data, error } = await apiClient.POST("/api/operator-chat/actors/prepare", {
    body: input,
  });
  if (error) throw error;
  return requireData(data) as unknown as CharacterChatActor;
}

export async function disableCharacterActor(input: { actorId: string }) {
  const { data, error } = await apiClient.POST("/api/operator-chat/actors/{actorId}/disable", {
    params: { path: { actorId: input.actorId } },
  });
  if (error) throw error;
  return requireData(data) as unknown as CharacterChatActor;
}

export function useCharacterChatThreads(input: { projectId: string; characterId: string }) {
  return $api.useQuery(
    "get",
    "/api/operator-chat/threads",
    {
      params: { query: input },
    },
    {
      enabled: !!input.characterId,
      queryKey: characterChatKeys.threads(input.projectId, input.characterId) as QueryKey,
      select: (data) => data as unknown as CharacterChatThread[],
    },
  );
}

export function useCharacterChatMessages(threadId: string) {
  return $api.useQuery(
    "get",
    "/api/operator-chat/threads/{threadId}/messages",
    {
      params: { path: { threadId } },
    },
    {
      enabled: !!threadId,
      queryKey: characterChatKeys.messages(threadId) as QueryKey,
      select: (data) => data as unknown as CharacterChatMessage[],
    },
  );
}

export async function createCharacterChatSession(input: {
  projectId: string;
  characterId: string;
  userMessage: string;
}) {
  const { data, error } = await apiClient.POST("/api/operator-chat/chat-sessions", {
    body: input,
  });
  if (error) throw error;
  return requireData(data) as CharacterChatSession;
}

export function useHiddenCharacterActorIds(projectId: string) {
  return $api.useQuery(
    "get",
    "/api/operator-chat/chat-list/hidden-actor-ids",
    {
      params: { query: { projectId } },
    },
    {
      enabled: !!projectId,
      queryKey: characterChatKeys.hiddenActorIds(projectId) as QueryKey,
      select: (data) => data.actorIds,
    },
  );
}

export async function hideCharacterChatListItem(input: { projectId: string; actorId: string }) {
  const { data, error } = await apiClient.POST("/api/operator-chat/chat-list/hide", {
    body: input,
  });
  if (error) throw error;
  return data;
}

export function useLastOpenedCharacterChatThread(actorId: string) {
  return $api.useQuery(
    "get",
    "/api/operator-chat/chat-list/last-opened",
    {
      params: { query: { actorId } },
    },
    {
      enabled: !!actorId,
      queryKey: characterChatKeys.lastOpenedThread(actorId) as QueryKey,
      select: (data) => data.threadId,
    },
  );
}

export async function setLastOpenedCharacterChatThread(input: {
  projectId: string;
  actorId: string;
  threadId: string;
}) {
  const { error } = await apiClient.PUT("/api/operator-chat/chat-list/last-opened", {
    body: input,
  });
  if (error) throw error;
}
