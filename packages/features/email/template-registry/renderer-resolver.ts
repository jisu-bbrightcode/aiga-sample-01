/**
 * Resolve which React renderer (`email_template_type`) renders a given template
 * key.
 *
 * Capability: `notification.email.template-manager`
 * (PB-NOTI-EMAIL-TEMPLATE-001 / BBR-656).
 *
 * Template keys are dotted (e.g. `auth.welcome`, `password.password-reset`); the
 * last segment is the renderer selector, matching the seed catalog 1:1. The DB
 * deliberately does not store the renderer as a column — the key suffix is the
 * single source of truth — so this stays a pure derivation. Returns `null` when
 * the key's renderer is not a known React template (the caller then falls back
 * to a stored `bodySource`).
 */
import type { EmailTemplateType } from "@repo/drizzle/schema";
import { emailTemplateEnum } from "@repo/drizzle/schema";

const RENDERERS = emailTemplateEnum.enumValues as readonly string[];

export function resolveRenderer(key: string): EmailTemplateType | null {
  const segment = key.split(".").pop() ?? "";
  return RENDERERS.includes(segment) ? (segment as EmailTemplateType) : null;
}
