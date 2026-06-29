/**
 * LocaleSection — preferred display language.
 *
 * Stores the choice in localStorage via `useLanguage` (jotai atomWithStorage).
 * react-i18next is switched synchronously inside the hook, so changes apply
 * without a page refresh.
 *
 * Picker labels (한국어 / English / 日本語 / 中文) intentionally stay in their
 * own language — they are language self-labels, not UI chrome.
 */

import type { Language } from "@repo/core/i18n";
import { useFeatureTranslation, useLanguage } from "@repo/core/i18n";
import { SettingItem } from "@repo/ui/settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";

const OPTIONS: ReadonlyArray<{ value: Language; label: string }> = [
  // i18n-ignore-next-line — language self-label stays native
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  // i18n-ignore-next-line — language self-label stays native
  { value: "ja", label: "日本語" },
  // i18n-ignore-next-line — language self-label stays native
  { value: "zh", label: "中文 (简体)" },
];

function isLanguage(value: string | null | undefined): value is Language {
  return value === "ko" || value === "en" || value === "ja" || value === "zh";
}

export function LocaleSection() {
  const [language, setLanguage] = useLanguage();
  const { t } = useFeatureTranslation("page.settings");

  return (
    <SettingItem title={t("profile.locale.title")} description={t("profile.locale.description")}>
      <Select
        value={language}
        onValueChange={(v) => {
          if (isLanguage(v)) setLanguage(v);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("profile.locale.placeholder")} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingItem>
  );
}
