import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GatedActionButton } from "./gated-action-button";

const navigateMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const storeIntentMock = vi.hoisted(() => vi.fn());
const saveMutateMock = vi.hoisted(() => vi.fn());
const interestMutateMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ value: false as boolean }));

vi.mock("@repo/core/auth", () => ({ authenticatedAtom: Symbol("authenticatedAtom") }));
vi.mock("@repo/core/i18n", () => ({
  useFeatureTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigateMock }));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));
vi.mock("jotai", () => ({ useAtomValue: () => authState.value }));
vi.mock("@/lib/auth-next-path", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, getCurrentAuthPath: () => "/explore" };
});
vi.mock("@/lib/user-facing-error", () => ({ getAppErrorMessage: () => "ERR" }));
vi.mock("../hooks/mutations", () => ({
  useCreateSavedItem: () => ({ mutate: saveMutateMock, isPending: false }),
  useCreateInterest: () => ({ mutate: interestMutateMock, isPending: false }),
}));
vi.mock("../lib/pending-intent", () => ({ storePendingIntent: storeIntentMock }));

beforeEach(() => {
  navigateMock.mockReset();
  toastSuccessMock.mockReset();
  toastErrorMock.mockReset();
  storeIntentMock.mockReset();
  saveMutateMock.mockReset();
  interestMutateMock.mockReset();
  authState.value = false;
});

describe("GatedActionButton", () => {
  it("logged out → stores the attempted action and routes to sign-in (return-to-intent)", async () => {
    authState.value = false;
    render(<GatedActionButton kind="save" targetType="doctor" targetId="doc-1" label="저장" />);

    await userEvent.click(screen.getByRole("button"));

    expect(storeIntentMock).toHaveBeenCalledWith({
      kind: "save",
      targetType: "doctor",
      targetId: "doc-1",
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: "/sign-in?next=%2Fexplore" });
    expect(saveMutateMock).not.toHaveBeenCalled();
  });

  it("logged in → fires the save write (no gating, no intent stored)", async () => {
    authState.value = true;
    render(<GatedActionButton kind="save" targetType="doctor" targetId="doc-1" label="저장" />);

    await userEvent.click(screen.getByRole("button"));

    expect(saveMutateMock).toHaveBeenCalledTimes(1);
    expect(saveMutateMock.mock.calls[0]?.[0]).toEqual({ targetType: "doctor", targetId: "doc-1" });
    expect(storeIntentMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("interest kind fires the interest write", async () => {
    authState.value = true;
    render(<GatedActionButton kind="interest" targetType="hospital" targetId="h-2" label="관심" />);

    await userEvent.click(screen.getByRole("button"));

    expect(interestMutateMock).toHaveBeenCalledTimes(1);
    expect(interestMutateMock.mock.calls[0]?.[0]).toEqual({
      targetType: "hospital",
      targetId: "h-2",
    });
    expect(saveMutateMock).not.toHaveBeenCalled();
  });
});
