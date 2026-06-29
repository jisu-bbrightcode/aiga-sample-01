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
import { Archive, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useModelPricing } from "../hooks/use-model-pricing";

const pricingSchema = z.object({
  modelKey: z.string().min(1).max(120),
  displayName: z.string().min(1).max(200),
  inputWeightPer1kTokens: z.coerce.number().nonnegative(),
  outputWeightPer1kTokens: z.coerce.number().nonnegative(),
});

type PricingFormValues = z.infer<typeof pricingSchema>;
type PricingFormInput = z.input<typeof pricingSchema>;

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Admin catalog page keeps table and dialog wiring together.
export function ModelPricingPage() {
  const { list, upsert, archive } = useModelPricing();
  const [editing, setEditing] = useState<PricingFormInput | null>(null);
  const [open, setOpen] = useState(false);

  const form = useForm<PricingFormInput, unknown, PricingFormValues>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      modelKey: "",
      displayName: "",
      inputWeightPer1kTokens: 0,
      outputWeightPer1kTokens: 0,
    },
  });

  const startCreate = () => {
    setEditing(null);
    form.reset({
      modelKey: "",
      displayName: "",
      inputWeightPer1kTokens: 0,
      outputWeightPer1kTokens: 0,
    });
    setOpen(true);
  };

  const startEdit = (row: {
    modelKey: string;
    displayName: string;
    inputWeightPer1kTokens: string;
    outputWeightPer1kTokens: string;
  }) => {
    const values: PricingFormInput = {
      modelKey: row.modelKey,
      displayName: row.displayName,
      inputWeightPer1kTokens: parseFloat(row.inputWeightPer1kTokens),
      outputWeightPer1kTokens: parseFloat(row.outputWeightPer1kTokens),
    };
    setEditing(values);
    form.reset(values);
    setOpen(true);
  };

  const handleSave = form.handleSubmit(async (values) => {
    try {
      await upsert.mutateAsync(values);
      toast.success("저장되었습니다.");
      setOpen(false);
    } catch {
      toast.error("잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요.");
    }
  });

  const handleArchive = async (id: string, key: string) => {
    if (!confirm(`"${key}" 가격을 archive 하시겠습니까?`)) return;
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
        title="모델 가격 가중치"
        description="모델별 1k 토큰당 input/output 크레딧 비용"
        actions={
          <Button onClick={startCreate}>
            <Plus className="mr-1 size-3.5" />
            모델 추가
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
                <TableHead>모델 키</TableHead>
                <TableHead>표시명</TableHead>
                <TableHead className="text-right">Input/1k</TableHead>
                <TableHead className="text-right">Output/1k</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(list.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.modelKey}</TableCell>
                  <TableCell>{row.displayName}</TableCell>
                  <TableCell className="text-right">{row.inputWeightPer1kTokens}</TableCell>
                  <TableCell className="text-right">{row.outputWeightPer1kTokens}</TableCell>
                  <TableCell>
                    <Badge variant={row.isActive ? "default" : "secondary"}>
                      {row.isActive ? "active" : "archived"}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    {row.isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchive(row.id, row.modelKey)}
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
                    모델 가격이 없습니다.
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
            <DialogTitle>{editing ? "모델 가격 수정" : "모델 추가"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <FormField label="모델 키 (modelKey, 고유)">
              <Input {...form.register("modelKey")} disabled={!!editing} />
            </FormField>
            <FormField label="표시명">
              <Input {...form.register("displayName")} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Input weight / 1k tokens">
                <Input type="number" step="0.0001" {...form.register("inputWeightPer1kTokens")} />
              </FormField>
              <FormField label="Output weight / 1k tokens">
                <Input type="number" step="0.0001" {...form.register("outputWeightPer1kTokens")} />
              </FormField>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending ? "저장 중..." : "저장"}
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
