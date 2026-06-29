export interface AuthMagicLinkInput {
  email: string;
  token: string;
  url: string;
}

export interface AuthMagicLinkSender {
  sendMagicLinkEmail(input: AuthMagicLinkInput): Promise<void>;
}

let authMagicLinkSender: AuthMagicLinkSender | null = null;

export function injectAuthMagicLinkSender(sender: AuthMagicLinkSender) {
  authMagicLinkSender = sender;
}

export function resetAuthMagicLinkSenderForTests() {
  authMagicLinkSender = null;
}

export async function sendAuthMagicLinkEmail(input: AuthMagicLinkInput) {
  if (authMagicLinkSender) {
    await authMagicLinkSender.sendMagicLinkEmail(input);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Auth magic link sender is not initialized. EmailModule must inject EmailService before auth emails can be sent.",
    );
  }

  console.warn("[auth] Magic link sender is not initialized - email skipped (dev only)", {
    to: input.email,
  });
}
