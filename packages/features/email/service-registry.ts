import type { IEmailService } from "../common/types";

let emailService: IEmailService | undefined;

export const injectEmailService = (service: IEmailService): void => {
  emailService = service;
};

export const getEmailService = (): IEmailService => {
  if (!emailService) {
    throw new Error("EmailService is not configured");
  }
  return emailService;
};
