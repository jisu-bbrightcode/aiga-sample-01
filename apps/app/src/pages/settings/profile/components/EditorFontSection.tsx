import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingItem } from "@repo/ui/settings";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/shadcn/toggle-group";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getUserPreferenceQueryKey, setUserPreference, useUserPreference } from "../../api";

const KEY = "editor_font";
const FONTS = {
  geist: '"Geist", "Geist Sans", system-ui, sans-serif',
  pretendard: '"Pretendard Variable", "Pretendard", system-ui, sans-serif',
  system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
} as const;
type FontKey = keyof typeof FONTS;

const OPTIONS: { value: FontKey; label: string; labelKey?: string }[] = [
  { value: "geist", label: "Geist" },
  { value: "pretendard", label: "Pretendard" },
  { value: "system", label: "", labelKey: "profile.editorFont.system" },
];

function applyEditorFont(key: FontKey) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--editor-font-family", FONTS[key]);
}

export function EditorFontSection() {
  const qc = useQueryClient();
  const stored = useUserPreference(KEY);
  const set = useMutation({
    mutationKey: ["put", "/api/user-preferences/{key}", KEY],
    mutationFn: setUserPreference,
    onSuccess: () => qc.invalidateQueries({ queryKey: getUserPreferenceQueryKey(KEY) }),
  });
  const { t } = useFeatureTranslation("page.settings");
  const value: FontKey =
    stored.data === "pretendard" || stored.data === "system" ? stored.data : "geist";

  useEffect(() => applyEditorFont(value), [value]);

  function handle(v: unknown) {
    const next = Array.isArray(v) ? v[0] : v;
    if (next !== "geist" && next !== "pretendard" && next !== "system") return;
    applyEditorFont(next as FontKey);
    set.mutate({ key: KEY, value: next });
  }

  return (
    <SettingItem
      title={t("profile.editorFont.title")}
      description={t("profile.editorFont.description")}
    >
      <ToggleGroup value={[value]} onValueChange={handle} spacing={2}>
        {OPTIONS.map((o) => {
          const label = o.labelKey ? t(o.labelKey) : o.label;
          return (
            <ToggleGroupItem
              key={o.value}
              value={o.value}
              aria-label={label}
              style={{ fontFamily: FONTS[o.value] }}
            >
              {label}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </SettingItem>
  );
}
