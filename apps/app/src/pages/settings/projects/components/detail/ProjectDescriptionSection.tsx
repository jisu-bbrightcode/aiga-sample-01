import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingItem } from "@repo/ui/settings";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "../../../../../lib/api";
import { getSettingsProjectByIdQueryKey } from "../../../api";

interface Props {
  projectId: string;
  initial: string;
}

export function ProjectDescriptionSection({ projectId, initial }: Props) {
  const qc = useQueryClient();
  const update = useMutation({
    mutationKey: ["put", "/api/projects/{id}"],
    mutationFn: async (description: string) => {
      const { data, error } = await apiClient.PUT("/api/projects/{id}", {
        params: { path: { id: projectId } },
        body: { description },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: getSettingsProjectByIdQueryKey(projectId),
      }),
  });
  const [value, setValue] = useState(initial);
  const { t } = useFeatureTranslation("page.settings");

  function onBlur() {
    if (value !== initial) {
      update.mutate(value);
    }
  }

  return (
    <SettingItem
      title={t("projects.detail.description.title")}
      description={t("projects.detail.description.helper")}
    >
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} onBlur={onBlur} rows={3} />
    </SettingItem>
  );
}
