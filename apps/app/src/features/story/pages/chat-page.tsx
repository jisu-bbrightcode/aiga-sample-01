"use no memo";

import { ANALYTICS_EVENTS, captureEvent } from "@repo/core/analytics/client";
import { useFeatureTranslation } from "@repo/core/i18n";
import { useEntityProperties } from "@repo/data/hooks";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@repo/ui/ai/conversation";
import { Message, MessageContent } from "@repo/ui/ai/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@repo/ui/ai/prompt-input";
import { PageLayout } from "@repo/ui/components/page-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/shadcn/avatar";
import { Button } from "@repo/ui/shadcn/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { MessageCircle, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  characterChatKeys,
  createCharacterChatSession,
  setLastOpenedCharacterChatThread,
  useCharacterActors,
  useCharacterChatMessages,
  useCharacterChatThreads,
  useLastOpenedCharacterChatThread,
} from "../api/operator-chat";

const AI_RUNTIME_URL = import.meta.env.VITE_AI_RUNTIME_URL ?? "http://localhost:3003";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "completed" | "streaming" | "failed" | "interrupted";
}

interface ActorSnapshotData {
  personaSummary: string;
  speechStyle: string;
  backgroundSummary: string;
  modelProvider: string;
  modelName: string;
  toolScope?: string[];
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: chat page state machine
export function ChatPage() {
  const { projectId, characterId } = useParams({ strict: false }) as {
    projectId: string;
    characterId?: string;
  };
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useFeatureTranslation("feature.story");

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 현재 source entity(characterId)에 대한 operator thread 목록
  const { data: threads = [] } = useCharacterChatThreads({
    projectId,
    characterId: characterId ?? "",
  });

  // 선택된 thread의 DB messages
  const { data: dbMessages = [] } = useCharacterChatMessages(selectedThreadId ?? "");

  // actor 목록
  const { data: actors = [] } = useCharacterActors(projectId);
  const currentActor = actors.find((a) => a.characterId === characterId);

  // source entity avatar (entity properties 시스템에서 imageSmallUrl)
  const { data: entityProps } = useEntityProperties(characterId ?? "", "character");
  const characterImageUrl = entityProps?.properties?.find((p) => p.key === "imageSmallUrl")
    ?.value as string | undefined;
  const characterName =
    currentActor?.displayName ?? currentActor?.character?.name ?? t("chat.characterFallback");
  const characterInitial = characterName.trim().charAt(0) || "?";

  // last_opened_thread_id 조회 (하나의 actor 기준)
  const { data: lastOpenedThreadId } = useLastOpenedCharacterChatThread(currentActor?.id ?? "");
  const setLastOpenedMutation = useMutation({
    mutationFn: setLastOpenedCharacterChatThread,
  });

  // 첫 진입 시 thread 자동 선택: last_opened 우선, 없으면 최신
  useEffect(() => {
    if (!threads.length || selectedThreadId) return;
    const exists = (id: string) => threads.some((t) => t.id === id);
    // threads는 desc(updatedAt) 정렬 → threads[0]이 가장 최신
    const target =
      lastOpenedThreadId && exists(lastOpenedThreadId) ? lastOpenedThreadId : threads[0]?.id;
    if (target) setSelectedThreadId(target);
  }, [threads, selectedThreadId, lastOpenedThreadId]);

  // characterId 변경 시 초기화
  useEffect(() => {
    setSelectedThreadId(null);
    setLocalMessages([]);
  }, [characterId]);

  // thread 변경 시 localMessages 초기화 (다른 thread 도의 잔존 메시지 제거)
  useEffect(() => {
    setLocalMessages([]);
  }, [selectedThreadId]);

  const createSessionMutation = useMutation({
    mutationFn: createCharacterChatSession,
  });

  const dbAsChatMessages: ChatMessage[] = dbMessages.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content ?? "",
    status: (m.status ?? "completed") as ChatMessage["status"],
  }));

  // 스트리밍 중이거나 주고받은 직후 localMessages가 있다면 그걸 우선 (DB 저장 지연 대비)
  const displayMessages: ChatMessage[] =
    localMessages.length >= dbAsChatMessages.length && localMessages.length > 0
      ? localMessages
      : dbAsChatMessages;

  // failed/interrupted assistant 메시지 직전 user 메시지를 찾아 다시 전송
  const retryFromAssistant = (assistantMsgId: string) => {
    const idx = displayMessages.findIndex((m) => m.id === assistantMsgId);
    if (idx <= 0) return;
    // 앞으로 거슬러 올라가며 가장 가까운 user 메시지
    for (let i = idx - 1; i >= 0; i--) {
      const candidate = displayMessages[i];
      if (candidate?.role === "user" && candidate.content) {
        void handleSubmit({ text: candidate.content, files: [] });
        return;
      }
    }
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SSE stream pipeline + state
  const handleSubmit = async (message: PromptInputMessage) => {
    if (!characterId || isStreaming) return;
    const userMessage = message.text.trim();
    if (!userMessage) return;
    captureEvent(ANALYTICS_EVENTS.AI_CHAT_MESSAGE_SENT, { project_id: projectId });

    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();
    // 기존 표시 중인 메시지에 추가 (DB 렌더링 잠수에 일관되게)
    const base: ChatMessage[] =
      localMessages.length >= dbAsChatMessages.length && localMessages.length > 0
        ? localMessages
        : dbAsChatMessages;
    setLocalMessages([
      ...base,
      { id: userMsgId, role: "user", content: userMessage, status: "completed" },
      { id: assistantMsgId, role: "assistant", content: "", status: "streaming" },
    ]);
    setIsStreaming(true);

    try {
      // 1. tRPC chatSession.create → streamToken + actorSnapshotData
      const session = await createSessionMutation.mutateAsync({
        projectId,
        characterId,
        userMessage,
      });
      setSelectedThreadId(session.threadId);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const historyMessages = dbMessages
        .filter((m) => m.status === "completed")
        .slice(-10)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }));

      const response = await fetch(`${AI_RUNTIME_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamToken: session.streamToken,
          userMessage,
          actorSnapshotData: session.actorSnapshotData as unknown as ActorSnapshotData,
          threadMessages: historyMessages,
          characterName: currentActor?.displayName ?? currentActor?.character?.name ?? "오퍼레이터",
          characterId,
        }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed: ${response.status}`);
      }

      // 3. Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      const finalStatus: "completed" | "failed" | "interrupted" = "completed";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data) as { text?: string };
            if (parsed.text) {
              accumulated += parsed.text;
              setLocalMessages((prev) =>
                prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulated } : m)),
              );
            }
          } catch {
            /* ignore */
          }
        }
      }

      setLocalMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, status: finalStatus } : m)),
      );
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const status = isAbort ? "interrupted" : "failed";
      setLocalMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, status } : m)));
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      // ai-runtime이 saveAssistant를 완료한 뒤 DB 동기화
      setTimeout(() => {
        if (selectedThreadId) {
          void queryClient.invalidateQueries({
            queryKey: characterChatKeys.messages(selectedThreadId),
          });
        }
      }, 1500);
    }
  };

  return (
    <PageLayout
      crumbs={[
        { label: t("chat.crumbs.title") },
        {
          label:
            currentActor?.displayName ?? currentActor?.character?.name ?? t("chat.crumbs.fallback"),
        },
      ]}
    >
      <div className="flex h-full min-h-0" data-el="chat-page">
        {/* Left pane: thread list */}
        <div
          className="flex h-full w-60 shrink-0 flex-col border-r"
          data-el="chat.thread-list-pane"
        >
          <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
            <span className="text-base font-medium">{t("chat.threadList.title")}</span>
            {currentActor?.status === "ready" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                data-el="chat.new-thread-btn"
                onClick={() => {
                  setSelectedThreadId(null);
                  setLocalMessages([]);
                }}
              >
                <Plus className="size-3.5" />
              </Button>
            )}
          </div>

          {threads.length === 0 ? (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground"
              data-el="chat.thread-list-empty"
            >
              <MessageCircle className="h-8 w-8 opacity-30" />
              <p>{t("chat.threadList.empty")}</p>
            </div>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto py-1" data-el="chat.thread-list">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <Button
                    variant="ghost"
                    className={
                      "hover:bg-muted/60 flex h-auto w-full items-center justify-start gap-2 rounded-none px-3 py-2 text-left text-sm font-normal " +
                      (selectedThreadId === thread.id ? "bg-muted font-medium" : "")
                    }
                    data-el="chat.thread-item"
                    data-active={selectedThreadId === thread.id ? "" : undefined}
                    data-thread-id={thread.id}
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                      setLocalMessages([]);
                      if (currentActor?.id) {
                        setLastOpenedMutation.mutate({
                          projectId,
                          actorId: currentActor.id,
                          threadId: thread.id,
                        });
                      }
                      navigate({
                        to: "/p/$projectId/chat/$characterId",
                        params: { projectId, characterId: characterId ?? "" },
                      });
                    }}
                  >
                    <MessageCircle className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">
                      {thread.title ?? t("chat.threadList.newThread")}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right pane: chat area */}
        <div className="flex h-full min-w-0 flex-1 flex-col" data-el="chat.message-pane">
          {characterId ? (
            <>
              <Conversation className="min-h-0 flex-1" data-el="chat.message-list">
                <ConversationContent>
                  {displayMessages.length === 0 ? (
                    <ConversationEmptyState
                      icon={<MessageCircle className="h-10 w-10" />}
                      title={t("chat.empty.title")}
                      description={t("chat.empty.description")}
                    />
                  ) : (
                    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: render branches per message status
                    displayMessages.map((msg) => (
                      <Message
                        key={msg.id}
                        from={msg.role}
                        data-el="chat.message-item"
                        data-role={msg.role}
                        className={
                          msg.role === "assistant" ? "flex-row items-start gap-3" : undefined
                        }
                      >
                        {msg.role === "assistant" && (
                          <Avatar className="mt-0.5 size-8 shrink-0" data-el="chat.message-avatar">
                            {characterImageUrl ? (
                              <AvatarImage
                                src={characterImageUrl}
                                alt={characterName}
                                crossOrigin="anonymous"
                              />
                            ) : null}
                            <AvatarFallback className="text-xs">{characterInitial}</AvatarFallback>
                          </Avatar>
                        )}
                        <MessageContent className="text-base">
                          {msg.content || (msg.status === "streaming" ? "…" : "")}
                          {msg.status === "failed" && msg.role === "assistant" && (
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-destructive text-xs">
                                {t("chat.message.sendFailed")}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                data-el="chat.retry-btn"
                                onClick={() => retryFromAssistant(msg.id)}
                              >
                                {t("chat.message.retry")}
                              </Button>
                            </div>
                          )}
                          {msg.status === "interrupted" && msg.role === "assistant" && (
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-muted-foreground text-xs">
                                {t("chat.message.interrupted")}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                data-el="chat.retry-btn"
                                onClick={() => retryFromAssistant(msg.id)}
                              >
                                {t("chat.message.continueRetry")}
                              </Button>
                            </div>
                          )}
                        </MessageContent>
                      </Message>
                    ))
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>

              <div className="shrink-0 border-t p-3" data-el="chat.composer">
                <PromptInput
                  onSubmit={(msg) => {
                    void handleSubmit(msg);
                  }}
                >
                  <PromptInputBody>
                    <PromptInputTextarea
                      placeholder={
                        currentActor?.status === "ready"
                          ? t("chat.composer.placeholderReady")
                          : t("chat.composer.placeholderNotReady")
                      }
                      disabled={isStreaming || currentActor?.status !== "ready"}
                      data-el="chat.composer-input"
                    />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputTools />
                    <PromptInputSubmit
                      status={isStreaming ? "streaming" : "ready"}
                      disabled={currentActor?.status !== "ready"}
                      data-el="chat.send-btn"
                      onClick={() => {
                        if (isStreaming) abortControllerRef.current?.abort();
                      }}
                    />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </>
          ) : (
            <div
              className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3"
              data-el="chat.no-character-selected"
            >
              <MessageCircle className="h-12 w-12 opacity-20" />
              <p className="text-sm">{t("chat.noCharacterSelected")}</p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
