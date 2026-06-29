import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HueAvatar } from "@repo/ui/settings/HueAvatar";

describe("HueAvatar", () => {
  it("renders the first character of the name", () => {
    render(<HueAvatar name="재원" hue={28} />);
    expect(screen.getByText("재")).toBeInTheDocument();
  });

  it("falls back to email initial when name is absent", () => {
    render(<HueAvatar email="jaewon@example.com" hue={28} />);
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("uses neutral tone when hue is omitted", () => {
    render(<HueAvatar name="X" />);
    const el = screen.getByText("X");
    expect(el.className).toContain("bg-muted");
  });
});
