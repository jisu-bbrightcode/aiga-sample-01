import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOCTOR_SORT,
  type DoctorSearchFilters,
  hasActiveSearch,
  parseDoctorSearch,
  toDoctorListParams,
  toDoctorSearchParams,
} from "./doctor-search-params";

describe("parseDoctorSearch", () => {
  it("normalizes keyword and filter ids, trimming and dropping empties", () => {
    const filters = parseDoctorSearch({
      q: "  김의사 ",
      specialty: "spec-1",
      region: "  ",
      sort: "rating",
    });
    expect(filters).toEqual({
      q: "김의사",
      specialtyId: "spec-1",
      regionId: undefined,
      sort: "rating",
    });
  });

  it("falls back to the default sort for missing or unknown values", () => {
    expect(parseDoctorSearch(undefined).sort).toBe(DEFAULT_DOCTOR_SORT);
    expect(parseDoctorSearch({ sort: "bogus" }).sort).toBe(DEFAULT_DOCTOR_SORT);
    expect(parseDoctorSearch({ sort: 42 }).sort).toBe(DEFAULT_DOCTOR_SORT);
  });

  it("ignores non-string fields without throwing", () => {
    const filters = parseDoctorSearch({ q: 123, specialty: null, region: {} });
    expect(filters).toEqual({
      q: undefined,
      specialtyId: undefined,
      regionId: undefined,
      sort: DEFAULT_DOCTOR_SORT,
    });
  });
});

describe("toDoctorSearchParams", () => {
  it("omits empty values and the default sort for a clean URL", () => {
    const filters: DoctorSearchFilters = { sort: DEFAULT_DOCTOR_SORT };
    expect(toDoctorSearchParams(filters)).toEqual({
      q: undefined,
      specialty: undefined,
      region: undefined,
      sort: undefined,
    });
  });

  it("round-trips a populated filter set through parse", () => {
    const filters: DoctorSearchFilters = {
      q: "강남",
      specialtyId: "spec-2",
      regionId: "region-9",
      sort: "rating",
    };
    expect(parseDoctorSearch(toDoctorSearchParams(filters))).toEqual(filters);
  });
});

describe("toDoctorListParams", () => {
  it("maps `recommended` onto the featured ordering lever", () => {
    expect(toDoctorListParams({ sort: "recommended" })).toEqual({
      q: undefined,
      specialtyId: undefined,
      regionId: undefined,
      featured: true,
      limit: 12,
    });
  });

  it("maps `rating` by omitting featured (server orders by ratingAvg desc)", () => {
    const params = toDoctorListParams(
      { q: "x", specialtyId: "s", regionId: "r", sort: "rating" },
      24,
    );
    expect(params).toEqual({
      q: "x",
      specialtyId: "s",
      regionId: "r",
      featured: undefined,
      limit: 24,
    });
  });
});

describe("hasActiveSearch", () => {
  it("is false only when no keyword or filter narrows the catalog", () => {
    expect(hasActiveSearch({ sort: "recommended" })).toBe(false);
    expect(hasActiveSearch({ sort: "rating" })).toBe(false);
    expect(hasActiveSearch({ q: "a", sort: "recommended" })).toBe(true);
    expect(hasActiveSearch({ specialtyId: "s", sort: "recommended" })).toBe(true);
    expect(hasActiveSearch({ regionId: "r", sort: "recommended" })).toBe(true);
  });
});
