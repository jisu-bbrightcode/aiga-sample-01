import { isServicePublishStatus, resolveStatusChange } from "./status";

describe("service-domain status logic", () => {
  const now = new Date("2026-06-29T00:00:00.000Z");
  const earlier = new Date("2026-01-01T00:00:00.000Z");

  describe("isServicePublishStatus", () => {
    it.each(["draft", "published", "archived"])("accepts %s", (s) => {
      expect(isServicePublishStatus(s)).toBe(true);
    });

    it.each(["", "DRAFT", "live", 1, null, undefined])("rejects %p", (s) => {
      expect(isServicePublishStatus(s)).toBe(false);
    });
  });

  describe("resolveStatusChange", () => {
    it("stamps publishedAt on first publish", () => {
      expect(resolveStatusChange("published", now, null)).toEqual({
        status: "published",
        publishedAt: now,
      });
    });

    it("preserves the original publishedAt when re-publishing", () => {
      expect(resolveStatusChange("published", now, earlier)).toEqual({
        status: "published",
        publishedAt: earlier,
      });
    });

    it("clears publishedAt when unpublishing to draft", () => {
      expect(resolveStatusChange("draft", now, earlier)).toEqual({
        status: "draft",
        publishedAt: null,
      });
    });

    it("clears publishedAt when archiving", () => {
      expect(resolveStatusChange("archived", now, earlier)).toEqual({
        status: "archived",
        publishedAt: null,
      });
    });
  });
});
