/**
 * DataProvider — 프로젝트 데이터 소스 분기
 *
 * Product Builder 신규 작업은 서버 권위 DataBackend를 기준으로 한다.
 * Legacy Electron/local backends are not Product Builder policy.
 * 프로젝트 내부 페이지에서만 사용.
 */
import { createContext, useContext } from "react";
import type { DataBackend } from "./types";

const DataBackendContext = createContext<DataBackend | null>(null);

export function DataProvider({
  backend,
  children,
}: {
  backend: DataBackend;
  children: React.ReactNode;
}) {
  return <DataBackendContext.Provider value={backend}>{children}</DataBackendContext.Provider>;
}

export function useDataBackend(): DataBackend {
  const ctx = useContext(DataBackendContext);
  if (!ctx) {
    throw new Error("useDataBackend must be used within <DataProvider>");
  }
  return ctx;
}

export function useOptionalDataBackend(): DataBackend | null {
  return useContext(DataBackendContext);
}
