import { Module, type OnModuleInit } from "@nestjs/common";
import {
  StoryCharacterController,
  StoryCodexController,
  StoryDraftController,
  StoryEntityPropertyController,
  StoryEntityTagController,
  StoryFactionController,
  StoryLocationController,
  StoryRelationController,
  StoryTagController,
  StoryWorldController,
} from "./controller";
import {
  StoryCharacterService,
  StoryCodexService,
  StoryDraftService,
  StoryEntityPropertyService,
  StoryEntityTagService,
  StoryFactionService,
  StoryLocationService,
  StoryRelationService,
  StoryService,
  StoryTagService,
  StoryWorldService,
} from "./service";
import { setStoryService } from "./service-registry";

@Module({
  controllers: [
    StoryWorldController,
    StoryCharacterController,
    StoryLocationController,
    StoryFactionController,
    StoryCodexController,
    StoryDraftController,
    StoryTagController,
    StoryEntityTagController,
    StoryEntityPropertyController,
    StoryRelationController,
  ],
  providers: [
    StoryWorldService,
    StoryCharacterService,
    StoryLocationService,
    StoryFactionService,
    StoryCodexService,
    StoryDraftService,
    StoryTagService,
    StoryEntityTagService,
    StoryEntityPropertyService,
    StoryRelationService,
    StoryService,
  ],
  exports: [StoryService],
})
export class StoryModule implements OnModuleInit {
  constructor(private readonly storyService: StoryService) {}

  onModuleInit() {
    setStoryService(this.storyService);
  }
}
