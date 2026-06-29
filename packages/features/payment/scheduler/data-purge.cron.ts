/**
 * DataPurgeCron — daily 03:30 UTC scan for canceled subs past their
 * read-only-archive date (spec §4.4 / §8.G4).
 *
 * Phase 6 scope: identify the targets and clear `data_purge_at`. The actual
 * archival of project content is deferred to Phase 12+ once the storage
 * boundary is defined. For now we log + audit so
 * the production timeline is observable.
 */
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { DunningService } from "../service/dunning.service";

@Injectable()
export class DataPurgeCron {
  private readonly logger = new Logger(DataPurgeCron.name);

  constructor(private readonly dunning: DunningService) {}

  @Cron("30 3 * * *", { timeZone: "UTC", name: "payment-data-purge" })
  async purge(): Promise<void> {
    const start = Date.now();
    const targets = await this.dunning.listPurgeTargets(new Date());
    if (targets.length === 0) {
      this.logger.log(`data-purge: no targets, elapsedMs=${Date.now() - start}`);
      return;
    }

    let purged = 0;
    for (const t of targets) {
      try {
        // TODO(Phase 12+): wire archival of org content before clearing the timestamp. Until then
        // the row simply moves out of the "needs archival" view, with a
        // log line for the ops runbook.
        this.logger.warn(
          `data-purge: TODO archive org=${t.organizationId} sub=${t.id} dataPurgeAt=${t.dataPurgeAt.toISOString()}`,
        );
        await this.dunning.markPurged({ subscriptionId: t.id });
        purged += 1;
      } catch (err) {
        this.logger.error(
          `data-purge: failed sub=${t.id}: ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(
      `data-purge: targets=${targets.length} purged=${purged} elapsedMs=${Date.now() - start}`,
    );
  }
}
