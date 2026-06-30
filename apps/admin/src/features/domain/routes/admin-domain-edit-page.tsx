import { Button } from "@repo/ui/shadcn/button";
import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useDomainResourceDetail } from "../hooks/use-domain-resource-detail";
import { DomainEditForm } from "../pages/domain-edit-form";
import type { DomainResourceType } from "../types";

function StateMessage({ children }: { children: React.ReactNode }) {
  return <div className="py-12 text-center text-muted-foreground">{children}</div>;
}

/**
 * Admin Domain Resource Edit Page — `/domain/$type/$id/edit`.
 *
 * 핵심 도메인 리소스(의사/병원)의 공개·운영 필드를 수정하는 화면. 현재 값을 불러와
 * 폼을 채우고, 저장 시 서버에서 감사 로그에 기록된다. 상태(공개/비공개) 변경은 상세
 * 화면의 상태 변경 액션에서 처리한다. PB-ADMIN-DOMAIN-UPDATE-001 / BBR-681.
 */
export function AdminDomainEditPage() {
  const { type, id } = useParams({ strict: false }) as { type?: string; id?: string };

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
      return <DomainEditForm detail={data} />;
    }
    return <StateMessage>리소스를 찾을 수 없습니다.</StateMessage>;
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Button
        render={<Link to="/domain/$type/$id" params={{ type: type ?? "doctor", id: id ?? "" }} />}
        variant="ghost"
        size="sm"
        className="w-fit"
      >
        <ArrowLeft className="mr-2 size-3.5" />
        상세로
      </Button>
      <div>
        <h1 className="text-3xl font-bold">도메인 리소스 수정</h1>
        <p className="text-muted-foreground">의사·병원 카탈로그 레코드를 수정합니다</p>
      </div>
      {renderContent()}
    </div>
  );
}
