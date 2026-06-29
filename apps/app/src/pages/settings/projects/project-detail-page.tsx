/**
 * /settings?projectId=... — project detail settings.
 *
 * Sections (read-mostly per Phase 4 read-only policy):
 *  - Header (cover / name / visibility / URL / updated)
 *  - Name (editable via existing project.update)
 *  - Handle (read-only)
 *  - Description (editable)
 *  - Visibility (read-only badge)
 *  - Members (read-only list — mutation backlog)
 *  - Tags (story_tags table — read-only this phase)
 *  - Danger zone (project permanent delete)
 */
import { authClient } from "@repo/core/auth/client";
import { useFeatureTranslation } from "@repo/core/i18n";
import { useParams } from "@tanstack/react-router";
import { AppQuietLoadingState } from "@/components/app-loading";
import { SettingPageLayout } from "../_shared/SettingPageLayout";
import { $api } from "../api";
import { ProjectDeleteSection } from "./components/detail/ProjectDeleteSection";
import { ProjectDescriptionSection } from "./components/detail/ProjectDescriptionSection";
import { ProjectHandleReadOnly } from "./components/detail/ProjectHandleReadOnly";
import { ProjectHeader } from "./components/detail/ProjectHeader";
import { ProjectLanguagesSection } from "./components/detail/ProjectLanguagesSection";
import { ProjectMembersSection } from "./components/detail/ProjectMembersSection";
import { ProjectNameSection } from "./components/detail/ProjectNameSection";
import { ProjectTagsSection } from "./components/detail/ProjectTagsSection";
import { ProjectVisibilitySection } from "./components/detail/ProjectVisibilitySection";

interface ProjectDetailPageProps {
  projectIdOverride?: string;
}

export function ProjectDetailPage({ projectIdOverride }: ProjectDetailPageProps = {}) {
  const params = useParams({ strict: false }) as { projectId?: string };
  const projectId = projectIdOverride ?? params.projectId ?? "";
  const { data: org } = authClient.useActiveOrganization();
  const detail = $api.useQuery(
    "get",
    "/api/settings-projects/{projectId}",
    {
      params: { path: { projectId } },
    },
    { enabled: Boolean(projectId) },
  );
  const { t } = useFeatureTranslation("page.settings");

  if (detail.isLoading) {
    return (
      <SettingPageLayout title={t("projects.detail.title", { defaultValue: t("projects.title") })}>
        <AppQuietLoadingState label={t("projects.loading")} variant="inline" />
      </SettingPageLayout>
    );
  }
  if (!detail.data) {
    return (
      <SettingPageLayout title={t("projects.title")}>
        <p className="text-muted-foreground mt-4 text-sm">{t("projects.detail.notFound")}</p>
      </SettingPageLayout>
    );
  }

  const project = detail.data;
  const orgSlug = org?.slug ?? "you";

  return (
    <SettingPageLayout title={t("projects.title")}>
      <div className="flex flex-col gap-8">
        <ProjectHeader
          name={project.name}
          handle={project.handle}
          visibility={project.visibility}
          orgSlug={orgSlug}
          starred={project.starred}
          updatedAt={project.updatedAt}
        />
        <ProjectNameSection projectId={projectId} initial={project.name} />
        <ProjectHandleReadOnly org={orgSlug} handle={project.handle} projectId={projectId} />
        <ProjectDescriptionSection projectId={projectId} initial={project.description ?? ""} />
        <ProjectVisibilitySection visibility={project.visibility} />
        <ProjectMembersSection members={project.members ?? []} />
        <ProjectLanguagesSection languages={project.languages ?? []} />
        <ProjectTagsSection tags={project.tags ?? []} />
        <ProjectDeleteSection projectId={projectId} name={project.name} />
      </div>
    </SettingPageLayout>
  );
}
