/**
 * 화면정의서의 data-el 요소 기준으로 구현.
 * Step indicator (1/3 active) + hero title + 3 value props (no cards) + CTA.
 * max-width 640px, centered. Icon 32x32 with accent-muted bg.
 */
import { GitBranch, Play } from "lucide-react";

interface Props {
  onNext: () => void;
}

export function StepWelcome({ onNext }: Props) {
  return (
    <div className="flex flex-col items-center">
      {/* Step indicator */}
      <div
        className="flex"
        style={{ gap: "var(--sp-sm, 8px)", marginBottom: "var(--sp-2xl, 48px)" }}
        data-el="a2.step-indicator"
      >
        <div style={{ width: 32, height: 3, borderRadius: 2, background: "var(--accent)" }} />
        <div style={{ width: 32, height: 3, borderRadius: 2, background: "var(--border)" }} />
        <div style={{ width: 32, height: 3, borderRadius: 2, background: "var(--border)" }} />
      </div>

      {/* Hero */}
      <div
        className="text-center"
        style={{ marginBottom: "var(--sp-2xl, 48px)" }}
        data-el="a2.hero"
      >
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            marginBottom: "var(--sp-md, 16px)",
            color: "var(--text-primary)",
          }}
        >
          세계를 쓰고,
          <br />
          스토리를 만들고,
          <br />
          바로 플레이하세요.
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            maxWidth: 460,
            margin: "0 auto",
          }}
        >
          Product Builder는 게임 내러티브 작가를 위한 도구입니다.
          <br />
          세계관, 캐릭터, 스토리를 한 곳에서 작성하고 서로 연결합니다.
        </p>
      </div>

      {/* Value props — no cards, just icon + text */}
      <div
        className="flex w-full flex-col"
        style={{ gap: "var(--sp-lg, 24px)", marginBottom: "var(--sp-2xl, 48px)" }}
        data-el="a2.value-props"
      >
        <ValueProp
          icon={<span style={{ color: "var(--accent)", fontSize: 16 }}>@</span>}
          iconBg="var(--accent-muted)"
          title="쓰면서 연결됩니다"
          description="캐릭터 서사에서 @장소를 언급하면 자동으로 연결됩니다. 스토리에서 @캐릭터를 쓰면 세계관 정보가 바로 뜹니다."
        />
        <ValueProp
          icon={<GitBranch style={{ width: 16, height: 16, color: "var(--info)" }} />}
          iconBg="var(--info-muted)"
          title="분기하는 스토리"
          description="씬을 만들고 선택지를 추가하세요. 플레이어의 결정에 따라 다른 경로로 진행되는 스토리를 시각적으로 설계합니다."
        />
        <ValueProp
          icon={<Play style={{ width: 16, height: 16, color: "var(--success)" }} />}
          iconBg="var(--success-muted)"
          title="쓰자마자 플레이"
          description="작성한 스토리를 게임처럼 재생합니다. 대사가 흘러가고, 선택지를 고르고, 플레이어의 경험을 직접 확인하세요."
        />
      </div>

      {/* CTA */}
      <div className="flex" style={{ gap: "var(--sp-sm, 8px)" }} data-el="a2.cta">
        <button
          type="button"
          onClick={onNext}
          className="cursor-pointer border-none"
          style={{
            padding: "12px var(--sp-xl, 32px)",
            borderRadius: "var(--radius-md, 6px)",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
          }}
        >
          시작하기 →
        </button>
      </div>
    </div>
  );
}

/* Components */

interface ValuePropProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
}

function ValueProp({ icon, iconBg, title, description }: ValuePropProps) {
  return (
    <div className="flex items-start" style={{ gap: "var(--sp-md, 16px)" }}>
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-md, 6px)",
          background: iconBg,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, color: "var(--text-primary)" }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
    </div>
  );
}
