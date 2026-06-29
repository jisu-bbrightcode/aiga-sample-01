import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pill } from "@repo/ui/settings/Pill";

describe("Pill", () => {
  it("renders children", () => {
    render(<Pill>Owner</Pill>);
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("applies tone class", () => {
    render(<Pill tone="success">Paid</Pill>);
    const el = screen.getByText("Paid");
    expect(el.className).toContain("bg-primary/10");
  });
});
