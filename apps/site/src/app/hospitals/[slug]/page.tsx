import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DoctorCard } from "@/components/doctor-card";
import { GatedActionButton } from "@/components/gated-action";
import { Rating } from "@/components/rating";
import { breadcrumbJsonLd, JsonLd, medicalClinicJsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import { getHospital } from "@/lib/service-api";

export const revalidate = 300;

interface HospitalDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: HospitalDetailPageProps) {
  const { slug } = await params;
  const hospital = await getHospital(slug);
  if (!hospital) {
    return buildMetadata({
      title: "병원을 찾을 수 없음",
      path: `/hospitals/${slug}`,
      noIndex: true,
    });
  }
  return buildMetadata({
    title: hospital.name,
    description:
      hospital.summary ??
      `${hospital.name}${hospital.region ? ` (${hospital.region.name})` : ""} 정보 — 위치·연락처·소속 의사를 확인하세요.`,
    path: `/hospitals/${hospital.slug}`,
  });
}

export default async function HospitalDetailPage({ params }: HospitalDetailPageProps) {
  const { slug } = await params;
  const hospital = await getHospital(slug);
  if (!hospital) notFound();

  const crumbs = [
    { name: "홈", path: "/" },
    { name: "병원 찾기", path: "/hospitals" },
    { name: hospital.name, path: `/hospitals/${hospital.slug}` },
  ];

  return (
    <article className="flex flex-col gap-8">
      <JsonLd data={[breadcrumbJsonLd(crumbs), medicalClinicJsonLd(hospital)]} />
      <Breadcrumbs crumbs={crumbs} />

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">{hospital.name}</h1>
          {hospital.isFeatured ? (
            <span className="bg-accent text-accent-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              추천 병원
            </span>
          ) : null}
        </div>
        {hospital.summary ? (
          <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">
            {hospital.summary}
          </p>
        ) : null}
        <Rating ratingAvg={hospital.ratingAvg} reviewCount={hospital.reviewCount} />
      </header>

      <section className="border-border-subtle grid gap-3 rounded-xl border p-5 sm:grid-cols-2">
        {hospital.region ? <InfoRow label="지역" value={hospital.region.name} /> : null}
        {hospital.addressLine ? <InfoRow label="주소" value={hospital.addressLine} /> : null}
        {hospital.phone ? <InfoRow label="전화" value={hospital.phone} /> : null}
        {hospital.websiteUrl ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">웹사이트</span>
            <a
              href={hospital.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-sm hover:underline"
            >
              {hospital.websiteUrl}
            </a>
          </div>
        ) : null}
      </section>

      {hospital.description ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-foreground text-sm font-semibold">병원 소개</h2>
          <p className="text-muted-foreground max-w-2xl whitespace-pre-line leading-relaxed">
            {hospital.description}
          </p>
        </section>
      ) : null}

      {hospital.doctors.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-foreground text-sm font-semibold">소속 의사</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hospital.doctors.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-border-subtle bg-card flex flex-col items-start gap-3 rounded-2xl border p-6">
        <h2 className="text-foreground text-lg font-semibold">이 병원을 저장하시겠어요?</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          저장·예약 문의는 로그인 후 이용할 수 있습니다. 로그인은 페이지 이동 없이 모달로
          진행됩니다.
        </p>
        <div className="flex flex-wrap gap-2">
          <GatedActionButton
            label="내 목록에 저장"
            authedMessage={`${hospital.name} 저장됨 (데모)`}
          />
          <Link href="/hospitals" className="text-primary self-center text-sm hover:underline">
            다른 병원 더 보기 →
          </Link>
        </div>
      </section>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-foreground text-sm">{value}</span>
    </div>
  );
}
