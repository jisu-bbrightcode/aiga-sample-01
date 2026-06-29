import { Module, type OnModuleInit } from "@nestjs/common";
import {
  CharacterChatController,
  CharacterChatPublicController,
  OperatorChatController,
  OperatorChatPublicController,
} from "./controller";
import { ActorService } from "./service/actor.service";
import { ThreadService } from "./service/thread.service";
import { setCharacterChatService } from "./service-registry";

@Module({
  controllers: [
    OperatorChatController,
    OperatorChatPublicController,
    CharacterChatController,
    CharacterChatPublicController,
  ],
  providers: [ActorService, ThreadService],
  exports: [ActorService, ThreadService],
})
export class CharacterChatModule implements OnModuleInit {
  constructor(
    private readonly actorService: ActorService,
    private readonly threadService: ThreadService,
  ) {}

  onModuleInit() {
    setCharacterChatService({
      actorService: this.actorService,
      threadService: this.threadService,
    });
  }
}
