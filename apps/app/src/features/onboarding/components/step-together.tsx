/**
 * Step 3: 함께 만들어갑니다 (A2c design)
 */

import { Button } from "@repo/ui/shadcn/button";
import { Mail, MessageCircle, Users } from "lucide-react";
import { OnboardingProgress } from "./onboarding-progress";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function StepTogether({ onNext, onBack }: Props) {
  return (
    <div className="space-y-6">
      {/* Progress */}
      <OnboardingProgress currentStep={3} />

      {/* Content */}
      <div className="space-y-4">
        <h2 className="text-center text-xl font-semibold tracking-tight">함께 만들어갑니다</h2>
        <p className="text-center text-base leading-relaxed text-muted-foreground">
          Product Builder는 작가의 목소리를 듣고 함께 성장합니다. 아래 채널로 언제든 의견을 보내주세요.
        </p>
      </div>

      {/* Channel cards */}
      <div className="space-y-3">
        <ChannelCard
          icon={<MessageCircle className="size-5" />}
          title="앱 내 피드백"
          description="우측 하단 ? 버튼으로 언제든 의견을 보내세요"
        />
        <ChannelCard
          icon={<Mail className="size-5" />}
          title="이메일"
          description="hello@product-builder.app — 보내주시면 꼭 읽고 답장합니다"
        />
        <ChannelCard
          icon={<Users className="size-5" />}
          title="Discord 커뮤니티"
          description="다른 작가들과 이야기하고, 기능 요청을 투표하세요"
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">
        함께 만들어가는 도구가 되겠습니다.
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="h-10">
          ← 이전
        </Button>
        <Button onClick={onNext} className="h-10 flex-1">
          프로젝트 만들러 가기 →
        </Button>
      </div>
    </div>
  );
}

/* Components */

interface ChannelCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ChannelCard({ icon, title, description }: ChannelCardProps) {
  return (
    <div className="flex gap-4 rounded-lg border border-border p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
