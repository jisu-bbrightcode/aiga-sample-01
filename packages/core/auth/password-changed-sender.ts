export interface AuthPasswordChangedUser {
  id?: string;
  email: string;
  name?: string | null;
}

export interface AuthPasswordChangedInput {
  user: AuthPasswordChangedUser;
}

export interface AuthPasswordChangedSender {
  sendPasswordChangedEmail(input: AuthPasswordChangedInput): Promise<void>;
}

let authPasswordChangedSender: AuthPasswordChangedSender | null = null;

export function injectAuthPasswordChangedSender(sender: AuthPasswordChangedSender) {
  authPasswordChangedSender = sender;
}

export function resetAuthPasswordChangedSenderForTests() {
  authPasswordChangedSender = null;
}

export async function sendAuthPasswordChangedEmail(input: AuthPasswordChangedInput) {
  if (authPasswordChangedSender) {
    await authPasswordChangedSender.sendPasswordChangedEmail(input);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Auth password changed sender is not initialized. EmailModule must inject EmailService before auth emails can be sent.",
    );
  }

  console.warn("[auth] Password changed sender is not initialized - email skipped (dev only)", {
    to: input.user.email,
  });
}
