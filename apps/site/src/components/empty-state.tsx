/** Neutral placeholder shown when the catalog API returns no items / is unset. */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border-border-subtle text-muted-foreground rounded-xl border border-dashed p-10 text-center">
      <p className="text-foreground text-sm font-medium">{title}</p>
      {hint ? <p className="mt-1 text-sm">{hint}</p> : null}
    </div>
  );
}
