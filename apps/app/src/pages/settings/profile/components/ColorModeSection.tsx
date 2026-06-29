import { useFeatureTranslation } from "@repo/core/i18n";
import { type ThemeMode, themeAtom } from "@repo/core/theme";
import { SettingItem } from "@repo/ui/settings";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/shadcn/toggle-group";
import { useAtom } from "jotai";

const OPTIONS: { value: ThemeMode; labelKey: string }[] = [
  { value: "light", labelKey: "profile.colorMode.light" },
  { value: "dark", labelKey: "profile.colorMode.dark" },
  { value: "system", labelKey: "profile.colorMode.system" },
];

export function ColorModeSection() {
  const [theme, setTheme] = useAtom(themeAtom);
  const { t } = useFeatureTranslation("page.settings");

  return (
    <SettingItem
      title={t("profile.colorMode.title")}
      description={t("profile.colorMode.description")}
    >
      <ToggleGroup
        value={[theme]}
        onValueChange={(v) => {
          const next = (Array.isArray(v) ? v[0] : v) as ThemeMode | undefined;
          if (next) setTheme(next);
        }}
        spacing={2}
      >
        {OPTIONS.map((o) => (
          <ToggleGroupItem key={o.value} value={o.value} aria-label={t(o.labelKey)}>
            {t(o.labelKey)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </SettingItem>
  );
}
