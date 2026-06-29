/**
 * P12: Tag/badge — padding 2px 8px, 13px, radius 4px.
 * Variants: default, accent (character), success (location),
 * warning (faction), info (object), codex (violet).
 */
import { cn } from "@repo/ui/lib/utils";

type TagVariant = "default" | "accent" | "success" | "warning" | "info" | "codex";

interface Props {
  children: React.ReactNode;
  variant?: TagVariant;
  className?: string;
}

const VARIANT_STYLES: Record<TagVariant, { background: string; color: string }> = {
  default: {
    background: "var(--surface-hover)",
    color: "var(--text-secondary)",
  },
  accent: {
    background: "var(--accent-muted)",
    color: "var(--accent)",
  },
  success: {
    background: "var(--success-muted)",
    color: "var(--success)",
  },
  warning: {
    background: "var(--warning-muted)",
    color: "var(--warning)",
  },
  info: {
    background: "var(--info-muted)",
    color: "var(--info)",
  },
  codex: {
    background: "rgba(139, 92, 246, 0.12)",
    color: "var(--codex, #8B5CF6)",
  },
};

export function EntityTag({ children, variant = "default", className }: Props) {
  const styles = VARIANT_STYLES[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap text-sm font-medium",
        className,
      )}
      style={{
        padding: "2px var(--sp-sm)",
        borderRadius: "var(--radius-sm)",
        background: styles.background,
        color: styles.color,
      }}
    >
      {children}
    </span>
  );
}

/* Helpers */

const ENTITY_TYPE_VARIANT: Record<string, TagVariant> = {
  character: "accent",
  world: "info",
  location: "success",
  faction: "warning",
  codex: "codex",
};

export function getEntityTagVariant(entityType: string): TagVariant {
  return ENTITY_TYPE_VARIANT[entityType] ?? "default";
}
