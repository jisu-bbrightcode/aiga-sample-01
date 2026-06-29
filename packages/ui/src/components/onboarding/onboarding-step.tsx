/**
 * 온보딩 스텝 카드. 단계 표시, 제목, 설명, 콘텐츠, 다음/건너뛰기.
 */

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface Props {
  step: number;
  totalSteps: number;
  title: string;
  description?: string;
  children?: ReactNode;
  onNext?: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  className?: string;
}

export function OnboardingStep({
  step,
  totalSteps,
  title,
  description,
  children,
  onNext,
  onSkip,
  nextLabel = "다음",
  className,
}: Props) {
  return (
    <Card className={cn("w-full max-w-md", className)} data-testid="onboarding-step">
      <CardHeader className="gap-3 pb-4">
        <span
          className="w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
          data-testid="onboarding-step.indicator"
        >
          {step}/{totalSteps}
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </CardHeader>

      {children && <CardContent className="pb-4">{children}</CardContent>}

      <CardContent className="flex items-center justify-between gap-3 pt-0">
        {onSkip ? (
          <Button variant="ghost" size="sm" onClick={onSkip} data-testid="onboarding-step.skip">
            건너뛰기
          </Button>
        ) : (
          <div />
        )}
        {onNext && (
          <Button size="sm" onClick={onNext} data-testid="onboarding-step.next">
            {nextLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
