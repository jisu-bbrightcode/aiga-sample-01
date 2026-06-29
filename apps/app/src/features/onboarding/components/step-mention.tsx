/**
 * 화면정의서의 data-el 요소 기준으로 구현.
 * Step indicator (2/3 active) + title + demo panel with @mention highlights + nav buttons.
 * max-width 560px, centered.
 */
import { Button } from "@repo/ui/shadcn/button";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export function StepMention({ onNext, onBack }: Props) {
  return (
    <div className="flex flex-col items-center" style={{ maxWidth: 560, margin: "0 auto" }}>
      {/* Step indicator */}
      <div
        className="flex"
        style={{ gap: "var(--sp-sm, 8px)", marginBottom: "var(--sp-2xl, 48px)" }}
        data-el="a2b.step-indicator"
      >
        <div style={{ width: 32, height: 3, borderRadius: 2, background: "var(--accent)" }} />
        <div style={{ width: 32, height: 3, borderRadius: 2, background: "var(--accent)" }} />
        <div style={{ width: 32, height: 3, borderRadius: 2, background: "var(--border)" }} />
      </div>

      {/* Title + description */}
      <div
        className="text-center"
        style={{ marginBottom: "var(--sp-2xl, 48px)" }}
        data-el="a2b.title-desc"
      >
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
            marginBottom: "var(--sp-md, 16px)",
            color: "var(--text-primary)",
          }}
        >
          쓰면서 세계가 연결됩니다
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          글을 쓰다가 <span style={{ color: "var(--accent)", fontWeight: 500 }}>@</span>를 입력하면,
          <br />
          캐릭터와 장소가 자동으로 이어집니다.
        </p>
      </div>

      {/* Demo panel */}
      <div
        className="w-full"
        style={{ marginBottom: "var(--sp-2xl, 48px)" }}
        data-el="a2b.demo-panels"
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg, 8px)",
            padding: "var(--sp-lg, 24px)",
          }}
        >
          {/* Editor simulation */}
          <div style={{ fontSize: 14, lineHeight: 2, color: "var(--text-primary)" }}>
            <MentionTag color="var(--accent)" bg="var(--accent-muted)">
              Aethon
            </MentionTag>
            은{" "}
            <MentionTag color="var(--success)" bg="rgba(34,197,94,0.12)">
              Iron Gate Fortress
            </MentionTag>{" "}
            앞에 섰다. 오래전 그를 추방한 곳이다.
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 2,
              color: "var(--text-primary)",
              marginTop: "var(--sp-xs, 4px)",
            }}
          >
            &quot;
            <MentionTag color="var(--accent)" bg="var(--accent-muted)">
              Commander Thane
            </MentionTag>
            에게 전해라.{" "}
            <MentionTag color="var(--accent)" bg="var(--accent-muted)">
              Lyra
            </MentionTag>
            가 온다고.&quot;
          </div>

          {/* Hint */}
          <div
            style={{
              marginTop: "var(--sp-lg, 24px)",
              paddingTop: "var(--sp-md, 16px)",
              borderTop: "1px solid var(--border-subtle)",
            }}
            data-el="a2b.mention-types"
          >
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              <span style={{ color: "var(--accent)", fontWeight: 500 }}>@</span> 캐릭터 &middot;{" "}
              <span style={{ color: "var(--success)", fontWeight: 500 }}>@@</span> 장소 &middot;{" "}
              쓰기만 하면 세계관이 자동으로 엮입니다.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex" style={{ gap: "var(--sp-sm, 8px)" }} data-el="a2b.cta">
        <Button variant="ghost" onClick={onBack} className="h-10">
          ← 이전
        </Button>
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
          다음 →
        </button>
      </div>
    </div>
  );
}

/* Components */

interface MentionTagProps {
  color: string;
  bg: string;
  children: React.ReactNode;
}

function MentionTag({ color, bg, children }: MentionTagProps) {
  return (
    <span
      style={{
        background: bg,
        padding: "2px 6px",
        borderRadius: 4,
        color,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}
