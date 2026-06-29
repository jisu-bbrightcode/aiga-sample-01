/**
 * Email Feature - Server Entry Point
 *
 * This is the default export (package.json ".": "./src/server/index.ts")
 */

// Types
export type * from "../common/types";
// Controllers
export { EmailController } from "./controller/email.controller";
// Module
export { EmailModule } from "./email.module";
// Services
export { EmailService } from "./service/email.service";
export { EmailTemplateService } from "./service/email-template.service";
export { injectEmailService } from "./service-registry";
