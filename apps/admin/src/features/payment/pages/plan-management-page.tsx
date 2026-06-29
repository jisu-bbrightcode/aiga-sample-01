import { PageHeader } from "@repo/ui/components/page-header";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/shadcn/table";
import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PlanForm, type PlanFormValues } from "../components/plan-form";
import { usePlanManagement } from "../hooks/use-plan-management";

export function PlanManagementPage() {
  const { list, create, archive } = usePlanManagement();
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreate = async (values: PlanFormValues) => {
    try {
      await create.mutateAsync({
        ...values,
        polarProductId: values.polarProductId || undefined,
        polarPriceId: values.polarPriceId || undefined,
      });
      toast.success("플랜을 추가했습니다.");
      setCreateOpen(false);
    } catch {
      toast.error("잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요.");
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`"${name}" 플랜을 archive 하시겠습니까?`)) return;
    try {
      await archive.mutateAsync({ id });
      toast.success("아카이브 완료");
    } catch {
      toast.error("잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요.");
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-8">
      <PageHeader
        title="플랜 카탈로그"
        description="유료 플랜 정의 (Polar product/price ID 매핑 포함)"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-3.5" />
            플랜 추가
          </Button>
        }
      />

      {list.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slug</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>주기</TableHead>
                <TableHead className="text-right">가격</TableHead>
                <TableHead className="text-right">크레딧/주기</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-mono text-xs">{plan.slug}</TableCell>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>{plan.cycle}</TableCell>
                  <TableCell className="text-right">
                    ${(plan.priceCents / 100).toLocaleString()} {plan.currency}
                  </TableCell>
                  <TableCell className="text-right">
                    {plan.includedCreditsPerCycle.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.isActive ? "default" : "secondary"}>
                      {plan.isActive ? "active" : "archived"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {plan.isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchive(plan.id, plan.name)}
                      >
                        <Archive className="size-3.5" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {list.data && list.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    플랜이 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}

      <PlanForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isPending={create.isPending}
      />
    </div>
  );
}
