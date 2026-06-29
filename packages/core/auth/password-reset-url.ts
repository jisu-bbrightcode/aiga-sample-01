export function buildPasswordResetUrl(authUrl: string, token: string) {
  try {
    const parsedAuthUrl = new URL(authUrl);
    const callbackURL = parsedAuthUrl.searchParams.get("callbackURL");
    if (!callbackURL) return authUrl;

    const appOrigin = process.env.APP_URL || parsedAuthUrl.origin;
    const parsedCallbackUrl = new URL(callbackURL, appOrigin);
    parsedCallbackUrl.searchParams.set("token", token);
    return parsedCallbackUrl.toString();
  } catch {
    return authUrl;
  }
}
