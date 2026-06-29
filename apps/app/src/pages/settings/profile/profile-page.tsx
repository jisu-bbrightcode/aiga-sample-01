/**
 * /settings/profile — Personal General settings page (Phase 1).
 *
 * Sections (top to bottom, per design):
 *   1. AvatarSection      (1.5)
 *   2. NameField          (1.6)
 *   3. HandleField        (1.7) — handle + product-builder.app/{handle} preview
 *   4. EmailField         (1.8) — read-only
 *   5. BioField           (1.9)
 *   6. EditorFontSection  (1.10)
 *   7. ColorModeSection   (1.11)
 *   8. TextSizeSection    (1.12)
 *   9. LocaleSection      (1.13)
 *  10. TimezoneSection    (1.14)
 *  11. DateFormatSection  (1.15)
 *  12. DeleteAccountSection (1.16)
 */
import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingPageLayout } from "../_shared/SettingPageLayout";
import { AvatarSection } from "./components/AvatarSection";
import { BioField } from "./components/BioField";
import { ColorModeSection } from "./components/ColorModeSection";
import { DateFormatSection } from "./components/DateFormatSection";
import { DeleteAccountSection } from "./components/DeleteAccountSection";
import { EditorFontSection } from "./components/EditorFontSection";
import { EmailField } from "./components/EmailField";
import { HandleField } from "./components/HandleField";
import { LocaleSection } from "./components/LocaleSection";
import { NameField } from "./components/NameField";
import { TextSizeSection } from "./components/TextSizeSection";
import { TimezoneSection } from "./components/TimezoneSection";

export function ProfilePage() {
  const { t } = useFeatureTranslation("page.settings");
  return (
    <SettingPageLayout title={t("profile.title")}>
      <div className="flex flex-col gap-8">
        <AvatarSection />
        <NameField />
        <HandleField />
        <EmailField />
        <BioField />
        <EditorFontSection />
        <ColorModeSection />
        <TextSizeSection />
        <LocaleSection />
        <TimezoneSection />
        <DateFormatSection />
        <DeleteAccountSection />
      </div>
    </SettingPageLayout>
  );
}
