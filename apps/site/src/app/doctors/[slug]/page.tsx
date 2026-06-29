import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GatedActionButton } from "@/components/gated-action";
import { Rating } from "@/components/rating";
import { breadcrumbJsonLd, JsonLd, physicianJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import { getDoctor } from "@/lib/service-api";

export const revalidate = 300;

interface DoctorDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DoctorDetailPageProps) {
  const { slug } = await params;
  const doctor = await getDoctor(slug);
  if (!doctor) {
    return buildMetadata({ title: "의사를 찾을 수 없음", path: `/doctors/${slug}`, noIndex: true });
  }
  const specialty = doctor.specialties[0]?.name;
  const descriptor = [doctor.title, specialty].filter(Boolean).join(" · ");
  return buildMetadata({
    title: doctor.name,
    description:
      doctor.shortBio ??
      `${doctor.name}${descriptor ? ` (${descriptor})` : ""} 프로필 — 진료과·소속 병원·경력 정보를 확인하세요.`,
    path: `/doctors/${doctor.slug}`,
    type: "profile",
  });
}

export default async function DoctorDetailPage({ params }: DoctorDetailPageProps) {
  const { slug } = await params;
  const doctor = await getDoctor(slug);
  if (!doctor) notFound();

  const crumbs = [
    { name: "홈", path: "/" },
    { name: "의사 찾기", path: "/doctors" },
    { name: doctor.name, path: `/doctors/${doctor.slug}` },
  ];

  return (
    <article className="flex flex-col gap-8">
      <JsonLd data={[breadcrumbJsonLd(crumbs), physicianJsonLd(doctor)]} />
      <Breadcrumbs crumbs={crumbs} />

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">{doctor.name}</h1>
          {doctor.isFeatured ? (
            <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              추천 의사
            </span>
          ) : null}
        </div>
        {doctor.title ? <p className="text-muted-foreground text-lg">{doctor.title}</p> : null}
        <div className="flex flex-wrap items-center gap-4">
          <Rating ratingAvg={doctor.ratingAvg} reviewCount={doctor.reviewCount} />
          {typeof doctor.yearsExperience === "number" ? (
            <span className="text-muted-foreground text-sm">경력 {doctor.yearsExperience}년</span>
          ) : null}
          {doctor.region ? (
            <span className="text-muted-foreground text-sm">{doctor.region.name}</span>
          ) : null}
        </div>
      </header>

      {doctor.specialties.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-foreground text-sm font-semibold">진료과</h2>
          <div className="flex flex-wrap gap-2">
            {doctor.specialties.map((specialty) => (
              <span
                key={specialty.id}
                className="border-border-subtle text-muted-foreground rounded-full border px-3 py-1 text-sm"
              >
                {specialty.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {(doctor.biography ?? doctor.shortBio) ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-foreground text-sm font-semibold">의사 소개</h2>
          <p className="text-muted-foreground max-w-2xl whitespace-pre-line leading-relaxed">
            {doctor.biography ?? doctor.shortBio}
          </p>
        </section>
      ) : null}

      {doctor.hospitals.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-foreground text-sm font-semibold">소속 병원</h2>
          <ul className="flex flex-col gap-2">
            {doctor.hospitals.map(({ hospital, role, isPrimary }) => (
              <li key={hospital.id}>
                <Link
                  href={`/hospitals/${hospital.slug}`}
                  className="border-border-subtle bg-card hover:border-border-strong flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors"
                >
                  <span className="text-foreground font-medium">{hospital.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {[isPrimary ? "대표" : null, role].filter(Boolean).join(" · ") || "보기 →"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-border-subtle bg-card flex flex-col items-start gap-3 rounded-2xl border p-6">
        <h2 className="text-foreground text-lg font-semibold">이 의사를 저장하시겠어요?</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          저장·예약 문의는 로그인 후 이용할 수 있습니다. 로그인은 페이지 이동 없이 모달로
          진행됩니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <GatedActionButton
            label="내 목록에 저장"
            authedMessage={`${doctor.name} 저장됨 (데모)`}
          />
          <GatedActionButton
            label="예약 문의"
            variant="outline"
            authedMessage={`${doctor.name} 예약 문의 (데모)`}
          />
        </div>
      </section>
    </article>
  );
}
