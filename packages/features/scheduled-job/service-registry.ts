import type { CronRunnerService } from "./service/cron-runner.service";
import type { ScheduledJobService } from "./service/scheduled-job.service";

export interface ScheduledJobServices extends Record<string, unknown> {
  scheduledJobService: ScheduledJobService;
  cronRunnerService: CronRunnerService;
}

let scheduledJobServices: ScheduledJobServices | undefined;

export const injectScheduledJobServices = (services: ScheduledJobServices): void => {
  scheduledJobServices = services;
};

export const getScheduledJobServices = (): ScheduledJobServices => {
  if (!scheduledJobServices) {
    throw new Error("Scheduled job services are not configured");
  }
  return scheduledJobServices;
};
