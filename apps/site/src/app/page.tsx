import { Button } from "@repo/ui/shadcn/button";
import Link from "next/link";
import { DoctorCard } from "@/components/doctor-card";
import { GatedActionButton } from "@/components/gated-action";
import { HospitalCard } from "@/components/hospital-card";
import { siteConfig } from "@/config/site.config";
import { buildMetadata } from "@/lib/seo";
import { listDoctors, listHospitals } from "@/lib/service-api";

export const metadata = buildMetadata({ path: "/" });

export const revalidate = 300;

const VALUE_POINTS = [
  {
    title: "진료과·지역별 큐레이션",
    body: "찾기 어려운 명의와 병원을 진료과와 지역 기준으로 정리해 한눈에 비교합니다.",
  },
  {
    title: "검증된 공개 정보",
    body: "공개된 의사·병원 정보는 그대로 검색·생성형 엔진에 노출되도록 서버에서 렌더링됩니다.",
  },
  {
    title: "로그인 없이 탐색",
    body: "둘러보기는 회원가입 없이. 저장·예약처럼 보호된 동작에서만 로그인 모달이 열립니다.",
  },
];

export default async function HomePage() {
  const [featuredDoctors, featuredHospitals] = await Promise.all([
    listDoctors({ featured: true, limit: 6 }),
    listHospitals({ featured: true, limit: 6 }),
  ]);

  return (
    <div className="flex flex-col gap-16">
      <section className="flex flex-col items-start gap-6 py-6">
        <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">
          {siteConfig.seo.tagline}
        </span>
        <h1 className="text-foreground max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          믿을 수 있는 의사와 병원을 <br className="hidden sm:block" />
          진료과·지역으로 빠르게 찾으세요
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">
          {siteConfig.name}는 진료과와 지역별로 검증된 의사·병원을 큐레이션해 보여주는 의료 정보
          서비스입니다. 회원가입 없이 둘러보고, 저장이나 예약 문의가 필요할 때만 로그인하세요.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" render={<Link href="/doctors" />}>
            의사 둘러보기
          </Button>
          <Button variant="outline" size="lg" render={<Link href="/hospitals" />}>
            병원 둘러보기
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {VALUE_POINTS.map((point) => (
          <div key={point.title} className="border-border-subtle rounded-xl border p-5">
            <h2 className="text-foreground text-base font-semibold">{point.title}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{point.body}</p>
          </div>
        ))}
      </section>

      {featuredDoctors.items.length > 0 ? (
        <section className="flex flex-col gap-5">
          <div className="flex items-end justify-between">
            <h2 className="text-foreground text-2xl font-semibold tracking-tight">추천 의사</h2>
            <Link href="/doctors" className="text-primary text-sm hover:underline">
              전체 보기 →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredDoctors.items.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} />
            ))}
          </div>
        </section>
      ) : null}

      {featuredHospitals.items.length > 0 ? (
        <section className="flex flex-col gap-5">
          <div className="flex items-end justify-between">
            <h2 className="text-foreground text-2xl font-semibold tracking-tight">추천 병원</h2>
            <Link href="/hospitals" className="text-primary text-sm hover:underline">
              전체 보기 →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredHospitals.items.map((hospital) => (
              <HospitalCard key={hospital.id} hospital={hospital} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-border-subtle bg-card flex flex-col items-start gap-4 rounded-2xl border p-8">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          관심 있는 의사·병원을 저장해 보세요
        </h2>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          저장·예약 문의 같은 개인화 기능은 로그인 후 이용할 수 있습니다. 페이지 이동 없이 이
          자리에서 로그인 모달이 열립니다.
        </p>
        <GatedActionButton label="내 목록에 저장하기" size="lg" />
      </section>
    </div>
  );
}
