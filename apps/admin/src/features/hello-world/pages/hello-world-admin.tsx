import { Button } from "@repo/ui/shadcn/button";
import { Globe, RefreshCw, Server, Sparkles } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { env } from "@/lib/env";

const API_URL = env.VITE_API_URL ?? "http://localhost:3002";
const REST_API_URL = `${API_URL}/api`;
const HELLO_WORLD_ERROR_FALLBACK = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

interface ApiState {
  rest: { hello: string | null; greet: string | null };
  loading: boolean;
  error: string | null;
}

async function fetchText(path: string): Promise<string> {
  const response = await fetch(`${REST_API_URL}${path}`, { credentials: "include" });
  if (!response.ok) throw new Error("hello_world_fetch_failed");
  return response.text();
}

async function loadHelloWorld(setState: Dispatch<SetStateAction<ApiState>>) {
  setState((prev) => ({ ...prev, loading: true, error: null }));

  try {
    const [restHello, restGreet] = await Promise.all([
      fetchText("/hello-world"),
      fetchText("/hello-world/greet?name=Admin"),
    ]);

    setState({
      rest: { hello: restHello, greet: restGreet },
      loading: false,
      error: null,
    });
  } catch {
    setState((prev) => ({
      ...prev,
      loading: false,
      error: HELLO_WORLD_ERROR_FALLBACK,
    }));
  }
}

function useHelloWorldApi() {
  const [state, setState] = useState<ApiState>({
    rest: { hello: null, greet: null },
    loading: true,
    error: null,
  });

  useEffect(() => {
    void loadHelloWorld(setState);
  }, []);

  return { ...state, refetch: () => loadHelloWorld(setState) };
}

export function HelloWorldAdmin() {
  const { rest, loading, error, refetch } = useHelloWorldApi();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5" />
          <h1 className="text-xl font-bold">Hello World</h1>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <p className="text-muted-foreground">서버 API 연동 테스트</p>

      {error && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-4">
          <p className="text-sm font-medium">{error}</p>
          <p className="text-muted-foreground mt-1 text-xs">서버가 실행 중인지 확인하세요</p>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Server className="size-4" />
          REST API (/api/hello-world)
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
              <Globe className="size-3" />
              GET /api/hello-world
            </div>
            {loading ? (
              <div className="bg-muted h-6 w-48 animate-pulse rounded" />
            ) : (
              <p className="font-mono text-sm">{rest.hello ?? "No response"}</p>
            )}
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
              <Globe className="size-3" />
              GET /api/hello-world/greet?name=Admin
            </div>
            {loading ? (
              <div className="bg-muted h-6 w-48 animate-pulse rounded" />
            ) : (
              <p className="font-mono text-sm">{rest.greet ?? "No response"}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
