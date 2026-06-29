/** Compact rating display. Renders nothing until at least one review exists. */
export function Rating({ ratingAvg, reviewCount }: { ratingAvg: number; reviewCount: number }) {
  if (reviewCount <= 0 || ratingAvg <= 0) {
    return <span className="text-muted-foreground text-xs">아직 평가 없음</span>;
  }
  return (
    <span className="text-muted-foreground text-xs">
      <span className="text-accent-gold" aria-hidden>
        ★
      </span>{" "}
      <span className="text-foreground font-medium">{ratingAvg.toFixed(1)}</span> ({reviewCount})
    </span>
  );
}
