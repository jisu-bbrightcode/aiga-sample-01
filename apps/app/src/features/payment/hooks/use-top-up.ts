import { useTopUpPackagesQuery } from "../api/payment";

/** Public catalog of top-up packages, smallest first. */
export function useTopUpPackages() {
  return useTopUpPackagesQuery();
}
