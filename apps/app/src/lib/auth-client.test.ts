import { beforeEach, describe, expect, it, vi } from "vitest";

const initAuthClientMock = vi.hoisted(() => vi.fn(() => ({ client: true })));

vi.mock("@repo/core/auth", () => ({
  initAuthClient: initAuthClientMock,
}));

describe("app auth client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    initAuthClientMock.mockClear();
  });

  it("uses VITE_API_URL for auth requests when configured", async () => {
    vi.stubEnv("VITE_API_URL", "https://product-builder-api.example.com");

    await import("./auth-client");

    expect(initAuthClientMock).toHaveBeenCalledWith("https://product-builder-api.example.com");
  });

  it("falls back to same-origin auth requests when VITE_API_URL is empty", async () => {
    vi.stubEnv("VITE_API_URL", "");

    await import("./auth-client");

    expect(initAuthClientMock).toHaveBeenCalledWith("");
  });
});
