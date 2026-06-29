import { useCreditBalanceQuery, useCreditHistoryQuery } from "../api/payment";

/** Current credit balance + last-mutation metadata. */
export function useCreditBalance() {
  return useCreditBalanceQuery();
}

/** Paginated ledger history for the caller's org. */
export function useCreditHistory(input?: { limit?: number; cursor?: string }) {
  return useCreditHistoryQuery(input ?? {});
}
