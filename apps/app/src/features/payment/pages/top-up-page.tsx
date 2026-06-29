import { useFeatureTranslation, useLanguage } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader } from "@repo/ui/shadcn/card";
import { useState } from "react";
import { AppQuietLoadingState } from "@/components/app-loading";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { CouponInput } from "../components/coupon-input";
import { CreditBalance } from "../components/credit-balance";
import { buildCheckoutReturnUrls, useCreateTopUpCheckout } from "../hooks/use-checkout";
import { useCreditBalance } from "../hooks/use-credits";
import { useTopUpPackages } from "../hooks/use-top-up";

interface TopUpPackage {
  id: string;
  slug: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  polarProductId: string;
}

function formatPrice(cents: number, currency: string, language: string): string {
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function TopUpPage() {
  const { t } = useFeatureTranslation("app");
  const [language] = useLanguage();
  const packages = useTopUpPackages();
  const balance = useCreditBalance();
  const checkout = useCreateTopUpCheckout();

  const [selected, setSelected] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);

  const list = (packages.data ?? []) as TopUpPackage[];
  const selectedPkg = list.find((p) => p.id === selected) ?? null;

  function handleBuy() {
    if (!selectedPkg) return;
    const { successUrl } = buildCheckoutReturnUrls();
    checkout.mutate(
      {
        packageId: selectedPkg.id,
        successUrl,
        couponCode: couponCode ?? undefined,
      },
      {
        onSuccess: (result) => {
          if (result?.checkoutUrl) {
            window.location.href = result.checkoutUrl;
          }
        },
      },
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("payment.topUp.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("payment.topUp.description")}</p>
      </div>

      <CreditBalance
        balance={balance.data?.balance}
        isLoading={balance.isLoading}
        showTopUpAction={false}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {packages.isLoading ? (
          <AppQuietLoadingState
            className="col-span-full"
            label={t("payment.topUp.loadingPackages")}
            variant="inline"
          />
        ) : (
          list.map((pkg) => {
            const isSelected = pkg.id === selected;
            return (
              <Card
                key={pkg.id}
                className={
                  isSelected
                    ? "border-primary cursor-pointer shadow-md"
                    : "hover:border-primary/40 cursor-pointer"
                }
                onClick={() => setSelected(pkg.id)}
              >
                <CardHeader className="pb-2">
                  <span className="text-base font-semibold">{pkg.name}</span>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-bold tabular-nums">
                    {pkg.credits.toLocaleString(language)}{" "}
                    <span className="text-muted-foreground text-sm font-normal">
                      {t("payment.topUp.credits")}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {formatPrice(pkg.priceCents, pkg.currency, language)}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div className="border-t pt-4">
        <p className="mb-2 text-sm font-medium">{t("payment.coupon.label")}</p>
        <CouponInput scope="top_up" onCouponChange={setCouponCode} />
      </div>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        {selectedPkg && (
          <span className="text-muted-foreground text-sm">
            {t("payment.topUp.selected", {
              name: selectedPkg.name,
              price: formatPrice(selectedPkg.priceCents, selectedPkg.currency, language),
            })}
          </span>
        )}
        <Button onClick={handleBuy} disabled={!selectedPkg || checkout.isPending}>
          {checkout.isPending ? t("payment.action.processing") : t("payment.topUp.checkout")}
        </Button>
      </div>

      {checkout.error && (
        <p className="text-destructive text-sm">
          {getAppErrorMessage(t, checkout.error, "errors.paymentCheckout")}
        </p>
      )}
    </div>
  );
}
