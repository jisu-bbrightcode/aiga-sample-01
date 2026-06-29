/**
 * Notification Feature - NestJS Module
 */

import { Module, type OnModuleInit } from "@nestjs/common";
// Controllers
import { NotificationController } from "./controller/notification.controller";
// Gateway
import { NotificationGateway } from "./gateway/notification.gateway";
// Services
import { NotificationService } from "./service/notification.service";
import { NotificationEmitterService } from "./service/notification-emitter.service";
import { injectNotificationService } from "./service-registry";

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway, NotificationEmitterService],
  exports: [NotificationService, NotificationGateway, NotificationEmitterService],
})
export class NotificationModule implements OnModuleInit {
  constructor(private readonly notificationService: NotificationService) {}

  onModuleInit() {
    // Inject service into the legacy router/service registry.
    injectNotificationService(this.notificationService);
  }
}
