import { usePlansQuery } from "../api/payment";

/** Public catalog of all active plans, ordered by price ascending. */
export function usePlans() {
  return usePlansQuery();
}
