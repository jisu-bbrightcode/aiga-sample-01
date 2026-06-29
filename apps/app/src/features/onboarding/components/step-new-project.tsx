/**
 * Step 4: 새 프로젝트 생성 (A2d design)
 * Template selection: 2x2 grid
 */

import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { File, Search, Star, Swords } from "lucide-react";
import { useState } from "react";
import { OnboardingProgress } from "./onboarding-progress";

interface Props {
  onComplete: (template: string) => void;
  onBack: () => void;
  loading: boolean;
}

export function StepNewProject({ onComplete, onBack, loading }: Props) {
  const [selectedTemplate, setSelectedTemplate] = useState("blank");

  return (
    <div className="space-y-6">
      {/* Progress */}
      <OnboardingProgress currentStep={4} />

      {/* Content */}
      <div className="space-y-4">
        <h2 className="text-center text-xl font-semibold tracking-tight">세계관을 선택하세요</h2>
        <p className="text-center text-base leading-relaxed text-muted-foreground">
          빈 프로젝트로 시작하거나, 템플릿으로 Product Builder의 기능을 빠르게 체험해보세요.
        </p>
      </div>

      {/* Template grid 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {TEMPLATES.map((tmpl) => (
          <TemplateCard
            key={tmpl.id}
            id={tmpl.id}
            icon={tmpl.icon}
            title={tmpl.title}
            description={tmpl.description}
            selected={selectedTemplate === tmpl.id}
            onSelect={() => setSelectedTemplate(tmpl.id)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="h-10">
          ← 뒤로
        </Button>
        <Button
          onClick={() => onComplete(selectedTemplate)}
          className="h-10 flex-1"
          disabled={loading}
        >
          {loading ? "생성 중..." : "다음 →"}
        </Button>
      </div>
    </div>
  );
}

/* Constants */

const TEMPLATES = [
  {
    id: "blank",
    icon: <File className="size-5" />,
    title: "빈 프로젝트",
    description: "처음부터 세계관을 직접 만듭니다",
  },
  {
    id: "fantasy-rpg",
    icon: <Swords className="size-5" />,
    title: "판타지 RPG",
    description: "캐릭터 3, 장소 2, 씬 5 포함",
  },
  {
    id: "mystery",
    icon: <Search className="size-5" />,
    title: "미스터리 어드벤처",
    description: "단서 시스템, 복선 구조 예시",
  },
  {
    id: "space-opera",
    icon: <Star className="size-5" />,
    title: "SF 스페이스오페라",
    description: "세력 갈등, 행성 간 이동 구조",
  },
] as const;

/* Components */

interface TemplateCardProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

function TemplateCard({ icon, title, description, selected, onSelect }: TemplateCardProps) {
  return (
    <Button
      variant="outline"
      type="button"
      onClick={onSelect}
      className={cn(
        "flex h-auto flex-col items-start gap-2 p-4 text-left",
        selected ? "border-primary bg-primary/5" : "border-border",
      )}
    >
      <div
        className={cn(
          "flex size-8 items-center justify-center rounded-md",
          selected ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground",
        )}
      >
        {icon}
      </div>
      <div className="space-y-1">
        <div className="text-base font-medium">{title}</div>
        <div className="text-xs font-normal text-muted-foreground">{description}</div>
      </div>
    </Button>
  );
}
