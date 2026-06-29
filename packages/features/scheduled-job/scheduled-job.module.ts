import { Module, type OnModuleInit } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ScheduledJobController } from "./controller";
import { CronRunnerService } from "./service/cron-runner.service";
import { ScheduledJobService } from "./service/scheduled-job.service";
import { injectScheduledJobServices } from "./service-registry";

const isOpenApiDump = process.env.OPENAPI_DUMP === "1";

@Module({
  imports: isOpenApiDump ? [] : [ScheduleModule.forRoot()],
  controllers: [ScheduledJobController],
  providers: [ScheduledJobService, CronRunnerService],
  exports: [ScheduledJobService, CronRunnerService],
})
export class ScheduledJobModule implements OnModuleInit {
  constructor(
    private readonly scheduledJobService: ScheduledJobService,
    private readonly cronRunnerService: CronRunnerService,
  ) {}

  async onModuleInit() {
    // Legacy router/service registry injection.
    injectScheduledJobServices({
      scheduledJobService: this.scheduledJobService,
      cronRunnerService: this.cronRunnerService,
    });

    if (isOpenApiDump) return;

    // Seed default jobs
    await this.scheduledJobService.seedJob({
      jobKey: "credit_monthly_renewal",
      displayName: "크레딧 월간 갱신",
      description: "플랜별 월 크레딧 자동 충전 (매일 00:00)",
      cronExpression: "0 0 * * *",
    });

    await this.scheduledJobService.seedJob({
      jobKey: "marketing_scheduled_publish",
      displayName: "마케팅 예약 발행",
      description: "예약된 마케팅 콘텐츠 자동 발행 (매분)",
      cronExpression: "* * * * *",
    });

    await this.scheduledJobService.seedJob({
      jobKey: "data_cleanup",
      displayName: "데이터 정리",
      description: "90일 이상 삭제된 데이터 물리 삭제 (매일 03:00)",
      cronExpression: "0 3 * * *",
    });

    await this.scheduledJobService.seedJob({
      jobKey: "analytics_daily_aggregate",
      displayName: "분석 일별 집계",
      description: "전일 이벤트 데이터를 일별 메트릭으로 집계 (매일 01:00)",
      cronExpression: "0 1 * * *",
    });

    await this.scheduledJobService.seedJob({
      jobKey: "studio_ai_suggest",
      displayName: "Studio AI 추천",
      description: "AI 주제 추천 및 초안 자동 생성 (매시간)",
      cronExpression: "0 * * * *",
    });
  }
}
