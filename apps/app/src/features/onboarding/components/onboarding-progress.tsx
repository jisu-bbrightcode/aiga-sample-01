/**
 * Onboarding Progress Dots — 3 dots for steps 2-4
 */
import { cn } from "@repo/ui/lib/utils";

interface Props {
  /** Current step (2, 3, or 4) */
  currentStep: number;
  /** Total wizard steps (3 = steps 2-4) */
  totalSteps?: number;
}

export function OnboardingProgress({ currentStep, totalSteps = 3 }: Props) {
  const stepIndex = currentStep - 2; // step 2 = index 0

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Dots */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={cn(
              "size-2 rounded-full transition-colors",
              i < stepIndex ? "bg-primary" : i === stepIndex ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
      {/* Step indicator */}
      <span className="text-xs text-muted-foreground">
        Step {currentStep - 1} of {totalSteps}
      </span>
    </div>
  );
}
