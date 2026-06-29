export interface AuthEmailVerificationUser {
  id?: string;
  email: string;
  name?: string | null;
}

export interface AuthEmailVerificationInput {
  user: AuthEmailVerificationUser;
  url: string;
}

export interface AuthEmailVerificationSender {
  sendVerificationEmail(input: AuthEmailVerificationInput): Promise<void>;
}

let authEmailVerificationSender: AuthEmailVerificationSender | null = null;

export function injectAuthEmailVerificationSender(sender: AuthEmailVerificationSender) {
  authEmailVerificationSender = sender;
}

export function resetAuthEmailVerificationSenderForTests() {
  authEmailVerificationSender = null;
}

export async function sendAuthVerificationEmail(input: AuthEmailVerificationInput) {
  if (authEmailVerificationSender) {
    await authEmailVerificationSender.sendVerificationEmail(input);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Auth email verification sender is not initialized. EmailModule must inject EmailService before auth emails can be sent.",
    );
  }

  console.warn("[auth] Email verification sender is not initialized — email skipped (dev only)", {
    to: input.user.email,
  });
}
