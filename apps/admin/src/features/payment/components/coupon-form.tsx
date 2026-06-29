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

const couponSchema = z
  .object({
    code: z.string().min(1).max(120),
    type: z.enum(["percent", "amount"]),
    percentOff: z.coerce.number().int().min(1).max(100).optional(),
    amountOffCents: z.coerce.number().int().positive().optional(),
    duration: z.enum(["once", "repeating", "forever"]),
    durationInMonths: z.coerce.number().int().positive().optional(),
    appliesTo: z.enum(["subscription", "top_up", "both"]),
    maxRedemptions: z.coerce.number().int().positive().optional(),
    expiresAt: z.string().optional(),
  })
  .refine(
    (v) =>
      (v.type === "percent" && v.percentOff != null) ||
      (v.type === "amount" && v.amountOffCents != null),
    { message: "type 에 맞는 할인값 필수", path: ["percentOff"] },
  );

export type CouponFormValues = z.infer<typeof couponSchema>;
type CouponFormInput = z.input<typeof couponSchema>;

interface CouponFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CouponFormValues) => Promise<void>;
  isPending: boolean;
}

const DEFAULTS: CouponFormInput = {
  code: "",
  type: "percent",
  percentOff: 10,
  duration: "once",
  appliesTo: "subscription",
};

export function CouponForm({ open, onOpenChange, onSubmit, isPending }: CouponFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
    reset,
  } = useForm<CouponFormInput, unknown, CouponFormValues>({
    resolver: zodResolver(couponSchema),
    defaultValues: DEFAULTS,
  });

  const type = watch("type");
  const duration = watch("duration");

  const submit = handleSubmit(async (values) => {
    await onSubmit(values);
    reset(DEFAULTS);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>쿠폰 만들기</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="쿠폰 코드" error={errors.code?.message}>
            <Input {...register("code")} placeholder="WELCOME10" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="할인 종류">
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">% 할인</SelectItem>
                      <SelectItem value="amount">금액 할인 (cents)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            {type === "percent" ? (
              <Field label="% Off (1~100)" error={errors.percentOff?.message}>
                <Input type="number" {...register("percentOff")} />
              </Field>
            ) : (
              <Field label="Amount Off (cents)" error={errors.amountOffCents?.message}>
                <Input type="number" {...register("amountOffCents")} />
              </Field>
            )}
            <Field label="기간">
              <Controller
                control={control}
                name="duration"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">once</SelectItem>
                      <SelectItem value="repeating">repeating</SelectItem>
                      <SelectItem value="forever">forever</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            {duration === "repeating" ? (
              <Field label="반복 개월수">
                <Input type="number" {...register("durationInMonths")} />
              </Field>
            ) : null}
            <Field label="적용 범위">
              <Controller
                control={control}
                name="appliesTo"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subscription">subscription</SelectItem>
                      <SelectItem value="top_up">top_up</SelectItem>
                      <SelectItem value="both">both</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="최대 사용 횟수">
              <Input type="number" {...register("maxRedemptions")} placeholder="(무제한)" />
            </Field>
          </div>
          <Field label="만료 일시 (ISO)">
            <Input type="datetime-local" {...register("expiresAt")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "생성 중..." : "쿠폰 만들기"}
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
