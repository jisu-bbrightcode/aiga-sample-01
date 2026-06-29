import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SetField } from "@repo/ui/settings/SetField";

describe("SetField", () => {
  it("renders label, description, hint, and children", () => {
    render(
      <SetField label="이름" description="멤버에게 표시" hint="필수">
        <input aria-label="name" />
      </SetField>,
    );
    expect(screen.getByText("이름")).toBeInTheDocument();
    expect(screen.getByText("멤버에게 표시")).toBeInTheDocument();
    expect(screen.getByText("필수")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("omits empty regions cleanly", () => {
    render(
      <SetField>
        <span data-testid="bare">content</span>
      </SetField>,
    );
    expect(screen.getByTestId("bare")).toBeInTheDocument();
  });
});
