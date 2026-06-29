import { describe, expect, it } from "vitest";
import { getStoryRouteModuleKeys } from "./story-route-modules";

describe("getStoryRouteModuleKeys", () => {
  it("preloads the lore list chunk for the project lore entry route", () => {
    expect(getStoryRouteModuleKeys("/p/e5f29ab3-7fb3-4807-aa46-919d4e3a1041/lore")).toEqual([
      "worldList",
    ]);
  });

  it("preloads the world list chunk for world split detail routes", () => {
    expect(
      getStoryRouteModuleKeys("/p/e5f29ab3-7fb3-4807-aa46-919d4e3a1041/lore/worlds/world-1"),
    ).toEqual(["worldList"]);
  });

  it("preloads the character list chunk for character split detail routes", () => {
    expect(
      getStoryRouteModuleKeys(
        "/p/e5f29ab3-7fb3-4807-aa46-919d4e3a1041/lore/characters/character-1",
      ),
    ).toEqual(["characterList"]);
  });

  it("preloads the location list chunk for location split detail routes", () => {
    expect(
      getStoryRouteModuleKeys("/p/e5f29ab3-7fb3-4807-aa46-919d4e3a1041/lore/locations/location-1"),
    ).toEqual(["locationList"]);
  });

  it("preloads the faction list chunk for faction split detail routes", () => {
    expect(
      getStoryRouteModuleKeys("/p/e5f29ab3-7fb3-4807-aa46-919d4e3a1041/lore/factions/faction-1"),
    ).toEqual(["factionList"]);
  });

  it("preloads the codex list chunk for codex split detail routes", () => {
    expect(
      getStoryRouteModuleKeys("/p/e5f29ab3-7fb3-4807-aa46-919d4e3a1041/lore/codex/codex-1"),
    ).toEqual(["codexList"]);
  });

  it("preloads the project search chunk for the project search route", () => {
    expect(getStoryRouteModuleKeys("/p/e5f29ab3-7fb3-4807-aa46-919d4e3a1041/search")).toEqual([
      "projectSearch",
    ]);
  });
});
