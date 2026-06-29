import type { DynamicModule, Type } from "@nestjs/common";
import { isAnyPaymentConfigured, PaymentModule } from "@repo/features/payment";

interface PaymentFeatureWiring {
  enabled: boolean;
  imports: Array<Type<unknown> | DynamicModule>;
}

export function getPaymentFeatureWiring(
  env: NodeJS.ProcessEnv = process.env,
): PaymentFeatureWiring {
  if (!isAnyPaymentConfigured(env)) {
    return {
      enabled: false,
      imports: [],
    };
  }

  return {
    enabled: true,
    imports: [PaymentModule.forRoot(env)],
  };
}
