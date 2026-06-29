import { isSolapiConfigured, MessageSendingModule } from "@repo/features/message-sending";
import type { Type } from "@nestjs/common";

interface MessageSendingFeatureWiring {
  enabled: boolean;
  imports: Type<unknown>[];
}

export function getMessageSendingFeatureWiring(
  env: NodeJS.ProcessEnv = process.env,
): MessageSendingFeatureWiring {
  if (!isSolapiConfigured(env)) {
    return {
      enabled: false,
      imports: [],
    };
  }

  return {
    enabled: true,
    imports: [MessageSendingModule],
  };
}
