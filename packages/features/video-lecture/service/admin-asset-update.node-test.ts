import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdminAssetUpdate } from "./admin-asset-update";

test("admin asset update preserves lesson mapping when lessonId is omitted", () => {
  const update = resolveAdminAssetUpdate(
    { lessonId: "lesson-old", requireSignedUrls: true },
    { title: "Updated" },
  );

  assert.equal(update.lessonId, "lesson-old");
  assert.equal(update.lessonMetadataLessonId, "lesson-old");
});

test("admin asset update can unlink a lesson with explicit null", () => {
  const update = resolveAdminAssetUpdate(
    { lessonId: "lesson-old", requireSignedUrls: true },
    { lessonId: null, title: "Updated" },
  );

  assert.equal(update.lessonId, null);
  assert.equal(update.lessonMetadataLessonId, null);
});

test("admin asset update applies lesson metadata to the remapped lesson", () => {
  const update = resolveAdminAssetUpdate(
    { lessonId: "lesson-old", requireSignedUrls: false },
    { lessonId: "lesson-new", description: "Updated", requireSignedUrls: true },
  );

  assert.equal(update.lessonId, "lesson-new");
  assert.equal(update.lessonMetadataLessonId, "lesson-new");
  assert.equal(update.requireSignedUrls, true);
  assert.equal(update.shouldUpdateProviderSignedUrls, true);
});
