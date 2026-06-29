/**
 * DunningCron — daily 03:00 UTC tick over the dunning state machine.
 *
 * Spec §4.4. Runs `DunningService.tick(now)` which:
 *   - past_due  → grace     (any past_due row; grace_ends_at = past_due_since + 7d)
 *   - grace     → canceled  (when grace_ends_at <= now; data_purge_at = now + 30d)
 *
 * Logs the transition counts so we can wire up PostHog (spec §8.H3) later
 * without changing this file.
 */
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { DunningService } from "../service/dunning.service";

@Injectable()
export class DunningCron {
  private readonly logger = new Logger(DunningCron.name);

  constructor(private readonly dunning: DunningService) {}

  @Cron("0 3 * * *", { timeZone: "UTC", name: "payment-dunning-tick" })
  async tick(): Promise<void> {
    const start = Date.now();
    const out = await this.dunning.tick(new Date());
    this.logger.log(
      `dunning tick: enteredGrace=${out.enteredGrace} canceledFromGrace=${out.canceledFromGrace} elapsedMs=${Date.now() - start}`,
    );
  }
}
