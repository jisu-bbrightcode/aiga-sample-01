import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SetPrefixInput } from "@repo/ui/settings/SetPrefixInput";

describe("SetPrefixInput", () => {
  it("shows the prefix and forwards changes", () => {
    const onChange = vi.fn();
    render(<SetPrefixInput prefix="product-builder.app/" value="" onChange={onChange} />);
    expect(screen.getByText("product-builder.app/")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "jaewon" },
    });
    expect(onChange).toHaveBeenCalledWith("jaewon");
  });

  it("respects disabled prop", () => {
    render(
      <SetPrefixInput prefix="product-builder.app/" value="x" onChange={() => {}} disabled />,
    );
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
