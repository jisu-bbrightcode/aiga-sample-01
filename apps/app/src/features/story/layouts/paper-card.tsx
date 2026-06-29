/**
 * P5: Paper card for detail editor. Same as memo-card but padding 24px.
 * Border-radius: 12px 12px 14px 12px.
 */
import { cn } from "@repo/ui/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
}

export function PaperCard({ children, className }: Props) {
  return (
    <div className={cn("memo-card-wrap relative", className)}>
      <div
        className="relative"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "12px 12px 14px 12px",
          padding: "var(--sp-lg)",
        }}
      >
        {children}
      </div>
      <style>{`
        .memo-card-wrap::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px 12px 14px 12px;
          transform: translate(2px, 3px);
          z-index: -1;
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
