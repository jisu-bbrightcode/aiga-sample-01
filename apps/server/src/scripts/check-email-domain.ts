#!/usr/bin/env tsx

/**
 * Check the Resend sending-domain authentication status (SPF / DKIM / DMARC).
 *
 * Operator readiness evidence for PB-NOTI-EMAIL-RESEND-001: run this after
 * adding the sending domain in Resend and publishing its DNS records, then
 * paste the output into the issue as proof the domain is authenticated.
 *
 * Usage:
 *   RESEND_API_KEY=re_... pnpm tsx src/scripts/check-email-domain.ts [domain]
 *
 * Exit code is non-zero unless the domain and all SPF/DKIM/DMARC records are
 * verified — so CI / deploy gates can fail closed on an unauthenticated domain.
 */

import { DomainVerificationService } from "@repo/features/email";
import type { DomainVerificationResult } from "@repo/features/email";

function printRecords(label: string, records: DomainVerificationResult["spf"]) {
  if (records.length === 0) {
    console.log(`  ${label}: (none reported)`);
    return;
  }
  for (const r of records) {
    const mark = r.status.toLowerCase() === "verified" ? "✓" : "✗";
    console.log(`  ${label}: ${mark} ${r.status} — ${r.type} ${r.name}`.trimEnd());
  }
}

async function main() {
  const domainArg = process.argv[2];

  if (!process.env.RESEND_API_KEY) {
    console.error("✗ RESEND_API_KEY is not set. Provide it before running this check.");
    process.exit(2);
  }

  const service = new DomainVerificationService();

  let result: DomainVerificationResult;
  try {
    result = await service.checkDomain(domainArg);
  } catch (error) {
    console.error(`✗ Domain check failed: ${error instanceof Error ? error.message : error}`);
    process.exit(2);
    return;
  }

  console.log(`Resend sending domain: ${result.name} (${result.id})`);
  console.log(`Overall status: ${result.status}`);
  printRecords("SPF  ", result.spf);
  printRecords("DKIM ", result.dkim);
  printRecords("DMARC", result.dmarc);

  if (result.allVerified) {
    console.log("\n✓ Domain authenticated: SPF/DKIM/DMARC all verified.");
    process.exit(0);
  }

  console.error("\n✗ Domain NOT fully authenticated. Publish/verify the DNS records above.");
  process.exit(1);
}

main();
