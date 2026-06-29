/**
 * /settings/organization — Organization General page (Phase 2).
 *
 * Per spec § 4.2 + Approved Divergences:
 *   - Brand Logo
 *   - Organization Name
 *   - Billing Email (organization metadata)
 *   - Delete Organization (soft-delete via metadata.deletedAt)
 */
import { authClient } from "@repo/core/auth/client";
import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingPageLayout } from "../_shared/SettingPageLayout";
import { OrgBillingEmailSection } from "./components/sections/OrgBillingEmailSection";
import { OrgDeleteSection } from "./components/sections/OrgDeleteSection";
import { OrgLogoSection } from "./components/sections/OrgLogoSection";
import { OrgNameSection } from "./components/sections/OrgNameSection";

export function OrganizationPage() {
  const { data: session } = authClient.useSession();
  const activeOrgId = session?.session?.activeOrganizationId;
  const { t } = useFeatureTranslation("page.settings");

  if (!activeOrgId) {
    return (
      <SettingPageLayout title={t("organization.title")}>
        <p className="text-sm text-muted-foreground">{t("organization.noActive")}</p>
      </SettingPageLayout>
    );
  }

  return (
    <SettingPageLayout title={t("organization.title")}>
      <div className="flex flex-col gap-8">
        <OrgLogoSection organizationId={activeOrgId} />
        <OrgNameSection organizationId={activeOrgId} />
        <OrgBillingEmailSection organizationId={activeOrgId} />
        <OrgDeleteSection organizationId={activeOrgId} />
      </div>
    </SettingPageLayout>
  );
}
