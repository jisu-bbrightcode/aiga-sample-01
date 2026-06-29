/**
 * Comment Feature - NestJS Module
 */

import { Module } from "@nestjs/common";
import { CommentController } from "./controller";
import { CommentService } from "./service";

@Module({
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule {}
