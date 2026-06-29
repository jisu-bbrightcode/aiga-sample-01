import { Button } from "@repo/ui/shadcn/button";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { siteConfig } from "@/config/site.config";
import { breadcrumbJsonLd, JsonLd } from "@/lib/json-ld";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "서비스 소개",
  description:
    "AIGA는 진료과·지역별로 검증된 의사와 병원을 큐레이션해, 환자가 신뢰할 수 있는 의료 정보를 쉽게 찾도록 돕습니다.",
  path: "/about",
});

const CRUMBS = [
  { name: "홈", path: "/" },
  { name: "서비스 소개", path: "/about" },
];

const PRINCIPLES = [
  {
    title: "검증 우선",
    body: "공개되는 의사·병원 정보는 편집 검수를 거쳐 게시(published)된 항목만 노출합니다.",
  },
  {
    title: "탐색은 열려 있게",
    body: "검색 유입과 접근성을 위해 모든 공개 페이지는 로그인 없이 탐색할 수 있습니다.",
  },
  {
    title: "개인화는 동의 기반",
    body: "저장·예약·개인화는 로그인한 사용자만, 페이지 이동 없는 모달로 자연스럽게 시작합니다.",
  },
];

export default function AboutPage() {
  const aboutPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: `${siteConfig.name} 서비스 소개`,
    url: absoluteUrl("/about"),
    description: siteConfig.seo.description,
    about: { "@id": `${absoluteUrl("/")}#organization` },
  };

  return (
    <div className="flex flex-col gap-10">
      <JsonLd data={[breadcrumbJsonLd(CRUMBS), aboutPageJsonLd]} />
      <div className="flex flex-col gap-3">
        <Breadcrumbs crumbs={CRUMBS} />
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">
          {siteConfig.name} 서비스 소개
        </h1>
        <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">
          {siteConfig.name}는 흩어져 있는 의료 정보를 진료과·지역 기준으로 큐레이션해, 환자가 믿을
          수 있는 의사와 병원을 빠르게 찾을 수 있도록 돕습니다.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">우리가 일하는 방식</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {PRINCIPLES.map((principle) => (
            <div key={principle.title} className="border-border-subtle rounded-xl border p-5">
              <h3 className="text-foreground text-base font-semibold">{principle.title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{principle.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-border-subtle bg-card flex flex-col items-start gap-4 rounded-2xl border p-8">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">지금 둘러보세요</h2>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          회원가입 없이 의사와 병원을 탐색할 수 있습니다. 마음에 드는 곳을 저장하려면 그때
          로그인하세요.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" render={<Link href="/doctors" />}>
            의사 둘러보기
          </Button>
          <Button variant="outline" size="lg" render={<Link href="/hospitals" />}>
            병원 둘러보기
          </Button>
        </div>
      </section>
    </div>
  );
}
