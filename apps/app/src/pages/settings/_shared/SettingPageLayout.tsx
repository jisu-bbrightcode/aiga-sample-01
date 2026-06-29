/**
 * SettingPageLayout — shared shell for every page rendered inside the
 * settings grid (i.e. the right pane of /settings/*).
 *
 * Owns the page title bar so each leaf page only renders its body sections,
 * keeping spacing/typography rhythm consistent across Profile / Organization /
 * Members / Projects / Billing / etc.
 *
 * Fluid by default: width follows the surrounding `<main>` (sidebar layout
 * already constrains the right pane). Form-style pages narrow individual
 * fields via SetField; wide pages (tables, card grids) get the full pane.
 *
 * `toolbar` prop is reserved for filter/search rows that sit between the
 * title and the body (e.g. members search bar, projects filter tabs).
 */
import type { ReactNode } from "react";
import { SettingsContentHead } from "./SettingsContentHead";

interface Props {
  title: string;
  description?: string;
  toolbar?: ReactNode;
  children: ReactNode;
}

export function SettingPageLayout({ title, description, toolbar, children }: Props) {
  return (
    <>
      <SettingsContentHead title={title} description={description} />
      {toolbar ? <div className="mb-6">{toolbar}</div> : null}
      <div>{children}</div>
    </>
  );
}
