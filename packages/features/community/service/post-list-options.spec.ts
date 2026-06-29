import { BadRequestException } from "@nestjs/common";
import { normalizePostListLimit, parsePostSort } from "./post-list-options";

describe("post list options", () => {
  it("defaults and accepts supported sort values", () => {
    expect(parsePostSort(undefined)).toBe("new");
    expect(parsePostSort("hot")).toBe("hot");
    expect(parsePostSort("controversial")).toBe("controversial");
  });

  it("rejects unsupported sort values", () => {
    expect(() => parsePostSort("latest")).toThrow(BadRequestException);
  });

  it("normalizes valid limits and rejects out-of-range values", () => {
    expect(normalizePostListLimit(undefined)).toBe(25);
    expect(normalizePostListLimit(100)).toBe(100);
    expect(() => normalizePostListLimit(0)).toThrow(BadRequestException);
    expect(() => normalizePostListLimit(101)).toThrow(BadRequestException);
  });
});
