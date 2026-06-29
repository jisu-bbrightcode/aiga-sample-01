import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SetSection } from "@repo/ui/settings/SetSection";

describe("SetSection", () => {
  it("renders title and children", () => {
    render(
      <SetSection title="제목">
        <div>본문</div>
      </SetSection>,
    );
    expect(screen.getByText("제목")).toBeInTheDocument();
    expect(screen.getByText("본문")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <SetSection title="제목" description="설명 텍스트">
        <span />
      </SetSection>,
    );
    expect(screen.getByText("설명 텍스트")).toBeInTheDocument();
  });

  it("renders action slot when provided", () => {
    render(
      <SetSection title="제목" action={<button type="button">+ 추가</button>}>
        <span />
      </SetSection>,
    );
    expect(screen.getByRole("button", { name: "+ 추가" })).toBeInTheDocument();
  });
});
