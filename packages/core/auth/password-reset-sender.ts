export interface AuthPasswordResetUser {
  id?: string;
  email: string;
  name?: string | null;
}

export interface AuthPasswordResetInput {
  token: string;
  url: string;
  user: AuthPasswordResetUser;
}

export interface AuthPasswordResetSender {
  sendPasswordResetEmail(input: AuthPasswordResetInput): Promise<void>;
}

let authPasswordResetSender: AuthPasswordResetSender | null = null;

export function injectAuthPasswordResetSender(sender: AuthPasswordResetSender) {
  authPasswordResetSender = sender;
}

export function resetAuthPasswordResetSenderForTests() {
  authPasswordResetSender = null;
}

export async function sendAuthPasswordResetEmail(input: AuthPasswordResetInput) {
  if (authPasswordResetSender) {
    await authPasswordResetSender.sendPasswordResetEmail(input);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Auth password reset sender is not initialized. EmailModule must inject EmailService before auth emails can be sent.",
    );
  }

  console.warn("[auth] Password reset sender is not initialized - email skipped (dev only)", {
    to: input.user.email,
  });
}
