import { PageHeader } from "@repo/ui/components/page-header";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/shadcn/dialog";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/shadcn/table";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useTopUpManagement } from "../hooks/use-top-up-management";

const topUpSchema = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  credits: z.coerce.number().int().positive(),
  priceCents: z.coerce.number().int().positive(),
  currency: z.string().length(3).default("USD"),
  polarProductId: z.string().min(1),
  polarPriceId: z.string().min(1),
});

type TopUpFormValues = z.infer<typeof topUpSchema>;
type TopUpFormInput = z.input<typeof topUpSchema>;

export function TopUpManagementPage() {
  const { list, create, archive } = useTopUpManagement();
  const [open, setOpen] = useState(false);

  const form = useForm<TopUpFormInput, unknown, TopUpFormValues>({
    resolver: zodResolver(topUpSchema),
    defaultValues: {
      slug: "",
      name: "",
      credits: 0,
      priceCents: 0,
      currency: "USD",
      polarProductId: "",
      polarPriceId: "",
    },
  });

  const handleCreate = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values);
      toast.success("Top-up 패키지를 추가했습니다.");
      form.reset();
      setOpen(false);
    } catch {
      toast.error("잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요.");
    }
  });

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`"${name}" 패키지를 archive 하시겠습니까?`)) return;
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
        title="Top-up SKU"
        description="크레딧 일회성 구매 패키지"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 size-3.5" />
            패키지 추가
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
                <TableHead className="text-right">크레딧</TableHead>
                <TableHead className="text-right">가격</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-mono text-xs">{pkg.slug}</TableCell>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell className="text-right">{pkg.credits.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    ${(pkg.priceCents / 100).toLocaleString()} {pkg.currency}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pkg.isActive ? "default" : "secondary"}>
                      {pkg.isActive ? "active" : "archived"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {pkg.isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchive(pkg.id, pkg.name)}
                      >
                        <Archive className="size-3.5" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {list.data && list.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    패키지가 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top-up 패키지 추가</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <FormField label="Slug">
              <Input {...form.register("slug")} />
            </FormField>
            <FormField label="이름">
              <Input {...form.register("name")} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="크레딧">
                <Input type="number" {...form.register("credits")} />
              </FormField>
              <FormField label="가격 (cents)">
                <Input type="number" {...form.register("priceCents")} />
              </FormField>
              <FormField label="통화">
                <Input {...form.register("currency")} />
              </FormField>
              <FormField label="Polar Product ID">
                <Input {...form.register("polarProductId")} />
              </FormField>
              <FormField label="Polar Price ID">
                <Input {...form.register("polarPriceId")} />
              </FormField>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "저장 중..." : "추가"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
