import { classifyDomainRecords } from "./domain-records";

describe("classifyDomainRecords", () => {
  it("buckets SPF/DKIM/DMARC records and flags fully verified", () => {
    const result = classifyDomainRecords({
      id: "dom_1",
      name: "mail.example.com",
      status: "verified",
      records: [
        { record: "SPF", type: "MX", name: "send", status: "verified" },
        { record: "SPF", type: "TXT", name: "send", status: "verified" },
        { record: "DKIM", type: "TXT", name: "resend._domainkey", status: "verified" },
        { record: "DMARC", type: "TXT", name: "_dmarc", status: "verified" },
      ],
    });

    expect(result.spf).toHaveLength(2);
    expect(result.dkim).toHaveLength(1);
    expect(result.dmarc).toHaveLength(1);
    expect(result.allVerified).toBe(true);
  });

  it("is not fully verified when any record is pending", () => {
    const result = classifyDomainRecords({
      id: "dom_1",
      name: "mail.example.com",
      status: "pending",
      records: [
        { record: "DKIM", type: "TXT", name: "resend._domainkey", status: "pending" },
      ],
    });

    expect(result.dkim[0]?.status).toBe("pending");
    expect(result.allVerified).toBe(false);
  });

  it("classifies by DNS name when the record label is absent", () => {
    const result = classifyDomainRecords({
      id: "dom_1",
      name: "example.com",
      status: "verified",
      records: [
        { type: "TXT", name: "_dmarc.example.com", status: "verified" },
        { type: "CNAME", name: "abc._domainkey.example.com", status: "verified" },
      ],
    });

    expect(result.dmarc).toHaveLength(1);
    expect(result.dkim).toHaveLength(1);
  });

  it("is not fully verified when there are no classified records", () => {
    const result = classifyDomainRecords({
      id: "dom_1",
      name: "example.com",
      status: "verified",
      records: [],
    });
    expect(result.allVerified).toBe(false);
  });
});
