import { useMyInvoicesQuery } from "../api/payment";

/** Paginated invoice list for the caller's org. */
export function useMyInvoices(input?: { limit?: number; cursor?: string }) {
  return useMyInvoicesQuery(input ?? {});
}
