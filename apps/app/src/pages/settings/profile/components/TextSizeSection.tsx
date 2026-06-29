import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingItem } from "@repo/ui/settings";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/shadcn/toggle-group";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { type TextSize, useTextSize } from "../../_shared/use-text-size";
import { getUserPreferenceQueryKey, setUserPreference, useUserPreference } from "../../api";

const PREFERENCE_KEY = "text_size";

export function TextSizeSection() {
  const qc = useQueryClient();
  const { size, setSize } = useTextSize();
  const stored = useUserPreference(PREFERENCE_KEY);
  const set = useMutation({
    mutationKey: ["put", "/api/user-preferences/{key}", PREFERENCE_KEY],
    mutationFn: setUserPreference,
    onSuccess: () => qc.invalidateQueries({ queryKey: getUserPreferenceQueryKey(PREFERENCE_KEY) }),
  });
  const { t } = useFeatureTranslation("page.settings");

  useEffect(() => {
    if (stored.data === "md" || stored.data === "lg") {
      setSize(stored.data);
    }
  }, [stored.data, setSize]);

  function handle(v: unknown) {
    const next = Array.isArray(v) ? v[0] : v;
    if (next !== "sm" && next !== "md" && next !== "lg") return;
    setSize(next as TextSize);
    set.mutate({ key: PREFERENCE_KEY, value: next });
  }

  return (
    <SettingItem
      title={t("profile.textSize.title")}
      description={t("profile.textSize.description")}
    >
      <ToggleGroup value={[size]} onValueChange={handle} spacing={2}>
        <ToggleGroupItem value="sm">{t("profile.textSize.sm")}</ToggleGroupItem>
        <ToggleGroupItem value="md">{t("profile.textSize.md")}</ToggleGroupItem>
        <ToggleGroupItem value="lg">{t("profile.textSize.lg")}</ToggleGroupItem>
      </ToggleGroup>
    </SettingItem>
  );
}
