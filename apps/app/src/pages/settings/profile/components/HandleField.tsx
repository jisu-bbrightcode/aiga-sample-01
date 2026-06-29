import { useFeatureTranslation } from "@repo/core/i18n";
import { SetPrefixInput, SettingItem } from "@repo/ui/settings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { $api, apiClient, requireApiData, USER_PROFILE_ME_QUERY_KEY } from "../../api";

const HANDLE_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export function HandleField() {
  const qc = useQueryClient();
  const me = $api.useQuery("get", "/api/user-profile/me", {});
  const update = useMutation({
    mutationKey: ["patch", "/api/user-profile/handle"],
    mutationFn: async (input: { handle: string }) => {
      const { data, error } = await apiClient.PATCH("/api/user-profile/handle", { body: input });
      if (error) throw error;
      return requireApiData(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USER_PROFILE_ME_QUERY_KEY }),
  });
  const { t } = useFeatureTranslation("page.settings");

  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (me.data?.handle) {
      setValue(me.data.handle);
      setDebounced(me.data.handle);
    }
  }, [me.data?.handle]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), 300);
    return () => clearTimeout(id);
  }, [value]);

  const valid = HANDLE_REGEX.test(debounced);
  const isOwn = me.data?.handle && me.data.handle === debounced;
  const check = $api.useQuery(
    "get",
    "/api/user-profile/handles/{handle}/availability",
    {
      params: { path: { handle: debounced } },
    },
    {
      enabled: valid && !isOwn,
    },
  );

  let hint = `product-builder.app/${value}`;
  let invalid = false;
  if (!valid && debounced.length > 0) {
    hint = t("profile.handle.error.invalid");
    invalid = true;
  } else if (check.data?.available === false && !isOwn) {
    hint = t("profile.handle.error.taken");
    invalid = true;
  } else if (check.data?.available === true) {
    hint = `product-builder.app/${debounced} — ${t("profile.handle.hint.available")}`;
  }

  function onBlur() {
    if (!valid || isOwn) return;
    if (check.data?.available === true) {
      update.mutate({ handle: debounced });
    }
  }

  return (
    <SettingItem title={t("profile.handle.title")} description={t("profile.handle.description")}>
      <SetPrefixInput
        prefix="product-builder.app/"
        value={value}
        onChange={(v) => setValue(v.toLowerCase())}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        invalid={invalid}
      />
      <p className="mt-1.5 font-mono text-xs text-muted-foreground">{hint}</p>
    </SettingItem>
  );
}
