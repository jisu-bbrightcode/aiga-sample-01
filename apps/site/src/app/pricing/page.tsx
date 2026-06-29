import { Button } from "@repo/ui/shadcn/button";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { GatedActionButton } from "@/components/gated-action";
import { siteConfig } from "@/config/site.config";
import { breadcrumbJsonLd, JsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "이용 안내",
  description:
    "AIGA는 누구나 무료로 의사·병원을 탐색할 수 있습니다. 저장·예약·개인화 같은 기능은 로그인 후 이용하세요.",
  path: "/pricing",
});

const CRUMBS = [
  { name: "홈", path: "/" },
  { name: "이용 안내", path: "/pricing" },
];

interface Plan {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "둘러보기",
    price: "무료",
    description: "회원가입 없이 모든 공개 정보를 탐색합니다.",
    features: ["의사·병원 검색", "진료과·지역별 큐레이션", "프로필 상세 보기"],
  },
  {
    name: "회원",
    price: "무료 가입",
    description: "로그인하면 개인화 기능이 열립니다.",
    features: ["관심 의사·병원 저장", "예약 문의", "맞춤 추천", "검색 기록"],
    highlighted: true,
  },
];

export default function PricingPage() {
  return (
    <div className="flex flex-col gap-10">
      <JsonLd data={breadcrumbJsonLd(CRUMBS)} />
      <div className="flex flex-col gap-3">
        <Breadcrumbs crumbs={CRUMBS} />
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">이용 안내</h1>
        <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">
          {siteConfig.name}의 공개 정보는 누구나 무료로 탐색할 수 있습니다. 저장·예약·개인화 기능은
          무료 회원가입 후 이용하세요.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`flex flex-col gap-4 rounded-2xl border p-6 ${
              plan.highlighted ? "border-primary bg-card" : "border-border-subtle"
            }`}
          >
            <div className="flex flex-col gap-1">
              <span className="text-foreground text-lg font-semibold">{plan.name}</span>
              <span className="text-foreground text-3xl font-bold tracking-tight">
                {plan.price}
              </span>
              <span className="text-muted-foreground text-sm">{plan.description}</span>
            </div>
            <ul className="flex flex-col gap-2">
              {plan.features.map((feature) => (
                <li key={feature} className="text-muted-foreground flex items-center gap-2 text-sm">
                  <span className="text-primary" aria-hidden>
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-2">
              {plan.highlighted ? (
                <GatedActionButton
                  label="무료로 시작하기"
                  size="lg"
                  className="w-full"
                  authedMessage="이미 로그인되어 있어요 — 개인화 기능을 사용할 수 있습니다."
                />
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  render={<Link href="/doctors" />}
                >
                  바로 둘러보기
                </Button>
              )}
            </div>
          </div>
        ))}
      </section>

      <p className="text-muted-foreground text-sm">
        로그인이 필요한 동작은 로그인 페이지로 이동하지 않고, 현재 페이지에서 모달로 진행됩니다.
      </p>
    </div>
  );
}
