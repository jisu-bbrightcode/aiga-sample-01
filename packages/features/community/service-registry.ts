import type {
  CommunityBlockService,
  CommunityCommentService,
  CommunityFeedService,
  CommunityKarmaService,
  CommunityModerationService,
  CommunityPostService,
  CommunitySanctionService,
  CommunityService,
  CommunityTierService,
  CommunityVoteService,
} from "./service";

export interface CommunityServices extends Record<string, unknown> {
  communityService: CommunityService;
  postService: CommunityPostService;
  commentService: CommunityCommentService;
  voteService: CommunityVoteService;
  karmaService: CommunityKarmaService;
  moderationService: CommunityModerationService;
  feedService: CommunityFeedService;
  blockService: CommunityBlockService;
  sanctionService: CommunitySanctionService;
  tierService: CommunityTierService;
}

let communityServices: CommunityServices | undefined;

export const injectCommunityServices = (services: CommunityServices): void => {
  communityServices = services;
};

export const getCommunityServices = (): CommunityServices => {
  if (!communityServices) {
    throw new Error("Community services are not configured");
  }
  return communityServices;
};
