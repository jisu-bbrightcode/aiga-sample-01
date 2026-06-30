import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UnifiedSearchFilters } from "../lib/unified-search-params";
import { UnifiedSearchControls } from "./unified-search-controls";

// Identity translator so assertions read mapped i18n KEYS deterministically.
vi.mock("@repo/core/i18n", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useFeatureTranslation: () => ({ t: (key: string) => key }) };
});

function setup(filters: UnifiedSearchFilters) {
  const onChange = vi.fn();
  render(<UnifiedSearchControls filters={filters} onChange={onChange} />);
  return { onChange };
}

describe("UnifiedSearchControls", () => {
  it("commits the keyword on submit, preserving the other filters", () => {
    const { onChange } = setup({ type: "hospital", sort: "rating" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  내과 " } });
    fireEvent.click(screen.getByText("serviceFlow.unifiedSearch.submit"));
    expect(onChange).toHaveBeenCalledWith({ type: "hospital", sort: "rating", q: "내과" });
  });

  it("clears the keyword to undefined when submitting an empty box", () => {
    const { onChange } = setup({ q: "old", sort: "relevance" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "   " } });
    fireEvent.click(screen.getByText("serviceFlow.unifiedSearch.submit"));
    expect(onChange).toHaveBeenCalledWith({ sort: "relevance", q: undefined });
  });

  it("hides the reset action when no filter or non-default sort is active", () => {
    setup({ sort: "relevance" });
    expect(screen.queryByText("serviceFlow.unifiedSearch.reset")).not.toBeInTheDocument();
  });

  it("resets to the default filter set when a filter is active", () => {
    const { onChange } = setup({ q: "강남", type: "doctor", sort: "rating" });
    fireEvent.click(screen.getByText("serviceFlow.unifiedSearch.reset"));
    expect(onChange).toHaveBeenCalledWith({ sort: "relevance" });
  });
});
