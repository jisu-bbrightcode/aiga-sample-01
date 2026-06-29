import { useFeatureTranslation } from "@repo/core/i18n";
import { Input } from "@repo/ui/shadcn/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@repo/ui/shadcn/select";
import { useState } from "react";

// KCB TEL_COM_CD carriers (01–06). Labels are i18n keys.
const CARRIERS = [
  { code: "01", labelKey: "formCarrierSkt" },
  { code: "02", labelKey: "formCarrierKt" },
  { code: "03", labelKey: "formCarrierLgu" },
  { code: "04", labelKey: "formCarrierMvnoSkt" },
  { code: "05", labelKey: "formCarrierMvnoKt" },
  { code: "06", labelKey: "formCarrierMvnoLgu" },
] as const;

const RRN_MASK_DOTS = ["d1", "d2", "d3", "d4", "d5", "d6"];

// Bare input inside the bordered field box — strip shadcn chrome, keep the brand caret.
const FIELD_INPUT =
  "h-8 border-0 bg-transparent px-0 text-lg font-medium text-foreground shadow-none caret-[#00bb74] placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0";

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/**
 * Embedded-style phone identity form (Plantit design). UI-only building block:
 * the actual verification action is intentionally omitted — the builder wires it
 * (KCB embedded requires a separate KCB contract not yet provisioned).
 */
export function IdentityVerificationFormPage() {
  const { t } = useFeatureTranslation("feature.identityVerification");
  const [carrier, setCarrier] = useState("06");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState("");
  const [name, setName] = useState("");
  const carrierLabelKey =
    CARRIERS.find((item) => item.code === carrier)?.labelKey ?? "formCarrierMvnoLgu";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col bg-background px-5 pt-10 pb-12">
      <h2 className="whitespace-pre-line text-[22px] font-semibold leading-[30px] text-foreground">
        {t("formTitle")}
      </h2>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-xl border border-foreground bg-background px-4 pt-4 pb-3 shadow-sm">
          <span className="text-xs font-medium text-muted-foreground">{t("formPhoneLabel")}</span>
          <div className="flex items-center gap-3">
            <Select value={carrier} onValueChange={(value) => setCarrier(value ?? "06")}>
              <SelectTrigger
                size="sm"
                className="w-auto gap-1 bg-muted"
                aria-label={t("formPhoneLabel")}
              >
                <span className="text-sm font-medium text-foreground">{t(carrierLabelKey)}</span>
              </SelectTrigger>
              <SelectContent>
                {CARRIERS.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {t(item.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={phone}
              onChange={(event) => setPhone(onlyDigits(event.target.value).slice(0, 11))}
              inputMode="numeric"
              placeholder={t("formPhonePlaceholder")}
              className={`${FIELD_INPUT} flex-1`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border bg-muted px-4 pt-4 pb-3">
          <span className="text-xs font-medium text-muted-foreground">{t("formRrnLabel")}</span>
          <div className="flex items-center gap-2">
            <Input
              value={birth}
              onChange={(event) => setBirth(onlyDigits(event.target.value).slice(0, 6))}
              inputMode="numeric"
              placeholder={t("formBirthPlaceholder")}
              className={`${FIELD_INPUT} flex-1`}
            />
            <span className="h-0.5 w-2.5 shrink-0 rounded bg-muted-foreground" />
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <Input
                value={gender}
                onChange={(event) => setGender(onlyDigits(event.target.value).slice(0, 1))}
                inputMode="numeric"
                className={`${FIELD_INPUT} w-8 text-center`}
              />
              <div className="flex items-center gap-1" aria-hidden="true">
                {RRN_MASK_DOTS.map((dot) => (
                  <span key={dot} className="size-1.5 rounded-full bg-muted-foreground/60" />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border bg-muted px-4 pt-4 pb-3">
          <span className="text-xs font-medium text-muted-foreground">{t("formNameLabel")}</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("formNamePlaceholder")}
            className={`${FIELD_INPUT} w-full`}
          />
        </div>
      </div>
    </div>
  );
}
