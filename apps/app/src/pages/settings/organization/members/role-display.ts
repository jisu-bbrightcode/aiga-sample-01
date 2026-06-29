/**
 * role-display — single source of truth for member role labels.
 *
 * Backend roles (better-auth): "owner" | "admin" | "member" — kept as-is
 * (per user decision in spec § 1.1). UI shows the design's richer labels
 * but it's purely a presentation mapping.
 */
export type BackendRole = "owner" | "admin" | "member";

export function displayRole(role: string | null | undefined): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "member":
      return "Editor";
    default:
      return role ?? "—";
  }
}
