import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsSidebar } from "./SettingsSidebar";

let pathname = "/settings";

vi.mock("@repo/core/i18n", () => ({
  useFeatureTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    search,
    to,
    replace,
    ...props
  }: {
    children: React.ReactNode;
    replace?: boolean;
    search?: { projectId?: string };
    to: string;
  }) => {
    const query = search?.projectId ? `?projectId=${search.projectId}` : "";
    return (
      <a href={`${to}${query}`} data-replace={replace ? "true" : undefined} {...props}>
        {children}
      </a>
    );
  },
  useLocation: () => ({ pathname }),
}));

describe("SettingsSidebar", () => {
  it("hides project navigation without project context", () => {
    pathname = "/settings";

    render(<SettingsSidebar />);

    expect(screen.queryByText("sidebar.group.projects")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "sidebar.item.projects" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "sidebar.item.security" })).toHaveAttribute(
      "data-replace",
      "true",
    );
  });

  it("shows the current project name under the project label with project context", () => {
    pathname = "/settings";

    render(<SettingsSidebar projectId="project-1" currentProjectName="Design QA" />);

    expect(screen.getByText("sidebar.group.projects")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "sidebar.item.security" })).toHaveAttribute(
      "href",
      "/settings/security?projectId=project-1",
    );
    expect(screen.getByRole("link", { name: "sidebar.item.security" })).toHaveAttribute(
      "data-replace",
      "true",
    );
    expect(screen.getByRole("link", { name: "sidebar.item.profile" })).not.toHaveAttribute(
      "data-active",
    );
    const projectLink = screen.getByRole("link", { name: "Design QA" });
    expect(projectLink).toHaveAttribute("href", "/settings?projectId=project-1");
    expect(projectLink).toHaveAttribute("data-active", "true");
    expect(screen.queryByRole("link", { name: "sidebar.item.projects" })).not.toBeInTheDocument();
  });
});
