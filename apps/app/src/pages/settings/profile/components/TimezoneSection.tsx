/**
 * TimezoneSection — preferred timezone for date/time formatting.
 * Persists to user_preferences key='timezone'.
 */
import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingItem } from "@repo/ui/settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserPreferenceQueryKey, setUserPreference, useUserPreference } from "../../api";

const KEY = "timezone";

function getZones(): string[] {
  // Prefer the standard API; fallback to a tight curated list.
  type IntlExt = { supportedValuesOf?: (k: "timeZone") => string[] };
  const ext = Intl as unknown as IntlExt;
  const builtin = ext.supportedValuesOf?.("timeZone");
  if (builtin && builtin.length > 0) return builtin;
  return [
    "Asia/Seoul",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Taipei",
    "America/New_York",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Berlin",
    "UTC",
  ];
}

const ZONES = getZones();

export function TimezoneSection() {
  const qc = useQueryClient();
  const stored = useUserPreference(KEY);
  const set = useMutation({
    mutationKey: ["put", "/api/user-preferences/{key}", KEY],
    mutationFn: setUserPreference,
    onSuccess: () => qc.invalidateQueries({ queryKey: getUserPreferenceQueryKey(KEY) }),
  });
  const { t } = useFeatureTranslation("page.settings");

  const value: string =
    (stored.data as string | null | undefined) ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "Asia/Seoul";

  return (
    <SettingItem
      title={t("profile.timezone.title")}
      description={t("profile.timezone.description")}
    >
      <Select
        value={value}
        onValueChange={(v) => {
          if (v) set.mutate({ key: KEY, value: v });
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("profile.timezone.placeholder")} />
        </SelectTrigger>
        <SelectContent className="max-h-60" alignItemWithTrigger={false}>
          {ZONES.map((z) => (
            <SelectItem key={z} value={z}>
              {z}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingItem>
  );
}
