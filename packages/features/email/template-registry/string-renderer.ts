/**
 * Subject / body string-template renderer — pure.
 *
 * Capability: `notification.email.template-manager`
 * (PB-NOTI-EMAIL-TEMPLATE-001 / BBR-656).
 *
 * Email subjects (e.g. the seeded `transactional.notification` subject
 * `{{title}}`) and optional DB-stored body sources may contain `{{ variable }}`
 * placeholders. This interpolates them from the supplied variables and reports
 * any placeholders that could not be resolved.
 */

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g;

export interface RenderStringResult {
  output: string;
  /** Placeholder names referenced in the template but not supplied. */
  missing: string[];
}

export function renderTemplateString(
  template: string,
  variables: Record<string, unknown>,
): RenderStringResult {
  const missing = new Set<string>();

  const output = template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = variables[name];
    if (value === undefined || value === null) {
      missing.add(name);
      return "";
    }
    return String(value);
  });

  return { output, missing: [...missing] };
}
