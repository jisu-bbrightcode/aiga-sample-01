/**
 * /settings/billing — settings shell that consumes existing payment hooks
 * (Iron Law 1: features/payment 미접촉 — 데이터만 hooks 로 가져온다).
 * 표현은 SettingItem 패턴으로 통일.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { DataTable, Pill, SettingItem } from "@repo/ui/settings";
import { Button, buttonVariants } from "@repo/ui/shadcn/button";
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useCreditBalance } from "@/features/payment/hooks/use-credits";
import {
  useExtraUsageSettings,
  useUsageStats as useExtraUsageStats,
  useUpdateExtraUsageSettings,
} from "@/features/payment/hooks/use-extra-usage";
import { useMyInvoices } from "@/features/payment/hooks/use-invoices";
import { useMySubscription } from "@/features/payment/hooks/use-my-subscription";
import { usePlans } from "@/features/payment/hooks/use-plans";
import { useUsageStats } from "@/features/payment/hooks/use-usage";
import { SettingPageLayout } from "../_shared/SettingPageLayout";

interface InvoiceRow {
  id: string;
  date: string | Date;
  description: string;
  totalCents: number;
  currency: string;
  status: string;
  pdfUrl?: string | null;
}

interface UsageModelRow {
  model: string;
  credits: number;
  calls: number;
}

function formatCurrency(cents: number, currency: string): string {
  if (currency === "KRW") return `₩${(cents / 100).toLocaleString("ko-KR")}`;
  return `US$${(cents / 100).toFixed(2)}`;
}

function formatDate(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

function cycleLabel(t: (key: string) => string, cycle: string | undefined): string {
  if (cycle === "monthly") return t("billing.cycle.monthly");
  if (cycle === "yearly") return t("billing.cycle.yearly");
  return t("billing.cycle.lifetime");
}

function PlanItem() {
  const sub = useMySubscription();
  const plans = usePlans();
  const { t } = useFeatureTranslation("page.settings");
  const subPlanId = (sub.data as { planId?: string } | null | undefined)?.planId;
  const plan = plans.data?.find((p) => p.id === subPlanId);
  const periodEnd = sub.data?.currentPeriodEnd ? formatDate(sub.data.currentPeriodEnd) : null;

  const planLabel = plan?.name ?? t("billing.plan.free");
  const priceLine = plan
    ? `${formatCurrency(plan.priceCents ?? 0, plan.currency ?? "USD")}/${cycleLabel(t, plan.cycle)}${
        plan.includedCreditsPerCycle
          ? ` · ${t("billing.plan.includedCredits", { amount: plan.includedCreditsPerCycle.toLocaleString() })}`
          : ""
      }`
    : t("billing.plan.freeDescription");
  const renewLine = periodEnd
    ? sub.data?.cancelAtPeriodEnd
      ? t("billing.plan.endsOn", { date: periodEnd })
      : t("billing.plan.renewsOn", { date: periodEnd })
    : null;

  return (
    <SettingItem
      title={t("billing.plan.title", { plan: planLabel })}
      description={renewLine ? `${priceLine} · ${renewLine}` : priceLine}
    >
      <Link
        to="/billing/upgrade"
        className={buttonVariants({ variant: "outline", size: "default" })}
      >
        {t("billing.plan.adjust")}
      </Link>
    </SettingItem>
  );
}

function CreditBalanceItem() {
  const balance = useCreditBalance();
  const { t } = useFeatureTranslation("page.settings");
  const value = balance.data?.balance ?? 0;
  return (
    <SettingItem title={t("billing.credit.title")} description={t("billing.credit.description")}>
      <div className="text-2xl font-semibold tracking-tight">
        {value.toLocaleString()}{" "}
        <span className="text-sm font-normal text-muted-foreground">
          {t("billing.credit.suffix")}
        </span>
      </div>
    </SettingItem>
  );
}

function UsageItem() {
  const stats = useExtraUsageStats();
  const settings = useExtraUsageSettings();
  const { t } = useFeatureTranslation("page.settings");
  const accumulated = stats.data?.accumulatedCents ?? 0;
  const limit = settings.data?.monthlyLimitCents ?? 0;
  const cycleEnd = stats.data?.cycleEnd ? formatDate(stats.data.cycleEnd) : null;
  const ratio = limit > 0 ? Math.min(100, Math.round((accumulated / limit) * 100)) : 0;

  return (
    <SettingItem
      title={t("billing.usage.title")}
      description={
        cycleEnd
          ? t("billing.usage.cycleEnd", { date: cycleEnd })
          : t("billing.usage.fallbackDescription")
      }
    >
      <div className="space-y-2">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${ratio}%` }}
          />
        </div>
        <div className="text-sm">
          <span className="font-medium">
            {formatCurrency(accumulated, stats.data?.currency ?? "USD")}
          </span>
          {limit > 0 ? (
            <>
              <span className="text-muted-foreground"> / </span>
              <span>{formatCurrency(limit, stats.data?.currency ?? "USD")}</span>
              <span className="text-muted-foreground"> ({ratio}%)</span>
            </>
          ) : (
            <span className="text-muted-foreground"> {t("billing.usage.suffix")}</span>
          )}
        </div>
      </div>
    </SettingItem>
  );
}

function usageColumns(t: (key: string) => string): ColumnDef<UsageModelRow, unknown>[] {
  return [
    {
      id: "model",
      header: t("billing.usageByModel.column.model"),
      cell: ({ row }) => row.original.model,
    },
    {
      id: "credits",
      header: t("billing.usageByModel.column.credits"),
      size: 110,
      cell: ({ row }) => row.original.credits.toLocaleString(),
    },
    {
      id: "calls",
      header: t("billing.usageByModel.column.calls"),
      size: 90,
      cell: ({ row }) => row.original.calls.toLocaleString(),
    },
  ];
}

function UsageByModelItem() {
  const usage = useUsageStats(30);
  const { t } = useFeatureTranslation("page.settings");
  const columns = useMemo(() => usageColumns(t), [t]);
  const rows: UsageModelRow[] = usage.data?.byModel
    ? Object.entries(usage.data.byModel).map(([model, v]) => ({
        model,
        credits: v.credits,
        calls: v.calls,
      }))
    : [];
  return (
    <SettingItem
      title={t("billing.usageByModel.title")}
      description={t("billing.usageByModel.description")}
    >
      <DataTable<UsageModelRow>
        columns={columns}
        data={rows}
        maxHeight={400}
        empty={t("billing.usageByModel.empty")}
      />
    </SettingItem>
  );
}

function PaymentMethodItem() {
  const { t } = useFeatureTranslation("page.settings");
  return (
    <SettingItem
      title={t("billing.paymentMethod.title")}
      description={t("billing.paymentMethod.description")}
    >
      <Link
        to="/billing/upgrade"
        className={buttonVariants({ variant: "outline", size: "default" })}
      >
        {t("billing.paymentMethod.update")}
      </Link>
    </SettingItem>
  );
}

function ExtraUsageBalanceItem() {
  const stats = useExtraUsageStats();
  const { t } = useFeatureTranslation("page.settings");
  const balance = stats.data
    ? formatCurrency(stats.data.paidBalanceCents, stats.data.currency)
    : "US$0.00";
  return (
    <SettingItem
      title={t("billing.extraUsage.title")}
      description={t("billing.extraUsage.description")}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="text-2xl font-semibold tracking-tight">{balance}</div>
        <div className="flex items-center gap-2">
          <Pill tone="info">{t("billing.extraUsage.discount")}</Pill>
          <Link
            to="/billing/upgrade"
            className={buttonVariants({ variant: "outline", size: "default" })}
          >
            {t("billing.extraUsage.buyMore")}
          </Link>
        </div>
      </div>
    </SettingItem>
  );
}

function AutoRechargeItem() {
  const settings = useExtraUsageSettings();
  const update = useUpdateExtraUsageSettings();
  const { t } = useFeatureTranslation("page.settings");
  const autoOn = settings.data?.autoRechargeEnabled ?? false;
  const ready = !!settings.data;
  return (
    <SettingItem
      title={t("billing.autoRecharge.title")}
      description={t("billing.autoRecharge.description")}
    >
      <Button
        type="button"
        variant="outline"
        disabled={update.isPending || !ready}
        onClick={() => update.mutate({ autoRechargeEnabled: !autoOn })}
      >
        {autoOn ? t("billing.autoRecharge.off") : t("billing.autoRecharge.on")}
      </Button>
    </SettingItem>
  );
}

function invoiceColumns(t: (key: string) => string): ColumnDef<InvoiceRow, unknown>[] {
  return [
    {
      id: "date",
      header: t("billing.invoices.column.date"),
      size: 110,
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      id: "description",
      header: t("billing.invoices.column.description"),
      cell: ({ row }) => row.original.description,
    },
    {
      id: "total",
      header: t("billing.invoices.column.total"),
      size: 100,
      cell: ({ row }) => formatCurrency(row.original.totalCents, row.original.currency),
    },
    {
      id: "status",
      header: t("billing.invoices.column.status"),
      size: 90,
      cell: ({ row }) =>
        row.original.status === "paid" ? (
          <Pill tone="success">Paid</Pill>
        ) : (
          <Pill>{row.original.status}</Pill>
        ),
    },
    {
      id: "view",
      header: "",
      size: 60,
      cell: ({ row }) =>
        row.original.pdfUrl ? (
          <a
            href={row.original.pdfUrl}
            target="_blank"
            rel="noopener"
            className="text-primary underline-offset-2 hover:underline"
          >
            {t("billing.invoices.view")}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];
}

function InvoicesItem() {
  const invoices = useMyInvoices();
  const { t } = useFeatureTranslation("page.settings");
  const columns = useMemo(() => invoiceColumns(t), [t]);
  const items = (invoices.data as { items?: InvoiceRow[] } | undefined)?.items ?? [];
  return (
    <SettingItem
      title={t("billing.invoices.title")}
      description={t("billing.invoices.description")}
    >
      <DataTable<InvoiceRow>
        columns={columns}
        data={items}
        maxHeight={400}
        empty={t("billing.invoices.empty")}
      />
    </SettingItem>
  );
}

export function BillingPage() {
  const { t } = useFeatureTranslation("page.settings");
  return (
    <SettingPageLayout title={t("billing.title")}>
      <div className="flex flex-col gap-8">
        <PlanItem />
        <CreditBalanceItem />
        <UsageItem />
        <UsageByModelItem />
        <PaymentMethodItem />
        <ExtraUsageBalanceItem />
        <AutoRechargeItem />
        <InvoicesItem />
      </div>
    </SettingPageLayout>
  );
}
