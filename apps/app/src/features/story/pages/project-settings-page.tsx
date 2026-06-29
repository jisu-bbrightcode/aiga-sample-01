/**
 * 프로젝트 설정 — 일반 페이지.
 * 좌측 설정 네비게이션 + 우측 일반 설정 폼.
 *
 * 프로젝트 일반 설정 페이지.
 */

import type { Language } from "@repo/core/i18n";
import { useFeatureTranslation, useLanguage } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppQuietLoadingState } from "@/components/app-loading";
import { useUpdateProject } from "@/features/project/hooks/use-project-mutations";
import { useProject } from "@/features/project/hooks/use-project-queries";
import { ProjectDeleteDialog } from "../components/project-delete-dialog";
import { ProjectSettingsNav } from "./project-settings-nav";

export function ProjectSettingsPage() {
  const { projectId } = useParams({ strict: false }) as {
    projectId: string;
  };

  return (
    <div className="flex h-full">
      <ProjectSettingsNav projectId={projectId} />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-[640px]">
          <GeneralSettingsForm projectId={projectId} />
        </div>
      </div>
    </div>
  );
}

interface GeneralSettingsFormProps {
  projectId: string;
}

function GeneralSettingsForm({ projectId }: GeneralSettingsFormProps) {
  const { data: project } = useProject(projectId);
  const updateProject = useUpdateProject();
  const { t } = useFeatureTranslation("feature.story");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name ?? "");
      setDescription(project.description ?? "");
    }
  }, [project]);

  const hasChanges =
    project && (name !== (project.name ?? "") || description !== (project.description ?? ""));

  function handleSave() {
    if (!hasChanges) return;
    updateProject.mutate({ id: projectId, data: { name, description } });
  }

  if (!project) {
    return <AppQuietLoadingState label={t("project.settings.loading")} variant="inline" />;
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-lg font-semibold">{t("project.settings.general.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("project.settings.general.description")}</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="project-name">
            {t("project.settings.field.name")}
          </label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("project.settings.field.namePlaceholder")}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="project-desc">
            {t("project.settings.field.description")}
          </label>
          <Textarea
            id="project-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("project.settings.field.descriptionPlaceholder")}
            rows={3}
          />
        </div>

        {/* UI 표시 언어 — localStorage 저장, react-i18next 즉시 적용 */}
        <LanguageField />

        {/* Save */}
        <div>
          <Button onClick={handleSave} disabled={!hasChanges || updateProject.isPending}>
            {updateProject.isPending ? t("project.settings.saving") : t("project.settings.save")}
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border-destructive/30 mt-12 rounded-lg border p-6">
        <h2 className="text-destructive mb-1 text-sm font-semibold">{t("project.settings.danger.title")}</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          {t("project.settings.danger.description")}
        </p>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          {t("project.settings.danger.deleteButton")}
        </Button>
      </div>

      <ProjectDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        projectId={projectId}
        projectName={project.name ?? ""}
      />
    </>
  );
}

const LANGUAGE_OPTIONS: ReadonlyArray<{ value: Language; label: string }> = [
  // i18n-ignore-next-line — 언어 self-label 은 해당 언어 그대로 표기
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  // i18n-ignore-next-line
  { value: "ja", label: "日本語" },
  // i18n-ignore-next-line
  { value: "zh", label: "中文 (简体)" },
];

function isLanguage(value: string | null | undefined): value is Language {
  return value === "ko" || value === "en" || value === "ja" || value === "zh";
}

function LanguageField() {
  const { t } = useFeatureTranslation("feature.story");
  const [language, setLanguage] = useLanguage();
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor="project-language">
        {t("project.settings.field.language")}
      </label>
      <p className="text-muted-foreground text-xs">
        {t("project.settings.field.languageDescription")}
      </p>
      <Select
        value={language}
        onValueChange={(v) => {
          if (isLanguage(v)) setLanguage(v);
        }}
      >
        <SelectTrigger id="project-language" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {LANGUAGE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
