import { Injectable } from "@nestjs/common";
import { Resend } from "resend";
import { classifyDomainRecords, type DomainVerificationResult } from "./domain-records";

export type { DomainVerificationResult } from "./domain-records";

/**
 * Domain Verification Service
 *
 * Reports the SPF / DKIM / DMARC verification status of the Resend sending
 * domain. Used by the operator readiness script and admin tooling to prove
 * the sending domain is authenticated before production traffic.
 *
 * https://resend.com/docs/api-reference/domains/get-domain
 */
@Injectable()
export class DomainVerificationService {
  private client: Resend | null = null;

  private getClient(): Resend {
    if (this.client) return this.client;
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is required");
    }
    this.client = new Resend(apiKey);
    return this.client;
  }

  /**
   * Resolve the sending domain and return its SPF/DKIM/DMARC record statuses.
   *
   * @param domainName Optional explicit domain. When omitted, resolves the
   *   single configured domain; throws if zero or many exist (ambiguous).
   */
  async checkDomain(domainName?: string): Promise<DomainVerificationResult> {
    const client = this.getClient();

    const list = (await client.domains.list()) as {
      data?: { data?: Array<{ id: string; name: string }> };
      error?: { message?: string } | null;
    };
    if (list.error) {
      throw new Error(`Resend domains.list failed: ${list.error.message ?? "unknown error"}`);
    }

    const domains = list.data?.data ?? [];
    if (domains.length === 0) {
      throw new Error("No domains registered in Resend. Add a sending domain first.");
    }

    const target = domainName
      ? domains.find((d) => d.name === domainName)
      : domains.length === 1
        ? domains[0]
        : undefined;

    if (!target) {
      const names = domains.map((d) => d.name).join(", ");
      throw new Error(
        domainName
          ? `Domain "${domainName}" not found in Resend. Available: ${names}`
          : `Multiple domains registered (${names}); pass an explicit domain name.`,
      );
    }

    const detail = (await client.domains.get(target.id)) as {
      data?: {
        id: string;
        name: string;
        status?: string;
        records?: Array<{ record?: string; type?: string; name?: string; status?: string }>;
      };
      error?: { message?: string } | null;
    };
    if (detail.error || !detail.data) {
      throw new Error(`Resend domains.get failed: ${detail.error?.message ?? "no data"}`);
    }

    return classifyDomainRecords({
      id: detail.data.id,
      name: detail.data.name,
      status: detail.data.status ?? "unknown",
      records: detail.data.records ?? [],
    });
  }
}
