-- 0019_wipe_legacy_story_bodies
--
-- v3 정착 — `body` 컬럼만 NULL 처리. `description` 은 preview text 전용으로 보존.
-- 개발 단계라 데이터 보존 의무 없음.
--
-- Lore 6 테이블 (story_worlds, story_characters, story_locations, story_factions,
-- story_codex, story_drafts) 의 body 컬럼: NULL.
-- Scene body (story_graph_documents.story.nodes[type=scene|scene-next].data.body):
-- 빈 문자열 "" — TypeScript 의 SceneNode.data.body: string 타입 보존.
--
-- Idempotent — 2회 실행해도 동일 결과.

UPDATE story_worlds      SET body = NULL;
UPDATE story_characters  SET body = NULL;
UPDATE story_locations   SET body = NULL;
UPDATE story_factions    SET body = NULL;
UPDATE story_codex       SET body = NULL;
UPDATE story_drafts      SET body = NULL;

-- Scene/scene-next body wipe — story_graph_documents.story.nodes 는 jsonb array.
UPDATE story_graph_documents
SET story = jsonb_set(
  story,
  '{nodes}',
  COALESCE((
    SELECT jsonb_agg(
      CASE
        WHEN (node->>'type' IN ('scene', 'scene-next'))
         AND (node->'data' ? 'body')
        THEN jsonb_set(node, '{data,body}', '""'::jsonb)
        ELSE node
      END
    )
    FROM jsonb_array_elements(story->'nodes') AS node
  ), '[]'::jsonb)
)
WHERE jsonb_typeof(story->'nodes') = 'array';
