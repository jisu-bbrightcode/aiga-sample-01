import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SetDangerZone } from "@repo/ui/settings/SetDangerZone";

describe("SetDangerZone", () => {
  it("renders title, description, and children", () => {
    render(
      <SetDangerZone title="계정 삭제" description="복구 불가">
        <button type="button">삭제</button>
      </SetDangerZone>,
    );
    expect(screen.getByText("계정 삭제")).toBeInTheDocument();
    expect(screen.getByText("복구 불가")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });
});
