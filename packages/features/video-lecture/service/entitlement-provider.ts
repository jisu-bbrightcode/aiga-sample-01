import { Injectable } from "@nestjs/common";

export interface VideoLectureEntitlementRequest {
  userId: string;
  courseId: string;
  lessonId: string;
  requirement: "purchase" | "subscription";
}

export abstract class VideoLectureEntitlementProvider {
  abstract hasEntitlement(request: VideoLectureEntitlementRequest): Promise<boolean>;
}

@Injectable()
export class DenyByDefaultVideoLectureEntitlementProvider
  implements VideoLectureEntitlementProvider
{
  hasEntitlement(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
