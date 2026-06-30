/**
 * 내 등급 (Membership) section on the My Page — FR-001 / BBR-581.
 *
 * Surfaces the user's grade (소셜 로그인 후 판정된 등급) and the daily usage limit
 * applied to that grade. It reads `GET /users/me` through {@link useMe} and reuses
 * {@link ServiceSection} so it branches loading / error(권한 없음 on 401) / empty
 * (등급 미부여) / ready exactly like the personalization sections — keeping the
 * whole My Page's state handling consistent (AC#1, AC#2).
 *
 * The numeric daily cap is only rendered when `/users/me` provides it. Today's
 * self contract omits quota config (admin-only), so the card shows the generic
 * 한도 안내 copy; the moment a follow-up backend issue adds `dailyUsageLimit` to
 * the self DTO, the exact value renders with no further UI change.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { Badge } from "@repo/ui/shadcn/badge";
import type { UserGradeBadge } from "../api/types";
import { useMe } from "../hooks/queries";
import { resolveDailyLimit } from "../lib/daily-limit";
import { ServiceSection } from "./service-section";

export function MembershipSection({ enabled }: { enabled: boolean }) {
  const { t } = useFeatureTranslation("app");
  const me = useMe(enabled);

  return (
    <ServiceSection
      title={t("serviceFlow.membership.title")}
      description={t("serviceFlow.membership.description")}
      isLoading={me.isPending}
      isError={me.isError}
      error={me.error}
      isEmpty={!me.data?.grade}
      emptyMessage={t("serviceFlow.membership.empty")}
      onRetry={() => void me.refetch()}
    >
      {me.data?.grade ? <GradeCard grade={me.data.grade} /> : null}
    </ServiceSection>
  );
}

function GradeCard({ grade }: { grade: UserGradeBadge }) {
  const { t } = useFeatureTranslation("app");
  const limit = resolveDailyLimit(grade.dailyUsageLimit);

  const limitText =
    limit.kind === "unlimited"
      ? t("serviceFlow.membership.limitUnlimited")
      : limit.kind === "limited"
        ? t("serviceFlow.membership.limitValue", { count: limit.limit })
        : t("serviceFlow.membership.limitNote");

  return (
    <div className="flex flex-col gap-3" data-el="service-flow.membership.card">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t("serviceFlow.membership.gradeLabel")}
        </span>
        <Badge variant="secondary" data-el="service-flow.membership.grade-badge">
          {grade.name}
        </Badge>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-muted-foreground">
          {t("serviceFlow.membership.limitLabel")}
        </span>
        <p className="text-sm text-foreground" data-el="service-flow.membership.limit">
          {limitText}
        </p>
      </div>
    </div>
  );
}
