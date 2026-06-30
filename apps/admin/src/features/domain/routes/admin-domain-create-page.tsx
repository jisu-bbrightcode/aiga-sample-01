import { Button } from "@repo/ui/shadcn/button";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { DomainCreateForm } from "../pages/domain-create-form";

/**
 * Admin Domain Resource Create Page — `/domain/new`.
 *
 * 핵심 도메인 리소스(의사/병원)를 생성하는 화면. 공개 정보와 운영 정보를 분리된
 * 섹션으로 입력받아 각각 검증하고, 기본 draft 상태로 저장한다.
 * PB-ADMIN-DOMAIN-CREATE-001 / BBR-680.
 */
export function AdminDomainCreatePage() {
  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Button render={<Link to="/domain" />} variant="ghost" size="sm" className="w-fit">
        <ArrowLeft className="mr-2 size-3.5" />
        목록으로
      </Button>
      <div>
        <h1 className="text-3xl font-bold">도메인 리소스 생성</h1>
        <p className="text-muted-foreground">의사·병원 카탈로그 레코드를 생성합니다</p>
      </div>
      <DomainCreateForm />
    </div>
  );
}
