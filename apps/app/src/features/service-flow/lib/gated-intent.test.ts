import { describe, expect, it } from "vitest";
import { buildSignInIntentPath } from "./gated-intent";

describe("buildSignInIntentPath", () => {
  it("encodes a same-origin path as the sign-in next param", () => {
    expect(buildSignInIntentPath("/explore")).toBe("/sign-in?next=%2Fexplore");
  });

  it("preserves an existing query string in the intended path", () => {
    expect(buildSignInIntentPath("/explore?spec=cardio")).toBe(
      "/sign-in?next=%2Fexplore%3Fspec%3Dcardio",
    );
  });

  it("degrades to a plain sign-in when the intent is the root path", () => {
    expect(buildSignInIntentPath("/")).toBe("/sign-in");
  });

  it("rejects protocol-relative / off-origin intents (open-redirect guard)", () => {
    expect(buildSignInIntentPath("//evil.example.com")).toBe("/sign-in");
    expect(buildSignInIntentPath("https://evil.example.com")).toBe("/sign-in");
  });

  it("degrades to a plain sign-in for empty/nullish intents", () => {
    expect(buildSignInIntentPath("")).toBe("/sign-in");
    expect(buildSignInIntentPath(null)).toBe("/sign-in");
    expect(buildSignInIntentPath(undefined)).toBe("/sign-in");
  });
});
