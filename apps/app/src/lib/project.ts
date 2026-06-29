/**
 * Project metadata
 *
 * 환경변수에서 프로젝트 이름을 읽습니다.
 * VITE_APP_NAME이 비어 있어도 Product Builder 브랜드명이 화면에 유지되어야 합니다.
 */
export function resolveProjectName(value: unknown): string {
  if (typeof value !== "string") return "Product Builder";

  const normalized = value.trim();
  if (!normalized || normalized === "VITE_APP_NAME") return "Product Builder";

  return normalized;
}

export const project = {
  name: resolveProjectName(import.meta.env.VITE_APP_NAME),
} as const;
