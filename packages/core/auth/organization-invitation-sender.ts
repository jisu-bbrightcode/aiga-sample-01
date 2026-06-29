export interface AuthOrganizationInvitationRequest {
  url?: string;
  headers?: {
    get(name: string): string | null;
  };
}

export interface AuthOrganizationInvitationInput {
  id: string;
  email: string;
  role: string;
  organization: {
    id: string;
    name: string;
    slug?: string | null;
  };
  inviter: {
    user: {
      id?: string;
      email: string;
      name?: string | null;
    };
  };
  invitation: unknown;
  request?: AuthOrganizationInvitationRequest;
}

export interface AuthOrganizationInvitationSender {
  sendOrganizationInvitationEmail(input: AuthOrganizationInvitationInput): Promise<void>;
}

let authOrganizationInvitationSender: AuthOrganizationInvitationSender | null = null;

export function injectAuthOrganizationInvitationSender(sender: AuthOrganizationInvitationSender) {
  authOrganizationInvitationSender = sender;
}

export function resetAuthOrganizationInvitationSenderForTests() {
  authOrganizationInvitationSender = null;
}

export async function sendAuthOrganizationInvitationEmail(input: AuthOrganizationInvitationInput) {
  if (authOrganizationInvitationSender) {
    await authOrganizationInvitationSender.sendOrganizationInvitationEmail(input);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Auth organization invitation sender is not initialized. EmailModule must inject EmailService before organization invitation emails can be sent.",
    );
  }

  console.warn(
    "[auth] Organization invitation sender is not initialized - email skipped (dev only)",
    {
      to: input.email,
      organizationId: input.organization.id,
      invitationId: input.id,
    },
  );
}
