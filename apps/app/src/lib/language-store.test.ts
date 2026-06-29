import { detectNavigatorLanguage } from "@repo/core/i18n";
import { afterEach, describe, expect, it } from "vitest";

const originalNavigator = window.navigator;

function stubNavigator(languages?: readonly string[], language?: string) {
  const stub: { languages?: readonly string[]; language?: string } = {};
  if (languages !== undefined) stub.languages = languages;
  if (language !== undefined) stub.language = language;
  Object.defineProperty(window, "navigator", {
    value: stub,
    configurable: true,
  });
}

describe("detectNavigatorLanguage", () => {
  afterEach(() => {
    Object.defineProperty(window, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  });

  it.each([
    [["ko-KR"], "ko"],
    [["en-US"], "en"],
    [["en"], "en"],
    [["ja-JP"], "ja"],
    [["zh-CN"], "zh"],
    [["zh-Hant"], "zh"],
  ])("maps %j to %s", (languages, expected) => {
    stubNavigator(languages);
    expect(detectNavigatorLanguage()).toBe(expected);
  });

  it("falls back to en for unsupported locale", () => {
    stubNavigator(["xx-XX"]);
    expect(detectNavigatorLanguage()).toBe("en");
  });

  it("uses navigator.language when navigator.languages is missing", () => {
    stubNavigator(undefined, "ja-JP");
    expect(detectNavigatorLanguage()).toBe("ja");
  });

  it("falls back to en when both languages and language are empty", () => {
    stubNavigator([], "");
    expect(detectNavigatorLanguage()).toBe("en");
  });
});
