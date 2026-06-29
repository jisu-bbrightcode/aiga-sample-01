import type { ActorService } from "../service/actor.service";
import type { ThreadService } from "../service/thread.service";
import { CharacterChatController } from "./character-chat.controller";
import { CharacterChatPublicController } from "./character-chat-public.controller";
import { OperatorChatController } from "./operator-chat.controller";
import { OperatorChatPublicController } from "./operator-chat-public.controller";

const user = { id: "user-1" } as never;

function services() {
  const actorService = {
    prepareActor: jest.fn().mockResolvedValue({ id: "actor-1" }),
    getActorByCharacter: jest.fn().mockResolvedValue({ id: "actor-1" }),
    disableActor: jest.fn().mockResolvedValue({ id: "actor-1" }),
    listActors: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<ActorService>;
  const threadService = {
    hideChatItem: jest.fn().mockResolvedValue({ id: "pref-1" }),
    showChatItem: jest.fn().mockResolvedValue(undefined),
    getHiddenActorIds: jest.fn().mockResolvedValue(["actor-1"]),
    setLastOpenedThread: jest.fn().mockResolvedValue(undefined),
    getLastOpenedThread: jest.fn().mockResolvedValue("thread-1"),
    listThreads: jest.fn().mockResolvedValue([]),
    createThread: jest.fn().mockResolvedValue({ id: "thread-1" }),
    listMessages: jest.fn().mockResolvedValue([]),
    createChatSession: jest.fn().mockResolvedValue({
      threadId: "thread-1",
      userMessageId: "message-1",
      streamToken: "token-1",
      actorSnapshotData: {},
    }),
    saveAssistantMessage: jest.fn().mockResolvedValue(undefined),
    upsertAssistantMessage: jest.fn().mockResolvedValue({ id: "message-2" }),
  } as unknown as jest.Mocked<ThreadService>;
  return { actorService, threadService };
}

describe("CharacterChatController", () => {
  it("prepareActor forwards auth user id", async () => {
    const { actorService, threadService } = services();
    const controller = new CharacterChatController(actorService, threadService);

    await controller.prepareActor(user, {
      projectId: "00000000-0000-4000-8000-000000000001",
      characterId: "00000000-0000-4000-8000-000000000002",
    });

    expect(actorService.prepareActor).toHaveBeenCalledWith({
      projectId: "00000000-0000-4000-8000-000000000001",
      characterId: "00000000-0000-4000-8000-000000000002",
      userId: "user-1",
    });
  });

  it("hiddenActorIds wraps the array response for REST", async () => {
    const { actorService, threadService } = services();
    const controller = new CharacterChatController(actorService, threadService);

    const result = await controller.hiddenActorIds(user, "00000000-0000-4000-8000-000000000001");

    expect(result).toEqual({ actorIds: ["actor-1"] });
    expect(threadService.getHiddenActorIds).toHaveBeenCalledWith(
      "user-1",
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("getLastOpenedThread wraps nullable thread id for REST", async () => {
    const { actorService, threadService } = services();
    const controller = new CharacterChatController(actorService, threadService);

    const result = await controller.getLastOpenedThread(
      user,
      "00000000-0000-4000-8000-000000000010",
    );

    expect(result).toEqual({ threadId: "thread-1" });
  });

  it("createChatSession forwards auth user id", async () => {
    const { actorService, threadService } = services();
    const controller = new CharacterChatController(actorService, threadService);

    await controller.createChatSession(user, {
      projectId: "00000000-0000-4000-8000-000000000001",
      characterId: "00000000-0000-4000-8000-000000000002",
      userMessage: "hello",
    });

    expect(threadService.createChatSession).toHaveBeenCalledWith({
      projectId: "00000000-0000-4000-8000-000000000001",
      characterId: "00000000-0000-4000-8000-000000000002",
      userMessage: "hello",
      userId: "user-1",
    });
  });
});

describe("CharacterChatPublicController", () => {
  it("saveAssistant strips streamToken before service call", async () => {
    const { threadService } = services();
    const controller = new CharacterChatPublicController(threadService);

    await controller.saveAssistant({
      threadId: "00000000-0000-4000-8000-000000000001",
      content: "done",
      status: "completed",
      streamToken: "token-1",
    });

    expect(threadService.saveAssistantMessage).toHaveBeenCalledWith({
      threadId: "00000000-0000-4000-8000-000000000001",
      content: "done",
      status: "completed",
    });
  });

  it("upsertAssistant strips streamToken before service call", async () => {
    const { threadService } = services();
    const controller = new CharacterChatPublicController(threadService);

    await controller.upsertAssistant({
      messageId: "00000000-0000-4000-8000-000000000002",
      threadId: "00000000-0000-4000-8000-000000000001",
      content: "partial",
      status: "streaming",
      streamToken: "token-1",
    });

    expect(threadService.upsertAssistantMessage).toHaveBeenCalledWith({
      messageId: "00000000-0000-4000-8000-000000000002",
      threadId: "00000000-0000-4000-8000-000000000001",
      content: "partial",
      status: "streaming",
    });
  });
});

describe("OperatorChatController", () => {
  it("prepareActor forwards auth user id through the operator surface", async () => {
    const { actorService, threadService } = services();
    const controller = new OperatorChatController(actorService, threadService);

    await controller.prepareActor(user, {
      projectId: "00000000-0000-4000-8000-000000000001",
      characterId: "00000000-0000-4000-8000-000000000002",
    });

    expect(actorService.prepareActor).toHaveBeenCalledWith({
      projectId: "00000000-0000-4000-8000-000000000001",
      characterId: "00000000-0000-4000-8000-000000000002",
      userId: "user-1",
    });
  });

  it("createChatSession forwards auth user id through the operator surface", async () => {
    const { actorService, threadService } = services();
    const controller = new OperatorChatController(actorService, threadService);

    await controller.createChatSession(user, {
      projectId: "00000000-0000-4000-8000-000000000001",
      characterId: "00000000-0000-4000-8000-000000000002",
      userMessage: "hello",
    });

    expect(threadService.createChatSession).toHaveBeenCalledWith({
      projectId: "00000000-0000-4000-8000-000000000001",
      characterId: "00000000-0000-4000-8000-000000000002",
      userMessage: "hello",
      userId: "user-1",
    });
  });
});

describe("OperatorChatPublicController", () => {
  it("saveAssistant strips streamToken before service call", async () => {
    const { threadService } = services();
    const controller = new OperatorChatPublicController(threadService);

    await controller.saveAssistant({
      threadId: "00000000-0000-4000-8000-000000000001",
      content: "done",
      status: "completed",
      streamToken: "token-1",
    });

    expect(threadService.saveAssistantMessage).toHaveBeenCalledWith({
      threadId: "00000000-0000-4000-8000-000000000001",
      content: "done",
      status: "completed",
    });
  });

  it("upsertAssistant strips streamToken before service call", async () => {
    const { threadService } = services();
    const controller = new OperatorChatPublicController(threadService);

    await controller.upsertAssistant({
      messageId: "00000000-0000-4000-8000-000000000002",
      threadId: "00000000-0000-4000-8000-000000000001",
      content: "partial",
      status: "streaming",
      streamToken: "token-1",
    });

    expect(threadService.upsertAssistantMessage).toHaveBeenCalledWith({
      messageId: "00000000-0000-4000-8000-000000000002",
      threadId: "00000000-0000-4000-8000-000000000001",
      content: "partial",
      status: "streaming",
    });
  });
});
