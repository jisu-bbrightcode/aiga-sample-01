import { isInicisPaymentConfigured } from "../inicis/src/config";
import { isPolarPaymentConfigured } from "./payment.config";

export function isAnyPaymentConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return isPolarPaymentConfigured(env) || isInicisPaymentConfigured(env);
}

export function getPaymentProviderConfigStatus(env: NodeJS.ProcessEnv = process.env) {
  return {
    polar: isPolarPaymentConfigured(env),
    inicis: isInicisPaymentConfigured(env),
  };
}
