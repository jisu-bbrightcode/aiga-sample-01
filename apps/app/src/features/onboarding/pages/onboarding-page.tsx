/**
 * 화면정의서의 data-el 요소 기준으로 구현.
 * Centered fullscreen, max-width 640px for welcome / 560px for mention.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useCreateProject } from "@/features/project/hooks/use-project-mutations";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { StepMention } from "../components/step-mention";
import { StepNewProject } from "../components/step-new-project";
import { StepTogether } from "../components/step-together";
import { StepWelcome } from "../components/step-welcome";
import { useCompleteOnboarding, useUpdateOnboardingStep } from "../hooks/use-onboarding";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { t } = useFeatureTranslation("app");
  const [currentStep, setCurrentStep] = useState(1);

  const updateStep = useUpdateOnboardingStep();
  const completeOnboarding = useCompleteOnboarding();
  const createProject = useCreateProject();

  const goToStep = (step: number) => {
    updateStep.mutate(
      { currentStep: step },
      {
        onSuccess: () => setCurrentStep(step),
        onError: (error) => {
          toast.error(t("errors.onboardingStep"), {
            description: getAppErrorMessage(t, error),
          });
        },
      },
    );
  };

  const handleComplete = (template: string) => {
    const templateNames: Record<string, string> = {
      blank: "내 프로젝트",
      "fantasy-rpg": "판타지 RPG",
      mystery: "미스터리 어드벤처",
      "space-opera": "SF 스페이스오페라",
    };

    createProject.mutate(
      {
        name: templateNames[template] ?? "내 프로젝트",
        template: template === "blank" ? undefined : template,
      },
      {
        onSuccess: () => {
          completeOnboarding.mutate(undefined, {
            onSuccess: () => {
              navigate({ to: "/" });
            },
            onError: (error) => {
              toast.error(t("errors.onboardingComplete"), {
                description: getAppErrorMessage(t, error),
              });
            },
          });
        },
        onError: (error) => {
          toast.error(t("errors.projectCreate"), {
            description: getAppErrorMessage(t, error),
          });
        },
      },
    );
  };

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-8"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full" style={{ maxWidth: currentStep <= 2 ? 640 : 480 }}>
        {currentStep === 1 ? (
          <StepWelcome onNext={() => goToStep(2)} />
        ) : currentStep === 2 ? (
          <StepMention onNext={() => goToStep(3)} onBack={() => setCurrentStep(1)} />
        ) : currentStep === 3 ? (
          <StepTogether onNext={() => goToStep(4)} onBack={() => setCurrentStep(2)} />
        ) : (
          <StepNewProject
            onComplete={handleComplete}
            onBack={() => setCurrentStep(3)}
            loading={createProject.isPending || completeOnboarding.isPending}
          />
        )}
      </div>
    </div>
  );
}
