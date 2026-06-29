import { DRIZZLE, type DrizzleDB } from "@repo/drizzle";
import { Module } from "@nestjs/common";
import { loadSolapiConfig, type SolapiConfig } from "./config/solapi.config";
import { MessageSendingController } from "./controller";
import { SolapiClient } from "./provider/solapi.client";
import { MessageSendingService } from "./service";

export const SOLAPI_CONFIG = "SOLAPI_CONFIG" as const;

@Module({
  controllers: [MessageSendingController],
  providers: [
    {
      provide: SOLAPI_CONFIG,
      useFactory: (): SolapiConfig => loadSolapiConfig(),
    },
    {
      provide: SolapiClient,
      useFactory: (config: SolapiConfig) => new SolapiClient(config),
      inject: [SOLAPI_CONFIG],
    },
    {
      provide: MessageSendingService,
      useFactory: (db: DrizzleDB, solapiClient: SolapiClient, solapiConfig: SolapiConfig) =>
        new MessageSendingService(db, solapiClient, solapiConfig),
      inject: [DRIZZLE, SolapiClient, SOLAPI_CONFIG],
    },
  ],
  exports: [MessageSendingService, SolapiClient],
})
export class MessageSendingModule {}
