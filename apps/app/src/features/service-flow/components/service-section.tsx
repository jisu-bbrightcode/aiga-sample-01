/**
 * Section shell that branches loading / error / 권한 없음 / empty / ready states
 * for one personalization list on the My Page (PB-WEB-002 / BBR-580).
 *
 * Errors are mapped through `getAppErrorMessage` (stable code → i18n copy) so a
 * 403 reads as a clear 권한 없음 message and a 401 as a re-login prompt — never
 * a raw server body. This single component keeps every section's state handling
 * consistent and testable.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import type { ReactNode } from "react";
import { AppQuietLoadingState } from "@/components/app-loading";
import { getAppErrorMessage } from "@/lib/user-facing-error";

export interface ServiceSectionProps {
  title: string;
  description?: string;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isEmpty: boolean;
  emptyMessage: string;
  onRetry?: () => void;
  children?: ReactNode;
}

export function ServiceSection({
  title,
  description,
  isLoading,
  isError,
  error,
  isEmpty,
  emptyMessage,
  onRetry,
  children,
}: ServiceSectionProps) {
  const { t } = useFeatureTranslation("app");

  return (
    <section className="rounded-xl border border-border bg-card p-5" data-el="service-flow.section">
      <header className="mb-4 flex flex-col gap-0.5">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>

      <ServiceSectionBody
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={isEmpty}
        emptyMessage={emptyMessage}
        onRetry={onRetry}
        retryLabel={t("serviceFlow.actions.retry")}
        loadingLabel={t("serviceFlow.states.loading")}
      >
        {children}
      </ServiceSectionBody>
    </section>
  );
}

interface ServiceSectionBodyProps extends Omit<ServiceSectionProps, "title" | "description"> {
  retryLabel: string;
  loadingLabel: string;
}

function ServiceSectionBody({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyMessage,
  onRetry,
  retryLabel,
  loadingLabel,
  children,
}: ServiceSectionBodyProps) {
  const { t } = useFeatureTranslation("app");

  if (isLoading) {
    return <AppQuietLoadingState label={loadingLabel} variant="inline" />;
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-start gap-2 text-sm text-muted-foreground"
        role="alert"
        data-el="service-flow.section-error"
      >
        <p>{getAppErrorMessage(t, error)}</p>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <p className="text-sm text-muted-foreground" data-el="service-flow.section-empty">
        {emptyMessage}
      </p>
    );
  }

  return <>{children}</>;
}
