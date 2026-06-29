import Link from "next/link";
import type { PublicDoctor } from "@/lib/service-api";
import { Rating } from "./rating";

/** Catalog card linking to a doctor profile. Used on home + the doctor list. */
export function DoctorCard({ doctor }: { doctor: PublicDoctor }) {
  return (
    <Link
      href={`/doctors/${doctor.slug}`}
      className="border-border-subtle bg-card text-card-foreground hover:border-border-strong flex flex-col gap-2 rounded-xl border p-5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{doctor.name}</h3>
          {doctor.title ? (
            <p className="text-muted-foreground truncate text-sm">{doctor.title}</p>
          ) : null}
        </div>
        {doctor.isFeatured ? (
          <span className="bg-accent text-accent-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
            추천
          </span>
        ) : null}
      </div>
      {doctor.shortBio ? (
        <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
          {doctor.shortBio}
        </p>
      ) : null}
      <div className="mt-1 flex items-center justify-between">
        <Rating ratingAvg={doctor.ratingAvg} reviewCount={doctor.reviewCount} />
        {typeof doctor.yearsExperience === "number" ? (
          <span className="text-muted-foreground text-xs">경력 {doctor.yearsExperience}년</span>
        ) : null}
      </div>
    </Link>
  );
}
