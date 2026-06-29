import Link from "next/link";
import type { PublicHospital } from "@/lib/service-api";
import { Rating } from "./rating";

/** Catalog card linking to a hospital page. Used on home + the hospital list. */
export function HospitalCard({ hospital }: { hospital: PublicHospital }) {
  return (
    <Link
      href={`/hospitals/${hospital.slug}`}
      className="border-border-subtle bg-card text-card-foreground hover:border-border-strong flex flex-col gap-2 rounded-xl border p-5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-base font-semibold">{hospital.name}</h3>
        {hospital.isFeatured ? (
          <span className="bg-accent text-accent-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
            추천
          </span>
        ) : null}
      </div>
      {hospital.summary ? (
        <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
          {hospital.summary}
        </p>
      ) : null}
      {hospital.addressLine ? (
        <p className="text-muted-foreground truncate text-xs">{hospital.addressLine}</p>
      ) : null}
      <div className="mt-1">
        <Rating ratingAvg={hospital.ratingAvg} reviewCount={hospital.reviewCount} />
      </div>
    </Link>
  );
}
