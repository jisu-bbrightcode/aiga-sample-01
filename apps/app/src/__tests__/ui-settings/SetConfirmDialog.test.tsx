import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SetConfirmDialog } from "@repo/ui/settings/SetConfirmDialog";

describe("SetConfirmDialog", () => {
  it("disables confirm until phrase matches", () => {
    const onConfirm = vi.fn();
    render(
      <SetConfirmDialog
        open
        onOpenChange={() => {}}
        title="조직 삭제"
        confirmPhrase="DELETE-bright"
        onConfirm={onConfirm}
      />,
    );
    const button = screen.getByRole("button", { name: "삭제" });
    expect(button).toBeDisabled();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "DELETE-bright" } });
    expect(button).not.toBeDisabled();
  });

  it("calls onConfirm only when phrase matches and button clicked", () => {
    const onConfirm = vi.fn();
    render(
      <SetConfirmDialog
        open
        onOpenChange={() => {}}
        title="조직 삭제"
        confirmPhrase="DELETE-bright"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "DELETE-bright" },
    });
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
