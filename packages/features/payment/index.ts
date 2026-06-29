/**
 * Payment Feature — Server Entry Point.
 *
 * This is the default export (package.json `"./payment": "./payment/index.ts"`).
 *
 * Exposes the NestJS module (`PaymentModule`), payment service registry bridge,
 * and the `PolarWebhookController` that the Fastify raw-body route hands off to.
 */

export { isPaymentConfigured, isPolarPaymentConfigured } from "./config/payment.config";
export { isAnyPaymentConfigured } from "./config/provider.config";
export {
  PolarWebhookController,
  type RawWebhookRequest,
  type WebhookReply,
} from "./controller/public/polar-webhook.controller";
export { InicisPaymentService } from "./inicis/inicis.service";
export * from "./inicis/src";
export {
  InicisPaymentProviderModule,
  PaymentModule,
  PolarPaymentProviderModule,
} from "./payment.module";
export {
  injectPaymentServices,
  type PaymentServices,
  resetPaymentServices,
} from "./service-registry";
