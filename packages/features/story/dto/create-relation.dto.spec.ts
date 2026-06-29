import {
  createRelationSchema,
  storyEntityTypeSchema,
  storyPropertyEntityTypeSchema,
} from "./create-relation.dto";

const UUID_1 = "00000000-0000-0000-0000-000000000001";
const UUID_2 = "00000000-0000-0000-0000-000000000002";
const UUID_3 = "00000000-0000-0000-0000-000000000003";

describe("storyEntityTypeSchema", () => {
  it("does not allow scene as active story entity metadata", () => {
    expect(() => storyEntityTypeSchema.parse("scene")).toThrow();
    expect(() => storyPropertyEntityTypeSchema.parse("scene")).toThrow();
  });
});

describe("createRelationSchema", () => {
  it("allows lore entities to link to lore entities", () => {
    expect(
      createRelationSchema.parse({
        sourceId: UUID_1,
        sourceType: "character",
        targetId: UUID_2,
        targetType: "character",
        projectId: UUID_3,
      }),
    ).toMatchObject({
      sourceType: "character",
      targetType: "character",
    });
  });
});
