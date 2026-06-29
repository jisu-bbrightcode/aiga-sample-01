import type { NotificationService } from "./service/notification.service";

let notificationService: NotificationService | undefined;

export const injectNotificationService = (service: NotificationService): void => {
  notificationService = service;
};

export const getNotificationService = (): NotificationService => {
  if (!notificationService) {
    throw new Error("NotificationService is not configured");
  }
  return notificationService;
};
