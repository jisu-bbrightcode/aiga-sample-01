/**
 * Doctor card for the public explore entry (PB-WEB-002 / BBR-580, FR-002 / BBR-729).
 * Renders one published doctor from the public catalog contract with gated
 * 저장/관심 CTAs — browsable logged-out, the CTAs gate the protected actions.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/shadcn/avatar";
import { Star } from "lucide-react";
import type { PublicDoctor } from "../api/types";
import { GatedActionButton } from "./gated-action-button";

export function DoctorExploreCard({ doctor }: { doctor: PublicDoctor }) {
  const { t } = useFeatureTranslation("app");
  const initial = (doctor.name.trim().charAt(0) || "D").toUpperCase();

  return (
    <article
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      data-el="service-flow.doctor-card"
    >
      <div className="flex items-start gap-3">
        <Avatar className="size-12">
          {doctor.photoUrl ? <AvatarImage src={doctor.photoUrl} alt="" /> : null}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-foreground">{doctor.name}</h3>
          {doctor.title ? (
            <p className="truncate text-sm text-muted-foreground">{doctor.title}</p>
          ) : null}
          {doctor.reviewCount > 0 ? (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="size-3 fill-current text-amber-500" />
              <span>{doctor.ratingAvg.toFixed(1)}</span>
              <span aria-hidden>·</span>
              <span>{t("serviceFlow.explore.reviews", { count: doctor.reviewCount })}</span>
            </div>
          ) : null}
        </div>
      </div>

      {doctor.shortBio ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">{doctor.shortBio}</p>
      ) : null}

      <div className="mt-auto flex justify-end gap-2">
        <GatedActionButton
          kind="interest"
          targetType="doctor"
          targetId={doctor.id}
          label={t("serviceFlow.explore.interest")}
        />
        <GatedActionButton
          kind="save"
          targetType="doctor"
          targetId={doctor.id}
          label={t("serviceFlow.explore.save")}
        />
      </div>
    </article>
  );
}
