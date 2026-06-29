import { describe, expect, it } from "vitest";
import {
  buildProjectSearchResults,
  DEFAULT_PROJECT_SEARCH_FIELDS,
  type ProjectSearchSource,
} from "./project-search-index";

const source: ProjectSearchSource = {
  projectId: "project-1",
  worlds: [
    {
      id: "world-1",
      name: "Aethys",
      description: "A realm built around a hidden moon atlas.",
      genre: "dark fantasy",
      updatedAt: "2026-05-08T09:00:00.000Z",
    },
  ],
  characters: [
    {
      id: "character-1",
      name: "Mira Vale",
      description: "Royal investigator",
      personality: "stoic",
      updatedAt: "2026-05-01T09:00:00.000Z",
    },
  ],
  locations: [
    {
      id: "location-1",
      name: "North Archive",
      description: "Stores the moon atlas under glass.",
      region: "Crown Quarter",
      updatedAt: "2026-04-09T09:00:00.000Z",
    },
  ],
  factions: [
    {
      id: "faction-1",
      name: "Glass Ministry",
      description: "Controls civic maps.",
      goal: "control the atlas",
      updatedAt: "2026-05-07T09:00:00.000Z",
    },
  ],
  codex: [
    {
      id: "codex-1",
      name: "Atlas Protocol",
      description: "Rules for opening sealed routes.",
      category: "rule",
      updatedAt: "2026-05-06T09:00:00.000Z",
    },
  ],
  drafts: [
    {
      id: "draft-1",
      title: "Festival cold open",
      description: "Document notes mention the atlas but the title does not.",
      updatedAt: "2026-05-05T09:00:00.000Z",
    },
  ],
};

describe("buildProjectSearchResults", () => {
  it("returns no results until a non-empty query is provided", () => {
    const results = buildProjectSearchResults({
      source,
      query: "  ",
      fields: DEFAULT_PROJECT_SEARCH_FIELDS,
      resultTypes: "all",
      updatedRange: "any",
      now: new Date("2026-05-09T00:00:00.000Z"),
    });

    expect(results).toEqual([]);
  });

  it("can run immediately from a result type filter without text", () => {
    const results = buildProjectSearchResults({
      source,
      query: "  ",
      fields: DEFAULT_PROJECT_SEARCH_FIELDS,
      resultTypes: new Set(["draft"]),
      updatedRange: "any",
      allowEmptyQuery: true,
      now: new Date("2026-05-09T00:00:00.000Z"),
    });

    expect(results.map((result) => result.title)).toEqual(["Festival cold open"]);
  });

  it("can run immediately from a last-updated filter without text", () => {
    const results = buildProjectSearchResults({
      source,
      query: "",
      fields: DEFAULT_PROJECT_SEARCH_FIELDS,
      resultTypes: "all",
      updatedRange: "week",
      allowEmptyQuery: true,
      now: new Date("2026-05-09T00:00:00.000Z"),
    });

    expect(results.map((result) => result.title)).toEqual([
      "Aethys",
      "Glass Ministry",
      "Atlas Protocol",
      "Festival cold open",
    ]);
  });

  it("searches every project content type by name or title by default", () => {
    const results = buildProjectSearchResults({
      source,
      query: "atlas",
      fields: DEFAULT_PROJECT_SEARCH_FIELDS,
      resultTypes: "all",
      updatedRange: "any",
      now: new Date("2026-05-09T00:00:00.000Z"),
    });

    expect(results.map((result) => result.title)).toEqual(["Atlas Protocol"]);
    expect(results[0]).toMatchObject({
      id: "codex-1",
      resultType: "codex",
      route: "/p/project-1/lore/codex/codex-1",
    });
  });

  it("can include descriptive and domain-specific properties from the popover", () => {
    const results = buildProjectSearchResults({
      source,
      query: "stoic",
      fields: ["name", "personality"],
      resultTypes: "all",
      updatedRange: "any",
      now: new Date("2026-05-09T00:00:00.000Z"),
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: "Mira Vale",
      resultType: "character",
      matchedFieldLabelKey: "search.field.personality",
    });
  });

  it("filters by last updated range", () => {
    const results = buildProjectSearchResults({
      source,
      query: "atlas",
      fields: ["name", "description", "body", "goal"],
      resultTypes: "all",
      updatedRange: "week",
      now: new Date("2026-05-09T00:00:00.000Z"),
    });

    expect(results.map((result) => result.title)).toEqual([
      "Aethys",
      "Glass Ministry",
      "Atlas Protocol",
      "Festival cold open",
    ]);
  });
});
