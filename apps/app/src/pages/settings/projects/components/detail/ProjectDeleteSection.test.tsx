import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDeleteSection } from "./ProjectDeleteSection";

const mutateAsyncMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@repo/core/i18n", () => ({
  useFeatureTranslation: () => ({
    t: (key: string) =>
      ({
        "projects.detail.delete.button": "프로젝트 삭제",
        "projects.detail.delete.confirmDescription": "삭제합니다.",
        "projects.detail.delete.confirmTitle": "프로젝트 삭제",
        "projects.detail.delete.dangerDescription": "복구할 수 없습니다.",
        "projects.detail.delete.dangerTitle": "Aethys을(를) 삭제합니다",
        "projects.detail.delete.title": "프로젝트 삭제",
      })[key] ?? key,
  }),
}));

vi.mock("@/features/project/hooks/use-project-mutations", () => ({
  usePermanentlyDeleteProject: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
}));

describe("ProjectDeleteSection", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue({ success: true });
    navigateMock.mockReset();
  });

  it("connects the confirmed delete action to the permanent project delete mutation", async () => {
    render(<ProjectDeleteSection projectId="p1" name="Aethys" />);

    fireEvent.click(screen.getByRole("button", { name: "프로젝트 삭제" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "DELETE-Aethys" },
    });
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith("p1");
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: "/settings" });
  });
});
