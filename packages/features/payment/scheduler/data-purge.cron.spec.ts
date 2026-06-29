/**
 * DataPurgeCron — verifies the @Cron handler iterates targets and calls
 * markPurged for each. Real archival is TODO Phase 12+ (see cron file).
 */
import { DataPurgeCron } from "./data-purge.cron";

describe("DataPurgeCron", () => {
  it("purge() iterates targets and marks each purged", async () => {
    const targets = [
      { id: "sub-1", organizationId: "org-1", dataPurgeAt: new Date() },
      { id: "sub-2", organizationId: "org-2", dataPurgeAt: new Date() },
    ];
    const purged: string[] = [];
    const fakeSvc = {
      listPurgeTargets: async () => targets,
      markPurged: async ({ subscriptionId }: { subscriptionId: string }) => {
        purged.push(subscriptionId);
      },
    } as unknown as ConstructorParameters<typeof DataPurgeCron>[0];

    const cron = new DataPurgeCron(fakeSvc);
    await cron.purge();
    expect(purged).toEqual(["sub-1", "sub-2"]);
  });

  it("purge() no-op when no targets", async () => {
    const fakeSvc = {
      listPurgeTargets: async () => [],
      markPurged: async () => {
        throw new Error("should not be called");
      },
    } as unknown as ConstructorParameters<typeof DataPurgeCron>[0];

    const cron = new DataPurgeCron(fakeSvc);
    await expect(cron.purge()).resolves.toBeUndefined();
  });
});
