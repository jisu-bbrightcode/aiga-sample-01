export const INICIS_BILLING_BLOCKER = {
  code: "inicis_billing_contract_unverified",
  message:
    "INICIS billing requires merchant billing contract and INILite Key verification before reusable implementation can be marked complete.",
  requiredEvidence: [
    "Merchant MID enabled for billing",
    "INILite Key from merchant settings",
    "Official billing key issue test vector",
    "Billing approval sandbox evidence",
  ],
} as const;
