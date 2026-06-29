#!/usr/bin/env tsx
/**
 * redeliver-polar-webhooks.ts
 *
 * Lists failed deliveries on the configured webhook endpoint and POSTs
 * the redeliver action for each. Designed to be run by hand AFTER a
 * controller / dispatcher fix has shipped — see runbook §1.4.
 *
 * Usage:
 *   POLAR_ACCESS_TOKEN=polar_oat_... \
 *   POLAR_WEBHOOK_ENDPOINT_ID=fd272d73-... \
 *   POLAR_ENV=sandbox \
 *   pnpm tsx apps/server/scripts/redeliver-polar-webhooks.ts [--dry-run] [--limit=100]
 *
 * Outputs a JSON line per delivery: { id, type, status, action }
 *
 * URLs (canonical — see docs/reference/polar-api-index.md):
 *   LIST       GET  /v1/webhooks/deliveries?endpoint_id={id}
 *   REDELIVER  POST /v1/webhooks/endpoints/{endpointId}/deliveries/{deliveryId}/redeliver
 */
const env = process.env.POLAR_ENV ?? "sandbox";
const baseUrl =
  env === "production"
    ? "https://api.polar.sh"
    : "https://sandbox-api.polar.sh";
const token = required("POLAR_ACCESS_TOKEN");
const endpointId = required("POLAR_WEBHOOK_ENDPOINT_ID");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limit = parseInt(
  args.find((a) => a.startsWith("--limit="))?.slice("--limit=".length) ?? "100",
  10,
);

interface DeliveryItem {
  id: string;
  succeeded: boolean;
  webhook_event: { type: string };
  http_code: number | null;
}

async function main() {
  const url = `${baseUrl}/v1/webhooks/deliveries?endpoint_id=${endpointId}&limit=${limit}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    throw new Error(
      `list deliveries failed: ${resp.status} ${await resp.text()}`,
    );
  }
  const j = (await resp.json()) as { items: DeliveryItem[] };
  const failed = j.items.filter((d) => !d.succeeded);
  console.error(
    `# ${failed.length}/${j.items.length} deliveries failed (limit=${limit})`,
  );

  for (const d of failed) {
    if (dryRun) {
      console.log(
        JSON.stringify({
          id: d.id,
          type: d.webhook_event.type,
          status: d.http_code,
          action: "dryrun",
        }),
      );
      continue;
    }
    const r = await fetch(
      `${baseUrl}/v1/webhooks/endpoints/${endpointId}/deliveries/${d.id}/redeliver`,
      { method: "POST", headers: { Authorization: `Bearer ${token}` } },
    );
    const action = r.ok ? "redelivered" : "skipped";
    console.log(
      JSON.stringify({
        id: d.id,
        type: d.webhook_event.type,
        status: d.http_code,
        action,
        response_status: r.status,
      }),
    );
    await new Promise((res) => setTimeout(res, 250));
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
