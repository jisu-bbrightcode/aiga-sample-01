import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingItem } from "@repo/ui/settings";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/shadcn/toggle-group";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getUserPreferenceQueryKey, setUserPreference, useUserPreference } from "../../api";

const KEY = "date_format";
const VALID = new Set(["iso", "kr", "us"]);

export function DateFormatSection() {
  const qc = useQueryClient();
  const stored = useUserPreference(KEY);
  const set = useMutation({
    mutationKey: ["put", "/api/user-preferences/{key}", KEY],
    mutationFn: setUserPreference,
    onSuccess: () => qc.invalidateQueries({ queryKey: getUserPreferenceQueryKey(KEY) }),
  });
  const { t } = useFeatureTranslation("page.settings");
  const options = [
    { value: "iso", label: "2026-04-27" },
    { value: "kr", label: t("profile.dateFormat.kr.example") },
    { value: "us", label: "Apr 27, 2026" },
  ];
  const [value, setValue] = useState<string>("iso");
  useEffect(() => {
    if (typeof stored.data === "string" && VALID.has(stored.data)) {
      setValue(stored.data);
    }
  }, [stored.data]);

  function handle(v: unknown) {
    const next = Array.isArray(v) ? v[0] : v;
    if (typeof next !== "string" || !VALID.has(next)) return;
    setValue(next);
    set.mutate({ key: KEY, value: next });
  }

  return (
    <SettingItem
      title={t("profile.dateFormat.title")}
      description={t("profile.dateFormat.description")}
    >
      <ToggleGroup value={[value]} onValueChange={handle} spacing={2}>
        {options.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value}>
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </SettingItem>
  );
}
