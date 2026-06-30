import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServiceFlowError } from "../api/service-flow-api";
import type { SelfUser } from "../api/types";
import { MembershipSection } from "./membership-section";

// Identity translator: assert against i18n KEYS (deterministic) while keeping the
// real code→key error mapping intact. Interpolated values are appended so the
// limit value test can assert the count made it through.
vi.mock("@repo/core/i18n", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useFeatureTranslation: () => ({
      t: (key: string, vars?: Record<string, unknown>) =>
        vars ? `${key}:${JSON.stringify(vars)}` : key,
    }),
  };
});

// Control the /users/me query state per test.
const useMe = vi.fn();
vi.mock("../hooks/queries", () => ({ useMe: (enabled: boolean) => useMe(enabled) }));

function mockMe(state: Record<string, unknown>) {
  useMe.mockReturnValue({ refetch: vi.fn(), ...state });
}

const grade = (over: Partial<SelfUser["grade"] & object> = {}) =>
  ({ id: "g1", slug: "basic", name: "Basic", ...over }) as NonNullable<SelfUser["grade"]>;

const withGrade = (g: NonNullable<SelfUser["grade"]>): { data: SelfUser } => ({
  data: {
    id: "u1",
    handle: null,
    name: "Kim",
    bio: null,
    avatar: null,
    grade: g,
    joinedAt: null,
    email: "k@example.com",
    authProvider: "google",
    isActive: true,
    marketingConsentAt: null,
    updatedAt: null,
  },
});

describe("MembershipSection", () => {
  it("shows the loading indicator while /users/me is pending", () => {
    mockMe({ isPending: true, isError: false });
    render(<MembershipSection enabled={true} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("maps a 401 to the re-login copy — never the raw error (권한 없음 branch)", () => {
    mockMe({ isPending: false, isError: true, error: new ServiceFlowError("UNAUTHORIZED", 401) });
    render(<MembershipSection enabled={true} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("errors.unauthorized");
    expect(alert).not.toHaveTextContent("401");
  });

  it("renders the empty state when no grade is assigned", () => {
    mockMe({ isPending: false, isError: false, data: { grade: null } });
    render(<MembershipSection enabled={true} />);
    expect(screen.getByText("serviceFlow.membership.empty")).toBeInTheDocument();
  });

  it("shows the grade name and the generic 한도 note when the cap is not in the contract", () => {
    mockMe({ isPending: false, isError: false, ...withGrade(grade()) });
    render(<MembershipSection enabled={true} />);
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("serviceFlow.membership.limitNote")).toBeInTheDocument();
  });

  it("renders the concrete daily cap when the contract provides it", () => {
    mockMe({ isPending: false, isError: false, ...withGrade(grade({ dailyUsageLimit: 20 })) });
    render(<MembershipSection enabled={true} />);
    expect(screen.getByText(/serviceFlow\.membership\.limitValue.*20/)).toBeInTheDocument();
  });

  it("renders 무제한 when the cap is null (unlimited grade)", () => {
    mockMe({ isPending: false, isError: false, ...withGrade(grade({ dailyUsageLimit: null })) });
    render(<MembershipSection enabled={true} />);
    expect(screen.getByText("serviceFlow.membership.limitUnlimited")).toBeInTheDocument();
  });
});
