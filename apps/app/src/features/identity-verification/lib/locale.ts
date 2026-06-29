import type { IdentityVerificationLocale } from "@repo/features/identity-verification/ui";

const SUPPORTED: readonly IdentityVerificationLocale[] = ["ko", "en", "ja", "zh"];

/** Map the active i18n language (e.g. "ko-KR") to a reusable-component locale. */
export function toIdentityLocale(language: string | undefined): IdentityVerificationLocale {
  const prefix = (language ?? "ko").slice(0, 2).toLowerCase();
  return (SUPPORTED as readonly string[]).includes(prefix)
    ? (prefix as IdentityVerificationLocale)
    : "ko";
}
