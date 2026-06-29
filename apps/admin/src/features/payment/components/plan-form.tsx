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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const planSchema = z.object({
  slug: z.string().min(1, "slug 필수").max(120),
  name: z.string().min(1, "이름 필수").max(200),
  cycle: z.enum(["lifetime", "monthly", "yearly"]),
  priceCents: z.coerce.number().int().min(0),
  currency: z.string().length(3),
  includedCreditsPerCycle: z.coerce.number().int().min(0),
  seats: z.coerce.number().int().min(1),
  trialDays: z.coerce.number().int().min(0),
  polarProductId: z.string().optional(),
  polarPriceId: z.string().optional(),
});

export type PlanFormValues = z.infer<typeof planSchema>;
type PlanFormInput = z.input<typeof planSchema>;

interface PlanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<PlanFormInput>;
  onSubmit: (values: PlanFormValues) => Promise<void>;
  isPending: boolean;
  title?: string;
}

const DEFAULTS: PlanFormInput = {
  slug: "",
  name: "",
  cycle: "monthly",
  priceCents: 0,
  currency: "USD",
  includedCreditsPerCycle: 0,
  seats: 1,
  trialDays: 0,
  polarProductId: "",
  polarPriceId: "",
};

export function PlanForm({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  isPending,
  title = "플랜 추가",
}: PlanFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<PlanFormInput, unknown, PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { ...DEFAULTS, ...defaultValues },
  });

  const submit = handleSubmit(async (values) => {
    await onSubmit(values);
    reset(DEFAULTS);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Slug" error={errors.slug?.message}>
              <Input {...register("slug")} placeholder="pro-monthly" />
            </Field>
            <Field label="이름" error={errors.name?.message}>
              <Input {...register("name")} placeholder="Pro" />
            </Field>
            <Field label="결제 주기">
              <Controller
                control={control}
                name="cycle"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">monthly</SelectItem>
                      <SelectItem value="yearly">yearly</SelectItem>
                      <SelectItem value="lifetime">lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="통화 (3-letter)">
              <Input {...register("currency")} placeholder="USD" />
            </Field>
            <Field label="가격 (cents)">
              <Input type="number" {...register("priceCents")} />
            </Field>
            <Field label="주기당 포함 크레딧">
              <Input type="number" {...register("includedCreditsPerCycle")} />
            </Field>
            <Field label="시트 수">
              <Input type="number" {...register("seats")} />
            </Field>
            <Field label="체험 일수">
              <Input type="number" {...register("trialDays")} />
            </Field>
            <Field label="Polar Product ID">
              <Input {...register("polarProductId")} />
            </Field>
            <Field label="Polar Price ID">
              <Input {...register("polarPriceId")} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
