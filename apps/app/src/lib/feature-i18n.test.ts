import { afterEach, describe, expect, it, vi } from "vitest";

describe("feature-i18n one-time migration", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.resetModules();
  });

  it("copies atlas_language to language when language is unset", async () => {
    window.localStorage.setItem("atlas_language", "ko");
    await import("./feature-i18n");
    expect(window.localStorage.getItem("language")).toBe("ko");
    expect(window.localStorage.getItem("atlas_language")).toBeNull();
  });

  it("keeps existing language and still drops legacy key", async () => {
    window.localStorage.setItem("atlas_language", "ko");
    window.localStorage.setItem("language", "en");
    await import("./feature-i18n");
    expect(window.localStorage.getItem("language")).toBe("en");
    expect(window.localStorage.getItem("atlas_language")).toBeNull();
  });

  it("is a no-op when neither key is present", async () => {
    await import("./feature-i18n");
    expect(window.localStorage.getItem("language")).toBeNull();
    expect(window.localStorage.getItem("atlas_language")).toBeNull();
  });
});
