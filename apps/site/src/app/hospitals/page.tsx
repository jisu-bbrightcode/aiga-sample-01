import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { HospitalCard } from "@/components/hospital-card";
import { breadcrumbJsonLd, itemListJsonLd, JsonLd } from "@/lib/json-ld";
import { buildMetadata } from "@/lib/seo";
import { listHospitals } from "@/lib/service-api";

const PAGE_SIZE = 12;

export const metadata = buildMetadata({
  title: "병원 찾기",
  description:
    "지역별로 검증된 병원을 찾아보세요. 회원가입 없이 병원 정보와 소속 의사를 탐색할 수 있습니다.",
  path: "/hospitals",
});

export const revalidate = 300;

const CRUMBS = [
  { name: "홈", path: "/" },
  { name: "병원 찾기", path: "/hospitals" },
];

interface HospitalsPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function HospitalsPage({ searchParams }: HospitalsPageProps) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const result = await listHospitals({ q, page, limit: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const hasResults = result.items.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <JsonLd
        data={[
          breadcrumbJsonLd(CRUMBS),
          itemListJsonLd(
            result.items.map((hospital) => ({
              name: hospital.name,
              path: `/hospitals/${hospital.slug}`,
            })),
          ),
        ]}
      />
      <div className="flex flex-col gap-3">
        <Breadcrumbs crumbs={CRUMBS} />
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">병원 찾기</h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          이름이나 키워드로 검증된 병원을 검색하세요. 병원 정보는 로그인 없이 확인할 수 있습니다.
        </p>
      </div>

      <form action="/hospitals" method="get" className="flex max-w-xl gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="병원 이름·키워드 검색"
          aria-label="병원 검색"
          className="h-10"
        />
        <Button type="submit" className="h-10 shrink-0">
          검색
        </Button>
      </form>

      {hasResults ? (
        <>
          <p className="text-muted-foreground text-sm">
            총 {result.total.toLocaleString()}곳{q ? ` · “${q}” 검색 결과` : ""}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((hospital) => (
              <HospitalCard key={hospital.id} hospital={hospital} />
            ))}
          </div>
          <Pagination basePath="/hospitals" q={q} page={page} totalPages={totalPages} />
        </>
      ) : (
        <EmptyState
          title={q ? `“${q}”에 해당하는 병원이 없습니다.` : "표시할 병원이 아직 없습니다."}
          hint="다른 키워드로 다시 검색해 보세요."
        />
      )}
    </div>
  );
}

function Pagination({
  basePath,
  q,
  page,
  totalPages,
}: {
  basePath: string;
  q?: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const buildHref = (target: number) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <nav aria-label="pagination" className="flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={buildHref(page - 1)} className="text-primary hover:underline">
          ← 이전
        </Link>
      ) : (
        <span className="text-muted-foreground">← 이전</span>
      )}
      <span className="text-muted-foreground">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={buildHref(page + 1)} className="text-primary hover:underline">
          다음 →
        </Link>
      ) : (
        <span className="text-muted-foreground">다음 →</span>
      )}
    </nav>
  );
}
