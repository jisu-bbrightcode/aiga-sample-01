import { Module, type OnModuleInit } from "@nestjs/common";
import {
  CloudflareStreamWebhookController,
  VideoLectureAdminController,
  VideoLectureController,
} from "./controller";
import { VideoLectureService } from "./service";
import {
  DenyByDefaultVideoLectureEntitlementProvider,
  VideoLectureEntitlementProvider,
} from "./service/entitlement-provider";
import { setVideoLectureService } from "./service-registry";

@Module({
  controllers: [
    VideoLectureController,
    VideoLectureAdminController,
    CloudflareStreamWebhookController,
  ],
  providers: [
    VideoLectureService,
    {
      provide: VideoLectureEntitlementProvider,
      useClass: DenyByDefaultVideoLectureEntitlementProvider,
    },
  ],
  exports: [VideoLectureService, VideoLectureEntitlementProvider],
})
export class VideoLectureModule implements OnModuleInit {
  constructor(private readonly videoLectureService: VideoLectureService) {}

  onModuleInit() {
    setVideoLectureService(this.videoLectureService);
  }
}
