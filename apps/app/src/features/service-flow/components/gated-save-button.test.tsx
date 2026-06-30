import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GatedSaveButton } from "./gated-save-button";

const navigateMock = vi.hoisted(() => vi.fn());
const toastInfoMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ value: false as boolean }));

vi.mock("@repo/core/auth", () => ({ authenticatedAtom: Symbol("authenticatedAtom") }));
vi.mock("@repo/core/i18n", () => ({
  useFeatureTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigateMock }));
vi.mock("sonner", () => ({ toast: { info: toastInfoMock } }));
vi.mock("jotai", () => ({ useAtomValue: () => authState.value }));
vi.mock("@/lib/auth-next-path", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getCurrentAuthPath: () => "/explore" };
});

beforeEach(() => {
  navigateMock.mockReset();
  toastInfoMock.mockReset();
  authState.value = false;
});

describe("GatedSaveButton", () => {
  it("logged out → routes to sign-in carrying the current path as next (return-to-intent)", async () => {
    authState.value = false;
    render(<GatedSaveButton label="저장" />);

    await userEvent.click(screen.getByRole("button"));

    expect(navigateMock).toHaveBeenCalledWith({ to: "/sign-in?next=%2Fexplore" });
    expect(toastInfoMock).not.toHaveBeenCalled();
  });

  it("logged in → routes to My Page and acknowledges with a toast", async () => {
    authState.value = true;
    render(<GatedSaveButton label="저장" />);

    await userEvent.click(screen.getByRole("button"));

    expect(navigateMock).toHaveBeenCalledWith({ to: "/me" });
    expect(toastInfoMock).toHaveBeenCalledTimes(1);
  });
});
