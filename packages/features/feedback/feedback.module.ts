import { Module } from "@nestjs/common";
import { FeedbackController } from "./controller";

@Module({
  controllers: [FeedbackController],
})
export class FeedbackModule {}
