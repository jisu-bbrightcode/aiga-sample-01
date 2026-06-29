/**
 * Hello World Hook — REST 기반
 */
import { useQuery } from "@tanstack/react-query";
import { env } from "@/lib/env";

const API_URL = env.VITE_API_URL ?? "http://localhost:3002";

export function useHelloWorld() {
  const { data, isLoading } = useQuery({
    queryKey: ["get", "/api/hello-world"],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/hello-world`, { credentials: "include" });
      if (!response.ok) throw new Error("hello_world_fetch_failed");
      return response.text();
    },
  });

  return {
    message: data ?? "",
    loading: isLoading,
  };
}
