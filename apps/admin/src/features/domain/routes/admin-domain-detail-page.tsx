import { Button } from "@repo/ui/shadcn/button";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useDomainResourceDetail } from "../hooks/use-domain-resource-detail";
import { DomainDetail } from "../pages/domain-detail";
import type { DomainResourceType } from "../types";

function StateMessage({ children }: { children: React.ReactNode }) {
  return <div className="py-12 text-center text-muted-foreground">{children}</div>;
}

/**
 * Admin Domain Resource Detail Page — `/domain/$type/$id`.
 *
 * 핵심 도메인 리소스(의사/병원)의 상세·운영 상태·관련 정보를 운영자가 조회하는
 * 화면. 민감 식별번호는 마스킹되어 표시된다. PB-ADMIN-DOMAIN-READ-001 / BBR-679.
 */
export function AdminDomainDetailPage() {
  const { type, id } = useParams({ strict: false }) as { type?: string; id?: string };

  // The route param is free-form; only accept the two known resource types.
  const resourceType: DomainResourceType | undefined =
    type === "doctor" || type === "hospital" ? type : undefined;

  const { data, isLoading, isError, error, refetch } = useDomainResourceDetail(resourceType, id);

  function renderContent() {
    if (!resourceType) {
      return <StateMessage>잘못된 리소스 유형입니다.</StateMessage>;
    }
    if (isLoading) {
      return <StateMessage>로딩 중...</StateMessage>;
    }
    if (isError) {
      return (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="text-destructive">
            {error instanceof Error ? error.message : "상세 정보를 불러오지 못했습니다."}
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            다시 시도
          </Button>
        </div>
      );
    }
    if (data) {
      return <DomainDetail detail={data} />;
    }
    return <StateMessage>리소스를 찾을 수 없습니다.</StateMessage>;
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <Button render={<Link to="/domain" />} variant="ghost" size="sm" className="w-fit">
        <ArrowLeft className="mr-2 size-3.5" />
        목록으로
      </Button>
      {renderContent()}
    </div>
  );
}
