import { useFeatureTranslation } from "@repo/core/i18n";
import { HueAvatar, Pill, SettingItem } from "@repo/ui/settings";
import { displayRole } from "../../../organization/members/role-display";

interface Member {
  userId: string;
  role: string;
  name: string | null;
  email: string | null;
  handle: string | null;
  avatar: string | null;
}

interface Props {
  members: Member[];
}

export function ProjectMembersSection({ members }: Props) {
  const { t } = useFeatureTranslation("page.settings");
  return (
    <SettingItem
      title={t("projects.detail.members.title", { count: members.length })}
      description={t("projects.detail.members.description")}
    >
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("projects.detail.members.empty")}</p>
      ) : (
        <ul className="flex flex-col">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 py-3">
              <HueAvatar
                name={m.name ?? undefined}
                email={m.email ?? undefined}
                src={m.avatar ?? undefined}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base">{m.name ?? m.email ?? m.userId}</div>
                {m.handle ? (
                  <div className="truncate text-sm text-muted-foreground">@{m.handle}</div>
                ) : null}
              </div>
              <Pill tone="neutral">{displayRole(m.role)}</Pill>
            </li>
          ))}
        </ul>
      )}
    </SettingItem>
  );
}
