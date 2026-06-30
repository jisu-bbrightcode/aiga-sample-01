import { describe, expect, it } from "vitest";
import { formatServiceDate } from "./format-date";

describe("formatServiceDate", () => {
  it("formats as zero-padded YYYY.MM.DD (timezone-independent shape)", () => {
    const iso = "2026-03-09T12:00:00.000Z";
    const d = new Date(iso);
    const expected = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    const out = formatServiceDate(iso);
    expect(out).toBe(expected);
    expect(out).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });

  it("returns an empty string for missing input", () => {
    expect(formatServiceDate(null)).toBe("");
    expect(formatServiceDate(undefined)).toBe("");
    expect(formatServiceDate("")).toBe("");
  });

  it("returns an empty string for an unparseable value (never 'Invalid Date')", () => {
    expect(formatServiceDate("not-a-date")).toBe("");
  });
});
