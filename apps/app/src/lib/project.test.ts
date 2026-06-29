import { describe, expect, it } from "vitest";
import { resolveProjectName } from "./project";

describe("project metadata", () => {
  it("keeps the Product Builder brand when VITE_APP_NAME is blank or unresolved", () => {
    expect(resolveProjectName(undefined)).toBe("Product Builder");
    expect(resolveProjectName("")).toBe("Product Builder");
    expect(resolveProjectName("   ")).toBe("Product Builder");
    expect(resolveProjectName("VITE_APP_NAME")).toBe("Product Builder");
  });

  it("uses a configured app name when one is provided", () => {
    expect(resolveProjectName("Narrative Desk")).toBe("Narrative Desk");
  });
});
