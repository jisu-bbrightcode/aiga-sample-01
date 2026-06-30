import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServiceFlowError } from "../api/service-flow-api";
import { ServiceSection } from "./service-section";

// Identity translator so assertions read mapped i18n KEYS (deterministic) while
// the real getUserFacingErrorMessage code→key mapping stays intact.
vi.mock("@repo/core/i18n", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useFeatureTranslation: () => ({ t: (key: string) => key }) };
});

const baseProps = {
  title: "Saved",
  isLoading: false,
  isError: false,
  isEmpty: false,
  emptyMessage: "nothing-here",
};

describe("ServiceSection", () => {
  it("renders the loading indicator and hides content while loading", () => {
    render(
      <ServiceSection {...baseProps} isLoading>
        <p>real-content</p>
      </ServiceSection>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("real-content")).not.toBeInTheDocument();
  });

  it("maps a 403 to the 권한 없음 (forbidden) copy — never the raw error", () => {
    render(
      <ServiceSection
        {...baseProps}
        isError
        error={new ServiceFlowError("FORBIDDEN", 403)}
        onRetry={() => undefined}
      >
        <p>real-content</p>
      </ServiceSection>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("errors.forbidden");
    // raw code/status must not leak into the UI.
    expect(alert).not.toHaveTextContent("FORBIDDEN");
    expect(alert).not.toHaveTextContent("403");
    expect(screen.getByText("serviceFlow.actions.retry")).toBeInTheDocument();
  });

  it("maps a 401 to the re-login (unauthorized) copy", () => {
    render(
      <ServiceSection {...baseProps} isError error={new ServiceFlowError("UNAUTHORIZED", 401)} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("errors.unauthorized");
  });

  it("renders the empty message when there is no data", () => {
    render(<ServiceSection {...baseProps} isEmpty emptyMessage="nothing-here" />);
    expect(screen.getByText("nothing-here")).toBeInTheDocument();
  });

  it("renders children in the ready state", () => {
    render(
      <ServiceSection {...baseProps}>
        <p>real-content</p>
      </ServiceSection>,
    );
    expect(screen.getByText("real-content")).toBeInTheDocument();
  });
});
