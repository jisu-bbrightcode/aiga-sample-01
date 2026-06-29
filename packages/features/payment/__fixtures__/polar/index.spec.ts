import * as fixtures from "./index";

describe("Polar fixtures barrel", () => {
  it("exports 14 named payloads", () => {
    expect(Object.keys(fixtures).length).toBeGreaterThanOrEqual(14);
  });
  it("each payload has type + data", () => {
    for (const [name, fx] of Object.entries(fixtures)) {
      try {
        expect(fx).toHaveProperty("type");
        expect(fx).toHaveProperty("data");
      } catch (err) {
        throw new Error(`fixture ${name}: ${(err as Error).message}`);
      }
    }
  });
});
