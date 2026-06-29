/**
 * Paper — 종이 겹침 효과가 있는 카드 컴포넌트.
 * 디자인 구조:
 *   memo-card-wrap (relative)
 *     ::before (absolute, inset:0, translate(2px,3px), z-index:0) ← 뒤쪽 종이
 *     paper-card (relative, z-index:1) ← 앞쪽 종이
 *
 * 비대칭 radius: 12px 12px 14px 12px
 * 상세 페이지: padding 24px (p-lg), height 100%
 * 카드 뷰: padding 16px (p-md), min-height 140px
 */
import { cn } from "@repo/ui/lib/utils";

interface PaperProps {
  children: React.ReactNode;
  className?: string;
  /** 상세 페이지용 (padding 24px, h-full) vs 카드 뷰용 (padding 16px, min-h 140px) */
  variant?: "detail" | "card";
  onClick?: () => void;
  "data-el"?: string;
}

export function Paper({
  children,
  className,
  variant = "card",
  onClick,
  "data-el": dataEl,
}: PaperProps) {
  const isDetail = variant === "detail";

  return (
    <div className={cn("relative", className)}>
      {/* Back paper — 뒤쪽 종이 (z-0) */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[12px] border border-border bg-card"
        style={{ transform: "translate(2px, 3px)", zIndex: 0 }}
      />

      {/* Main paper — 앞쪽 종이 (z-1) */}
      <div
        data-el={dataEl}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") onClick();
              }
            : undefined
        }
        className={cn(
          "relative flex flex-col rounded-[12px_12px_14px_12px] border border-border bg-card",
          "transition-[transform,box-shadow] duration-150",
          isDetail
            ? "h-full p-lg"
            : "min-h-[140px] cursor-pointer p-md hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]",
        )}
        style={{ zIndex: 1 }}
      >
        {children}
      </div>
    </div>
  );
}

/** @deprecated Use Paper instead */
export const MemoCard = Paper;
