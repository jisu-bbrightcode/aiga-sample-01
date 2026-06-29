import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export const APP_LOADING_ANIMATION_SRC = "/loading/liquid-splats.lottie";

type LoadingSize = "xs" | "sm" | "md" | "lg" | "xl";

const loadingSizeClass: Record<LoadingSize, string> = {
  xs: "size-8",
  sm: "size-12",
  md: "size-20",
  lg: "size-32",
  xl: "size-48",
};

interface LoadingLottieProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  label?: string;
  size?: LoadingSize;
}

export function LoadingLottie({
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
  className,
  label,
  role,
  size = "md",
  ...props
}: LoadingLottieProps) {
  const { t } = useFeatureTranslation("app");
  const resolvedLabel = label ?? t("loading.default");
  const decorative = ariaHidden === true || ariaHidden === "true";
  const accessibilityProps = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ "aria-label": ariaLabel ?? resolvedLabel, role: role ?? "status" } as const);

  return (
    <span
      {...props}
      {...accessibilityProps}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        loadingSizeClass[size],
        className,
      )}
    >
      <DotLottieReact autoplay className="h-full w-full" loop src={APP_LOADING_ANIMATION_SRC} />
    </span>
  );
}

export interface AppLoadingStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label?: ReactNode;
  loaderLabel?: string;
  size?: LoadingSize;
  variant?: "inline" | "page" | "fullscreen";
}

interface QuietLoadingIndicatorProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  label?: ReactNode;
  loaderLabel?: string;
}

const loadingStateVariantClass: Record<NonNullable<AppLoadingStateProps["variant"]>, string> = {
  fullscreen: "min-h-dvh",
  inline: "py-2",
  page: "h-full min-h-[160px]",
};

export function AppLoadingState({
  className,
  label,
  loaderLabel,
  size = "lg",
  variant = "page",
  ...props
}: AppLoadingStateProps) {
  const { t } = useFeatureTranslation("app");
  const resolvedLabel = label === undefined ? t("loading.appLong") : label;
  const visibleLabel = variant === "fullscreen" ? null : resolvedLabel;
  const accessibleLabel =
    loaderLabel ?? (typeof resolvedLabel === "string" ? resolvedLabel : t("loading.default"));

  return (
    <div
      {...props}
      className={cn(
        "text-muted-foreground flex w-full flex-col items-center justify-center text-sm",
        visibleLabel ? "gap-2" : "gap-0",
        loadingStateVariantClass[variant],
        className,
      )}
    >
      <LoadingLottie label={accessibleLabel} size={size} />
      {visibleLabel ? <div className="text-center leading-normal">{visibleLabel}</div> : null}
    </div>
  );
}

export function QuietLoadingIndicator({
  "aria-label": ariaLabel,
  className,
  label,
  loaderLabel,
  role = "status",
  ...props
}: QuietLoadingIndicatorProps) {
  const { t } = useFeatureTranslation("app");
  const resolvedLabel = label === undefined ? t("loading.fetchingLong") : label;
  return (
    <span
      {...props}
      aria-label={
        ariaLabel ??
        loaderLabel ??
        (typeof resolvedLabel === "string" ? resolvedLabel : t("loading.fetching"))
      }
      aria-live="polite"
      className={cn("inline-flex items-center gap-1.5 text-muted-foreground", className)}
      role={role}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-current opacity-50 motion-safe:animate-pulse"
      />
      {resolvedLabel ? <span className="leading-normal">{resolvedLabel}</span> : null}
    </span>
  );
}

export function AppQuietLoadingState({
  className,
  label,
  loaderLabel,
  variant = "page",
  ...props
}: AppLoadingStateProps) {
  const { t } = useFeatureTranslation("app");
  const resolvedLabel = label === undefined ? t("loading.fetchingLong") : label;
  return (
    <div
      {...props}
      className={cn(
        "flex w-full items-center justify-center text-sm",
        loadingStateVariantClass[variant],
        className,
      )}
    >
      <QuietLoadingIndicator label={resolvedLabel} loaderLabel={loaderLabel} />
    </div>
  );
}

export function AppAuthLoadingState({
  label,
  variant = "fullscreen",
  ...props
}: AppLoadingStateProps) {
  const { t } = useFeatureTranslation("app");
  const resolvedLabel = label === undefined ? t("loading.auth") : label;
  return <AppLoadingState {...props} label={resolvedLabel} variant={variant} />;
}

export function AppWorkspaceLoadingState({
  label,
  variant = "fullscreen",
  ...props
}: AppLoadingStateProps) {
  const { t } = useFeatureTranslation("app");
  const resolvedLabel = label === undefined ? t("loading.workspace") : label;
  return <AppLoadingState {...props} label={resolvedLabel} variant={variant} />;
}
