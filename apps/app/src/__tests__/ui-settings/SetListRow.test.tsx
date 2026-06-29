import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SetListRow } from "@repo/ui/settings/SetListRow";

describe("SetListRow", () => {
  it("renders title alone", () => {
    render(<SetListRow title="제목" />);
    expect(screen.getByText("제목")).toBeInTheDocument();
  });

  it("renders leading + title + sub + trailing slots", () => {
    render(
      <SetListRow
        leading={<span>L</span>}
        title="제목"
        sub="부제"
        trailing={<button type="button">T</button>}
      />,
    );
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("제목")).toBeInTheDocument();
    expect(screen.getByText("부제")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "T" })).toBeInTheDocument();
  });
});
