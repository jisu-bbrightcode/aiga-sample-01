import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicRegion, PublicSpecialty } from "../api/types";
import type { DoctorSearchFilters } from "../lib/doctor-search-params";
import { DoctorSearchControls } from "./doctor-search-controls";

// Identity translator so assertions read mapped i18n KEYS deterministically.
vi.mock("@repo/core/i18n", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useFeatureTranslation: () => ({ t: (key: string) => key }) };
});

const specialties: PublicSpecialty[] = [{ id: "s1", name: "내과", slug: "internal", sortOrder: 0 }];
const regions: PublicRegion[] = [
  { id: "r1", name: "서울", slug: "seoul", parentId: null, sortOrder: 0 },
];

function setup(filters: DoctorSearchFilters) {
  const onChange = vi.fn();
  render(
    <DoctorSearchControls
      filters={filters}
      specialties={specialties}
      regions={regions}
      onChange={onChange}
    />,
  );
  return { onChange };
}

describe("DoctorSearchControls", () => {
  it("commits the keyword on submit, preserving the other filters", () => {
    const { onChange } = setup({ specialtyId: "s1", sort: "rating" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  김의사 " } });
    fireEvent.click(screen.getByText("serviceFlow.search.submit"));
    expect(onChange).toHaveBeenCalledWith({ specialtyId: "s1", sort: "rating", q: "김의사" });
  });

  it("clears the keyword to undefined when submitting an empty box", () => {
    const { onChange } = setup({ q: "old", sort: "recommended" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "   " } });
    fireEvent.click(screen.getByText("serviceFlow.search.submit"));
    expect(onChange).toHaveBeenCalledWith({ sort: "recommended", q: undefined });
  });

  it("hides the reset action when no filter or non-default sort is active", () => {
    setup({ sort: "recommended" });
    expect(screen.queryByText("serviceFlow.search.reset")).not.toBeInTheDocument();
  });

  it("resets to the default filter set when a filter is active", () => {
    const { onChange } = setup({ q: "강남", regionId: "r1", sort: "rating" });
    fireEvent.click(screen.getByText("serviceFlow.search.reset"));
    expect(onChange).toHaveBeenCalledWith({ sort: "recommended" });
  });
});
