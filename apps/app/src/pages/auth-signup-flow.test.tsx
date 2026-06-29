import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../lib/feature-i18n";
import { AcceptInvitationPage } from "./accept-invitation";
import { useRequireActiveWorkspace } from "./auth/use-require-active-workspace";
import { CreateWorkspacePage } from "./create-workspace";
import { MagicLinkPage } from "./magic-link";
import { ResetPasswordPage } from "./reset-password";
import { SignInPage } from "./sign-in";
import { SignUpPage } from "./sign-up";
import { WorkspaceSelectPage } from "./workspace-select";

// navigate() in production returns a Promise (TanStack Router). Production
// code calls `.catch()` on it, so the mock must resolve a Promise too —
// vi.fn()'s default `undefined` triggers "Cannot read properties of undefined
// (reading 'catch')".
const navigateMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const signInEmailMock = vi.hoisted(() => vi.fn());
const signUpEmailMock = vi.hoisted(() => vi.fn());
const sendVerificationEmailMock = vi.hoisted(() => vi.fn());
const signInSocialMock = vi.hoisted(() => vi.fn());
const signInOauth2Mock = vi.hoisted(() => vi.fn());
const signInMagicLinkMock = vi.hoisted(() => vi.fn());
const requestPasswordResetMock = vi.hoisted(() => vi.fn());
const resetPasswordMock = vi.hoisted(() => vi.fn());
const useSessionMock = vi.hoisted(() => vi.fn());
const useListOrganizationsMock = vi.hoisted(() => vi.fn());
const sessionRefetchMock = vi.hoisted(() => vi.fn());
const organizationsRefetchMock = vi.hoisted(() => vi.fn());
const setActiveOrganizationMock = vi.hoisted(() => vi.fn());
const createOrganizationMock = vi.hoisted(() => vi.fn());
const inviteMemberMock = vi.hoisted(() => vi.fn());
const acceptInvitationMock = vi.hoisted(() => vi.fn());
const createProjectMutateMock = vi.hoisted(() => vi.fn());
const completeOnboardingMutateMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@lottiefiles/dotlottie-react", () => ({
  DotLottieReact: (props: { src?: string }) => (
    <span data-src={props.src} data-testid="dotlottie" />
  ),
}));

vi.mock("../lib/auth-client", () => ({
  authClient: {
    signUp: { email: signUpEmailMock },
    signIn: {
      email: signInEmailMock,
      magicLink: signInMagicLinkMock,
      social: signInSocialMock,
      oauth2: signInOauth2Mock,
    },
    sendVerificationEmail: sendVerificationEmailMock,
    requestPasswordReset: requestPasswordResetMock,
    resetPassword: resetPasswordMock,
    useSession: useSessionMock,
    useListOrganizations: useListOrganizationsMock,
    organization: {
      setActive: setActiveOrganizationMock,
      create: createOrganizationMock,
      inviteMember: inviteMemberMock,
      acceptInvitation: acceptInvitationMock,
    },
  },
}));

vi.mock("@/features/project/hooks/use-project-mutations", () => ({
  useCreateProject: () => ({
    mutate: createProjectMutateMock,
    isPending: false,
  }),
}));

vi.mock("@/features/onboarding/hooks/use-onboarding", () => ({
  useCompleteOnboarding: () => ({
    mutate: completeOnboardingMutateMock,
    isPending: false,
  }),
}));

describe("auth flow", () => {
  beforeEach(async () => {
    navigateMock.mockClear();
    signInEmailMock.mockReset();
    signUpEmailMock.mockReset();
    sendVerificationEmailMock.mockReset();
    signInSocialMock.mockClear();
    signInOauth2Mock.mockClear();
    signInMagicLinkMock.mockReset();
    requestPasswordResetMock.mockReset();
    resetPasswordMock.mockReset();
    sessionRefetchMock.mockReset();
    organizationsRefetchMock.mockReset();
    setActiveOrganizationMock.mockReset();
    createOrganizationMock.mockReset();
    inviteMemberMock.mockReset();
    acceptInvitationMock.mockReset();
    createProjectMutateMock.mockReset();
    completeOnboardingMutateMock.mockReset();
    useSessionMock.mockReturnValue({
      data: {
        user: { id: "u1", email: "writer@studio.com", name: "Jane Writer" },
        session: { activeOrganizationId: null },
      },
      isPending: false,
      refetch: sessionRefetchMock,
    });
    useListOrganizationsMock.mockReturnValue({
      data: [],
      isPending: false,
      refetch: organizationsRefetchMock,
    });
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    await i18n.changeLanguage("en");
  });

  it("renders the sign-in screen with English copy by default", () => {
    render(<SignInPage />);

    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue with Naver" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue with Kakao" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue with LinkedIn" }),
    ).not.toBeInTheDocument();
  });

  it("signs in existing users with email and password", async () => {
    signInEmailMock.mockResolvedValue({
      data: {
        token: "session-token",
        user: { id: "u1", email: "writer@studio.com", name: "Jane Writer" },
      },
      error: null,
    });

    render(<SignInPage />);

    await userEvent.type(screen.getByLabelText("Email"), "writer@studio.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(signInEmailMock).toHaveBeenCalledWith({
        email: "writer@studio.com",
        password: "password123",
      });
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: "/" });
  });

  it("preserves an invitation callback after email sign-in", async () => {
    signInEmailMock.mockResolvedValue({
      data: {
        token: "session-token",
        user: { id: "u1", email: "teammate@studio.com", name: "Team Mate" },
      },
      error: null,
    });
    window.history.replaceState({}, "", "/sign-in?next=/accept-invitation%3Fid%3Dinvitation-1");

    render(<SignInPage />);

    await userEvent.type(screen.getByLabelText("Email"), "teammate@studio.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/accept-invitation?id=invitation-1" });
    });
  });

  it("localizes sign-in auth error codes instead of rendering server messages", async () => {
    await i18n.changeLanguage("ko");
    signInEmailMock.mockResolvedValue({
      data: null,
      error: {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      },
    });

    render(<SignInPage />);

    await userEvent.type(screen.getByLabelText("이메일"), "writer@studio.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(
      await screen.findByText("이메일 또는 비밀번호가 올바르지 않습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Invalid email or password")).not.toBeInTheDocument();
  });

  it("keeps Google OAuth connected on the sign-in and signup screens", async () => {
    render(<SignInPage />);
    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(signInSocialMock).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "http://localhost:3000/",
    });

    signInSocialMock.mockClear();
    render(<SignUpPage />);
    await userEvent.click(screen.getByRole("button", { name: "Sign up with Google" }));

    expect(signInSocialMock).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "http://localhost:3000/workspace-select?next=/onboarding",
    });
  });

  it("requests a magic link from the sign-in screen", async () => {
    signInMagicLinkMock.mockResolvedValue({ data: { status: true }, error: null });

    render(<SignInPage />);

    await userEvent.type(screen.getByLabelText("Email"), "magic@studio.com");
    await userEvent.click(screen.getByRole("button", { name: "Email me a magic link" }));

    await waitFor(() => {
      expect(signInMagicLinkMock).toHaveBeenCalledWith({
        email: "magic@studio.com",
        callbackURL: "http://localhost:3000/",
        errorCallbackURL: "http://localhost:3000/sign-in",
      });
    });
    expect(sessionStorage.getItem("product-builder.auth.email")).toBe("magic@studio.com");
    expect(sessionStorage.getItem("product-builder.auth.notice")).toBe("magic-link");
    expect(navigateMock).toHaveBeenCalledWith({ to: "/magic-link" });
  });

  it("renders the signup screen with Korean copy when the locale is ko", async () => {
    await i18n.changeLanguage("ko");

    render(<SignUpPage />);

    expect(screen.getByRole("heading", { name: "새 이야기를 시작하세요" })).toBeInTheDocument();
    expect(screen.getByLabelText("표시 이름")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계정 만들기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "네이버로 계속하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "카카오로 계속하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "LinkedIn으로 계속하기" })).not.toBeInTheDocument();
  });

  it("sends successful email signup users to the email verification notice", async () => {
    signUpEmailMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });

    render(<SignUpPage />);

    await userEvent.type(screen.getByLabelText("Display name"), "Jane Writer");
    await userEvent.type(screen.getByLabelText("Work email"), "new@studio.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByLabelText("I agree to the Terms and Privacy Policy."));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUpEmailMock).toHaveBeenCalledWith({
        name: "Jane Writer",
        email: "new@studio.com",
        password: "password123",
        callbackURL: "http://localhost:3000/workspace-select?next=/onboarding",
      });
    });
    expect(sessionStorage.getItem("product-builder.auth.email")).toBe("new@studio.com");
    expect(sessionStorage.getItem("product-builder.auth.notice")).toBe("verify-email");
    expect(navigateMock).toHaveBeenCalledWith({ to: "/magic-link" });
    expect(navigateMock).not.toHaveBeenCalledWith({ to: "/onboarding" });
  });

  it("shows a localized duplicate email error on signup", async () => {
    signUpEmailMock.mockResolvedValue({
      data: null,
      error: {
        code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
        message: "User already exists. Use another email.",
      },
    });

    render(<SignUpPage />);

    await userEvent.type(screen.getByLabelText("Display name"), "Jane Writer");
    await userEvent.type(screen.getByLabelText("Work email"), "highread@gmail.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByLabelText("I agree to the Terms and Privacy Policy."));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("That email is already registered. Sign in or use another email."),
    ).toBeInTheDocument();
    expect(screen.queryByText("User already exists. Use another email.")).not.toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("renders the verification notice with the signup email", () => {
    sessionStorage.setItem("product-builder.auth.email", "new@studio.com");
    sessionStorage.setItem("product-builder.auth.notice", "verify-email");

    render(<MagicLinkPage />);

    expect(screen.getByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText("new@studio.com")).toBeInTheDocument();
    expect(screen.getByText(/We sent a verification link/)).toBeInTheDocument();
  });

  it("resends the verification email from the verification notice", async () => {
    sendVerificationEmailMock.mockResolvedValue({ data: {}, error: null });
    sessionStorage.setItem("product-builder.auth.email", "new@studio.com");
    sessionStorage.setItem("product-builder.auth.notice", "verify-email");

    render(<MagicLinkPage />);

    await userEvent.click(screen.getByRole("button", { name: "Resend link" }));

    await waitFor(() => {
      expect(sendVerificationEmailMock).toHaveBeenCalledWith({
        email: "new@studio.com",
        callbackURL: "http://localhost:3000/workspace-select?next=/onboarding",
      });
    });
    expect(screen.getByRole("button", { name: "Link sent" })).toBeDisabled();
  });

  it("selects an existing workspace before entering the app", async () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { id: "u1", email: "writer@studio.com", name: "Jane Writer" },
        session: { activeOrganizationId: null },
      },
      isPending: false,
      refetch: sessionRefetchMock,
    });
    useListOrganizationsMock.mockReturnValue({
      data: [
        {
          id: "org-aethys",
          name: "Aethys Saga",
          metadata: { role: "Owner", memberCount: 4, plan: "Pro", storyCount: 127 },
        },
      ],
      isPending: false,
      refetch: organizationsRefetchMock,
    });
    setActiveOrganizationMock.mockResolvedValue({ data: { id: "org-aethys" }, error: null });

    render(<WorkspaceSelectPage />);

    expect(screen.getByRole("heading", { name: "Pick a workspace" })).toBeInTheDocument();
    expect(screen.getByText("Aethys Saga")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(setActiveOrganizationMock).toHaveBeenCalledWith({ organizationId: "org-aethys" });
    });
    expect(sessionRefetchMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({ to: "/" });
  });

  it("uses the quiet loader while workspace data is pending", () => {
    useListOrganizationsMock.mockReturnValue({
      data: [],
      isPending: true,
      refetch: organizationsRefetchMock,
    });

    render(<WorkspaceSelectPage />);

    expect(screen.getByRole("status", { name: "Loading workspaces..." })).toBeInTheDocument();
    expect(screen.getByText("Loading workspaces...")).toBeInTheDocument();
    expect(screen.queryByTestId("dotlottie")).not.toBeInTheDocument();
  });

  it("keeps the continue action reachable when the user belongs to many workspaces", () => {
    useListOrganizationsMock.mockReturnValue({
      data: Array.from({ length: 24 }, (_, index) => ({
        id: `org-${index}`,
        name: `Workspace ${index + 1}`,
        metadata: { role: "Member", memberCount: index + 1, plan: "Team" },
      })),
      isPending: false,
      refetch: organizationsRefetchMock,
    });

    const { container } = render(<WorkspaceSelectPage />);
    const list = container.querySelector('[data-el="workspace.list"]');

    expect(list).toHaveClass("overflow-y-auto");
    expect(list).toHaveClass("max-h-[min(360px,44dvh)]");
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("creates a workspace from the workspace picker for first-time users", async () => {
    window.history.replaceState({}, "", "/workspace-select?next=/onboarding");

    render(<WorkspaceSelectPage />);

    await userEvent.click(screen.getByRole("button", { name: /Create a new workspace/ }));

    expect(createOrganizationMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/create-workspace",
      search: { next: "/onboarding" },
    });
  });

  it("creates a workspace from the dedicated workspace creation wizard", async () => {
    createOrganizationMock.mockResolvedValue({
      data: { id: "org-new", name: "Aethys Saga", slug: "aethys-saga" },
      error: null,
    });
    setActiveOrganizationMock.mockResolvedValue({ data: { id: "org-new" }, error: null });
    completeOnboardingMutateMock.mockImplementation((_input, options) => options?.onSuccess?.());
    window.history.replaceState({}, "", "/create-workspace?next=/onboarding");

    render(<CreateWorkspacePage />);

    expect(screen.getByRole("heading", { name: "Name your workspace" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Workspace name"), "Aethys Saga");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(createOrganizationMock).toHaveBeenCalledWith({
        name: "Aethys Saga",
        slug: "aethys-saga",
      });
    });
    expect(setActiveOrganizationMock).toHaveBeenCalledWith({ organizationId: "org-new" });
    expect(organizationsRefetchMock).toHaveBeenCalled();
    expect(sessionRefetchMock).toHaveBeenCalled();

    await screen.findByRole("heading", { name: "Bring your team" });
    const inviteEmailInput = screen.getAllByLabelText("Invite email")[0];
    expect(inviteEmailInput).toBeDefined();
    if (inviteEmailInput) {
      await userEvent.type(inviteEmailInput, "teammate@studio.com");
    }
    await userEvent.click(screen.getByRole("button", { name: "Send invites" }));

    await waitFor(() => {
      expect(inviteMemberMock).toHaveBeenCalledWith({
        organizationId: "org-new",
        email: "teammate@studio.com",
        role: "member",
      });
    });

    await screen.findByRole("heading", { name: "Create your first project" });
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(completeOnboardingMutateMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({ to: "/" });
  });

  it("keeps users on the invite step when workspace invitation sending fails", async () => {
    createOrganizationMock.mockResolvedValue({
      data: { id: "org-new", name: "Aethys Saga", slug: "aethys-saga" },
      error: null,
    });
    setActiveOrganizationMock.mockResolvedValue({ data: { id: "org-new" }, error: null });
    inviteMemberMock.mockResolvedValue({
      data: null,
      error: { code: "INVITATION_EMAIL_FAILED", message: "Email delivery failed" },
    });
    window.history.replaceState({}, "", "/create-workspace?next=/onboarding");

    render(<CreateWorkspacePage />);

    await userEvent.type(screen.getByLabelText("Workspace name"), "Aethys Saga");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Bring your team" });

    const inviteEmailInput = screen.getAllByLabelText("Invite email")[0];
    expect(inviteEmailInput).toBeDefined();
    if (inviteEmailInput) {
      await userEvent.type(inviteEmailInput, "teammate@studio.com");
    }
    await userEvent.click(screen.getByRole("button", { name: "Send invites" }));

    await waitFor(() => {
      expect(inviteMemberMock).toHaveBeenCalledWith({
        organizationId: "org-new",
        email: "teammate@studio.com",
        role: "member",
      });
    });
    expect(await screen.findByText("Could not send invites. Try again later.")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Create your first project" }),
    ).not.toBeInTheDocument();
  });

  it("creates a first project from the workspace creation wizard", async () => {
    createOrganizationMock.mockResolvedValue({
      data: { id: "org-new", name: "Aethys Saga", slug: "aethys-saga" },
      error: null,
    });
    setActiveOrganizationMock.mockResolvedValue({ data: { id: "org-new" }, error: null });
    createProjectMutateMock.mockImplementation((_input, options) =>
      options?.onSuccess?.({ id: "project-1" }),
    );
    window.history.replaceState({}, "", "/create-workspace");

    render(<CreateWorkspacePage />);

    await userEvent.type(screen.getByLabelText("Workspace name"), "Aethys Saga");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Bring your team" });
    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    await screen.findByRole("heading", { name: "Create your first project" });
    await userEvent.type(screen.getByLabelText("Project name"), "Episode 1");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(createProjectMutateMock).toHaveBeenCalledWith(
      {
        name: "Episode 1",
        genre: undefined,
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    );
    expect(completeOnboardingMutateMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({ to: "/" });
  });

  it("accepts an organization invitation from the email link", async () => {
    acceptInvitationMock.mockResolvedValue({
      data: {
        invitation: { id: "invitation-1", organizationId: "org-new", status: "accepted" },
        member: { id: "member-1" },
      },
      error: null,
    });
    window.history.replaceState({}, "", "/accept-invitation?id=invitation-1");

    render(<AcceptInvitationPage />);

    expect(
      screen.getByRole("heading", { name: "Accept workspace invitation" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Accept invitation" }));

    await waitFor(() => {
      expect(acceptInvitationMock).toHaveBeenCalledWith({ invitationId: "invitation-1" });
    });
    expect(sessionRefetchMock).toHaveBeenCalled();
    expect(organizationsRefetchMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({ to: "/" });
  });

  it("sends signed-out invited users to sign in with the invitation callback", async () => {
    useSessionMock.mockReturnValue({
      data: null,
      isPending: false,
      refetch: sessionRefetchMock,
    });
    window.history.replaceState({}, "", "/accept-invitation?id=invitation-1");

    render(<AcceptInvitationPage />);

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(navigateMock).toHaveBeenCalledWith({
      to: "/sign-in",
      search: { next: "/accept-invitation?id=invitation-1" },
    });
  });

  it("redirects authenticated users without an active workspace", async () => {
    function WorkspaceGuardProbe() {
      const { needsWorkspace } = useRequireActiveWorkspace(true);
      return <span>{needsWorkspace ? "needs workspace" : "ready"}</span>;
    }

    render(<WorkspaceGuardProbe />);

    expect(screen.getByText("needs workspace")).toBeInTheDocument();
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/workspace-select" });
    });
  });

  it("resends a magic login link from the magic-link notice", async () => {
    signInMagicLinkMock.mockResolvedValue({ data: { status: true }, error: null });
    sessionStorage.setItem("product-builder.auth.email", "magic@studio.com");
    sessionStorage.setItem("product-builder.auth.notice", "magic-link");

    render(<MagicLinkPage />);

    await userEvent.click(screen.getByRole("button", { name: "Resend link" }));

    await waitFor(() => {
      expect(signInMagicLinkMock).toHaveBeenCalledWith({
        email: "magic@studio.com",
        callbackURL: "http://localhost:3000/",
        errorCallbackURL: "http://localhost:3000/sign-in",
      });
    });
    expect(screen.getByRole("button", { name: "Link sent" })).toBeDisabled();
  });

  it("requests a real password reset link from the forgot-password screen", async () => {
    requestPasswordResetMock.mockResolvedValue({
      data: { status: true, message: "sent" },
      error: null,
    });

    const { ForgotPasswordPage } = await import("./forgot-password");
    render(<ForgotPasswordPage />);

    await userEvent.type(screen.getByLabelText("Email"), "reset@studio.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(requestPasswordResetMock).toHaveBeenCalledWith({
        email: "reset@studio.com",
        redirectTo: "http://localhost:3000/reset-password",
      });
    });
    expect(screen.getByText("We sent a reset link to reset@studio.com.")).toBeInTheDocument();
  });

  it("resets the password with the token from the reset-password URL", async () => {
    resetPasswordMock.mockResolvedValue({ data: { status: true }, error: null });
    window.history.replaceState({}, "", "/reset-password?token=reset-token-1");

    render(<ResetPasswordPage />);

    await userEvent.type(screen.getByLabelText("New password"), "newpassword123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "newpassword123");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(resetPasswordMock).toHaveBeenCalledWith({
        newPassword: "newpassword123",
        token: "reset-token-1",
      });
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: "/sign-in" });
  });
});
