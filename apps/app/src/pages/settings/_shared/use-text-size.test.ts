import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTextSize } from "./use-text-size";

// Storage shim is provided by apps/app/src/test/setup.ts.

describe("useTextSize", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.textSize;
  });

  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.textSize;
  });

  it("defaults to 'sm' when nothing is stored", () => {
    const { result } = renderHook(() => useTextSize());
    expect(result.current.size).toBe("sm");
  });

  it("reads existing storage value on first render", () => {
    localStorage.setItem("product-builder:text-size", "lg");
    const { result } = renderHook(() => useTextSize());
    expect(result.current.size).toBe("lg");
  });

  it("setSize('lg') writes localStorage and html attribute", () => {
    const { result } = renderHook(() => useTextSize());
    act(() => result.current.setSize("lg"));
    expect(localStorage.getItem("product-builder:text-size")).toBe("lg");
    expect(document.documentElement.dataset.textSize).toBe("lg");
  });

  it("setSize('md') writes localStorage and html attribute", () => {
    const { result } = renderHook(() => useTextSize());
    act(() => result.current.setSize("md"));
    expect(localStorage.getItem("product-builder:text-size")).toBe("md");
    expect(document.documentElement.dataset.textSize).toBe("md");
  });

  it("setSize('sm') removes the attribute and storage entry", () => {
    localStorage.setItem("product-builder:text-size", "lg");
    document.documentElement.dataset.textSize = "lg";
    const { result } = renderHook(() => useTextSize());
    act(() => result.current.setSize("sm"));
    expect(localStorage.getItem("product-builder:text-size")).toBeNull();
    expect(document.documentElement.dataset.textSize).toBeUndefined();
  });

  it("ignores invalid stored values", () => {
    localStorage.setItem("product-builder:text-size", "huge");
    const { result } = renderHook(() => useTextSize());
    expect(result.current.size).toBe("sm");
  });
});
