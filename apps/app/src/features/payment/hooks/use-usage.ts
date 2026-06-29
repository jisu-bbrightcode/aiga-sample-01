import { usePaymentUsageStatsQuery } from "../api/payment";

/** Usage breakdown by model over the requested window (default 30 days). */
export function useUsageStats(rangeDays = 30) {
  return usePaymentUsageStatsQuery(rangeDays);
}
