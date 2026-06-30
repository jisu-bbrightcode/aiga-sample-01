import { Module, type OnModuleInit } from "@nestjs/common";
import { RateLimitService } from "@repo/core/rate-limit";
import { ReactionModule } from "@repo/features/reaction";
import { CommunityAdminController, CommunityController } from "./controller";
import {
  CommunityBlockService,
  CommunityCommentService,
  CommunityContentModerationService,
  CommunityFeedService,
  CommunityHiddenContentService,
  CommunityKarmaService,
  CommunityKeywordFilterService,
  CommunityModerationService,
  CommunityPostService,
  CommunityReactionService,
  CommunitySanctionService,
  CommunityService,
  CommunityTierService,
  CommunityVoteService,
} from "./service";
import { injectCommunityServices } from "./service-registry";

/**
 * Community Feature Module
 *
 * Reddit-style user-driven community platform with posts, comments,
 * voting, moderation, and feed algorithms.
 */
@Module({
  imports: [ReactionModule],
  controllers: [CommunityController, CommunityAdminController],
  providers: [
    CommunityService,
    CommunityPostService,
    CommunityCommentService,
    CommunityVoteService,
    CommunityReactionService,
    CommunityKarmaService,
    CommunityModerationService,
    CommunityFeedService,
    CommunityKeywordFilterService,
    CommunityBlockService,
    CommunitySanctionService,
    CommunityTierService,
    CommunityContentModerationService,
    CommunityHiddenContentService,
    RateLimitService,
  ],
  exports: [
    CommunityService,
    CommunityPostService,
    CommunityCommentService,
    CommunityVoteService,
    CommunityKarmaService,
    CommunityModerationService,
    CommunityFeedService,
    CommunityKeywordFilterService,
    CommunityBlockService,
    CommunitySanctionService,
    CommunityTierService,
    CommunityContentModerationService,
    CommunityHiddenContentService,
  ],
})
export class CommunityModule implements OnModuleInit {
  // biome-ignore lint/complexity/useMaxParams: NestJS module constructor receives explicitly injected providers.
  constructor(
    private readonly communityService: CommunityService,
    private readonly postService: CommunityPostService,
    private readonly commentService: CommunityCommentService,
    private readonly voteService: CommunityVoteService,
    private readonly karmaService: CommunityKarmaService,
    private readonly moderationService: CommunityModerationService,
    private readonly feedService: CommunityFeedService,
    private readonly blockService: CommunityBlockService,
    private readonly sanctionService: CommunitySanctionService,
    private readonly tierService: CommunityTierService,
  ) {}

  onModuleInit() {
    injectCommunityServices({
      communityService: this.communityService,
      postService: this.postService,
      commentService: this.commentService,
      voteService: this.voteService,
      karmaService: this.karmaService,
      moderationService: this.moderationService,
      feedService: this.feedService,
      blockService: this.blockService,
      sanctionService: this.sanctionService,
      tierService: this.tierService,
    });
  }
}
