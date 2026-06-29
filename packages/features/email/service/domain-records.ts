/**
 * Pure classification of Resend domain DNS records into SPF / DKIM / DMARC
 * buckets. Kept separate from the service so it is unit-testable without the
 * Resend SDK or network.
 */

export interface RawDomainRecord {
  record?: string;
  type?: string;
  name?: string;
  status?: string;
}

export interface DomainRecordStatus {
  record: string;
  type: string;
  name: string;
  status: string;
}

export interface DomainVerificationResult {
  id: string;
  name: string;
  status: string;
  spf: DomainRecordStatus[];
  dkim: DomainRecordStatus[];
  dmarc: DomainRecordStatus[];
  other: DomainRecordStatus[];
  /** True when the domain is verified and every classified record is verified. */
  allVerified: boolean;
}

type RecordKind = "spf" | "dkim" | "dmarc" | "other";

function classifyKind(record: RawDomainRecord): RecordKind {
  const label = (record.record ?? "").toLowerCase();
  const name = (record.name ?? "").toLowerCase();

  if (label.includes("dmarc") || name.startsWith("_dmarc")) return "dmarc";
  if (label.includes("dkim") || name.includes("_domainkey")) return "dkim";
  if (label.includes("spf") || label.includes("mx")) return "spf";
  return "other";
}

function isVerified(status: string): boolean {
  return status.toLowerCase() === "verified";
}

export function classifyDomainRecords(input: {
  id: string;
  name: string;
  status: string;
  records: RawDomainRecord[];
}): DomainVerificationResult {
  const buckets: Record<RecordKind, DomainRecordStatus[]> = {
    spf: [],
    dkim: [],
    dmarc: [],
    other: [],
  };

  for (const raw of input.records) {
    const normalized: DomainRecordStatus = {
      record: raw.record ?? "",
      type: raw.type ?? "",
      name: raw.name ?? "",
      status: raw.status ?? "unknown",
    };
    buckets[classifyKind(raw)].push(normalized);
  }

  const classified = [...buckets.spf, ...buckets.dkim, ...buckets.dmarc];
  const allVerified =
    isVerified(input.status) &&
    classified.length > 0 &&
    classified.every((r) => isVerified(r.status));

  return {
    id: input.id,
    name: input.name,
    status: input.status,
    spf: buckets.spf,
    dkim: buckets.dkim,
    dmarc: buckets.dmarc,
    other: buckets.other,
    allVerified,
  };
}
