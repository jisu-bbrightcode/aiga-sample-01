import { describe, expect, it } from "vitest";
import {
  hasExecutableProjectSearchQuery,
  hasOpenPropertyToken,
  removeOpenPropertyToken,
  stripSearchPropertyToken,
} from "./project-search-query";

describe("project search query parsing", () => {
  it("detects an open @ property token at the end of the query", () => {
    expect(hasOpenPropertyToken("@")).toBe(true);
    expect(hasOpenPropertyToken("moon @")).toBe(true);
    expect(hasOpenPropertyToken("moon @des")).toBe(true);
    expect(hasOpenPropertyToken("moon @설")).toBe(true);
    expect(hasOpenPropertyToken("moon @설명 vault")).toBe(false);
  });

  it("removes only the open @ property token", () => {
    expect(removeOpenPropertyToken("@")).toBe("");
    expect(removeOpenPropertyToken("moon @")).toBe("moon");
    expect(removeOpenPropertyToken("moon @설")).toBe("moon");
    expect(removeOpenPropertyToken("moon @설명 vault")).toBe("moon @설명 vault");
  });

  it("strips only the open @ token from executable search text", () => {
    expect(stripSearchPropertyToken("moon @설명")).toBe("moon");
    expect(stripSearchPropertyToken("@설명 moon")).toBe("@설명 moon");
    expect(stripSearchPropertyToken("moon @본문 atlas")).toBe("moon @본문 atlas");
  });

  it("requires text besides property tokens before executing search", () => {
    expect(hasExecutableProjectSearchQuery("")).toBe(false);
    expect(hasExecutableProjectSearchQuery("@")).toBe(false);
    expect(hasExecutableProjectSearchQuery("@설명")).toBe(false);
    expect(hasExecutableProjectSearchQuery("@설명 moon")).toBe(true);
    expect(hasExecutableProjectSearchQuery("moon @설명")).toBe(true);
  });
});
