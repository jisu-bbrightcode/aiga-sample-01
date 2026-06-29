import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { DatabaseModule } from "@repo/drizzle";
import { CommonFeatureModule } from "@repo/features/_common";
// [ATLAS:IMPORTS]
import { BlogModule } from "@repo/features/blog";
import { CommentModule } from "@repo/features/comment";
import { CommunityModule } from "@repo/features/community";
import { EmailModule } from "@repo/features/email";
import { FeedbackModule } from "@repo/features/feedback";
import { FileUploadModule } from "@repo/features/file-upload";
import { IdentityVerificationModule } from "@repo/features/identity-verification";
import { LocalizationModule } from "@repo/features/localization";
import { NotificationModule } from "@repo/features/notification";
import { OnboardingModule } from "@repo/features/onboarding";
import { OperatorChatModule } from "@repo/features/operator-chat";
import { PersonalizationModule } from "@repo/features/personalization";
import { ProjectModule } from "@repo/features/project";
import { ReactionModule } from "@repo/features/reaction";
import { ScheduledJobModule } from "@repo/features/scheduled-job";
import { ServiceDomainModule } from "@repo/features/service-domain";
import { StoryModule } from "@repo/features/story";
import { UserDirectoryModule } from "@repo/features/user-directory";
import { VideoLectureModule } from "@repo/features/video-lecture";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { serverEnvSchema } from "./config/env";
import { getNestEnvFilePaths } from "./config/local-env";
import { getMessageSendingFeatureWiring } from "./config/message-sending-feature";
import { getPaymentFeatureWiring } from "./config/payment-feature";

// [/ATLAS:IMPORTS]

const localEnvFilePaths = getNestEnvFilePaths();
const messageSendingFeature = getMessageSendingFeatureWiring();
const paymentFeature = getPaymentFeatureWiring();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: localEnvFilePaths,
      ignoreEnvFile: localEnvFilePaths.length === 0,
      validate: (config) => serverEnvSchema.parse(config),
    }),
    // Project lifecycle / cross-feature event bus (Phase 7)
    EventEmitterModule.forRoot({
      wildcard: false,
      ignoreErrors: false,
      maxListeners: 20,
    }),
    // Rate Limiting — 60초당 100회 (전역). dev 환경에선 bulk perf test 위해 대폭 완화.
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: process.env.NODE_ENV === "production" ? 100 : 100_000,
        },
      ],
    }),
    DatabaseModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connectionString:
          configService.get<string>("DATABASE_URL") ??
          "postgresql://postgres:postgres@localhost:5432/atlas",
      }),
      inject: [ConfigService],
    }),
    // [ATLAS:MODULES]
    BlogModule,
    CommentModule,
    CommonFeatureModule,
    CommunityModule,
    EmailModule,
    FeedbackModule,
    FileUploadModule,
    IdentityVerificationModule,
    NotificationModule,
    OnboardingModule,
    PersonalizationModule,
    ...messageSendingFeature.imports,
    ...paymentFeature.imports,
    ProjectModule,
    ReactionModule,
    ScheduledJobModule,
    ServiceDomainModule,
    UserDirectoryModule,
    OperatorChatModule,
    LocalizationModule,
    StoryModule,
    VideoLectureModule,
    // [/ATLAS:MODULES]
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // ThrottlerGuard 전역 적용
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
