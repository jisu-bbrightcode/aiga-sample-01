import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingItem } from "@repo/ui/settings";
import { Input } from "@repo/ui/shadcn/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "../../../../../lib/api";
import { getSettingsProjectByIdQueryKey } from "../../../api";

interface Props {
  projectId: string;
  initial: string;
}

export function ProjectNameSection({ projectId, initial }: Props) {
  const qc = useQueryClient();
  const update = useMutation({
    mutationKey: ["put", "/api/projects/{id}"],
    mutationFn: async (name: string) => {
      const { data, error } = await apiClient.PUT("/api/projects/{id}", {
        params: { path: { id: projectId } },
        body: { name },
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
    if (value.trim() && value !== initial) {
      update.mutate(value.trim());
    }
  }

  return (
    <SettingItem
      title={t("projects.detail.name.title")}
      description={t("projects.detail.name.description")}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} onBlur={onBlur} />
    </SettingItem>
  );
}
