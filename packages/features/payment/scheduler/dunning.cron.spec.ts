/**
 * DunningCron — verifies the @Cron handler calls DunningService.tick(now).
 * Logic lives in the service; this file is the wiring guarantee.
 */
import { DunningCron } from "./dunning.cron";

describe("DunningCron", () => {
  it("tick() delegates to DunningService.tick(new Date())", async () => {
    const calls: Date[] = [];
    const fakeSvc = {
      tick: async (now: Date) => {
        calls.push(now);
        return { enteredGrace: 1, canceledFromGrace: 0 };
      },
    } as unknown as ConstructorParameters<typeof DunningCron>[0];

    const cron = new DunningCron(fakeSvc);
    await cron.tick();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toBeInstanceOf(Date);
  });
});
