export interface ProgressInput {
  currentTimeSeconds: number;
  totalSeconds: number;
  completed?: boolean;
}

export function computeProgress(input: ProgressInput) {
  const total = Math.max(0, Math.floor(input.totalSeconds));
  const watched = Math.min(total, Math.max(0, Math.floor(input.currentTimeSeconds)));
  const progressPercent = total > 0 ? Math.min(100, Math.floor((watched / total) * 100)) : 0;
  return {
    watchedSeconds: watched,
    totalSeconds: total,
    progressPercent,
    lastPositionSeconds: watched,
    completed: input.completed ?? (total > 0 && progressPercent >= 90),
  };
}

export function shouldPersistProgress(
  previousUpdatedAt: Date | null,
  now = new Date(),
  options: { force?: boolean } = {},
) {
  if (options.force) return true;
  if (!previousUpdatedAt) return true;
  return now.getTime() - previousUpdatedAt.getTime() >= 15_000;
}
