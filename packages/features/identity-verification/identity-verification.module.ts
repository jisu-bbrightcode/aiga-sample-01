import { DRIZZLE, type DrizzleDB } from "@repo/drizzle";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IdentityVerificationAdminController, IdentityVerificationController } from "./controller";
import { KcbAdapterClient } from "./kcb";
import { IdentityVerificationService } from "./service";

@Module({
  controllers: [IdentityVerificationController, IdentityVerificationAdminController],
  providers: [
    {
      provide: KcbAdapterClient,
      useFactory: (configService: ConfigService) =>
        new KcbAdapterClient({
          baseUrl: configService.get<string>("KCB_ADAPTER_BASE_URL"),
          internalAuthToken: configService.get<string>("KCB_INTERNAL_AUTH_TOKEN"),
          // Larger than the Java bridge's connect+read budget (KCB_CONNECT/READ_TIMEOUT_MS,
          // default 10s+10s) so a slow-but-successful RESULT is not aborted and lost.
          timeoutMs: 25_000,
        }),
      inject: [ConfigService],
    },
    {
      provide: IdentityVerificationService,
      useFactory: (db: DrizzleDB, adapter: KcbAdapterClient, configService: ConfigService) =>
        new IdentityVerificationService({
          db,
          adapter,
          standardReturnUrl: configService.get<string>("KCB_STANDARD_RETURN_URL"),
          standardCallbackUrl: configService.get<string>("KCB_STANDARD_CALLBACK_URL"),
          customModeEnabled: configService.get<string>("KCB_CUSTOM_MODE_ENABLED") === "true",
          retentionDays: Number.parseInt(
            configService.get<string>("KCB_RETENTION_DAYS") ?? "365",
            10,
          ),
        }),
      inject: [DRIZZLE, KcbAdapterClient, ConfigService],
    },
  ],
  exports: [IdentityVerificationService, KcbAdapterClient],
})
export class IdentityVerificationModule {}
