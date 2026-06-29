import type { ActorService } from "./service/actor.service";
import type { ThreadService } from "./service/thread.service";

export interface CharacterChatServiceFacade {
  actorService: ActorService;
  threadService: ThreadService;
}

export let characterChatService: CharacterChatServiceFacade;

export const setCharacterChatService = (service: CharacterChatServiceFacade) => {
  characterChatService = service;
};
