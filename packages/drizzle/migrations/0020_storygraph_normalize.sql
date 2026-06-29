-- 0020_storygraph_normalize
--
-- cycle-26 step L: story_graph_documents.story JSONB single-row 7MB+ 가
-- Electric SQL pull chunked stream 한계 초과 → PGlite ingest 실패.
-- Solution: nodes/edges 별 row 로 분리 (lore 도메인과 동일 패턴).
--
-- before: documents (id, project_id, title, story JSONB, owner_id, ...)
-- after:  documents (id, project_id, title, version, metadata JSONB, owner_id, ...)
--         story_graph_nodes (id, document_id, project_id, node_type, label, position_x, position_y, data JSONB, sort_order, ...)
--         story_graph_edges (id, document_id, project_id, edge_type, source_node_id, target_node_id, data JSONB, sort_order, ...)
--
-- Migration plan:
--   1. 신규 테이블 생성
--   2. 기존 documents.story → 신규 테이블로 backfill (jsonb_array_elements)
--   3. documents 에 version + metadata 컬럼 추가, metadata 채움
--   4. documents.story 컬럼 제거

CREATE TABLE IF NOT EXISTS "story_graph_nodes" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" uuid NOT NULL REFERENCES "story_graph_documents"("id") ON DELETE CASCADE,
  "project_id"  uuid NOT NULL REFERENCES "project_projects"("id") ON DELETE CASCADE,
  "node_type"   text NOT NULL,
  "label"       text,
  "notes"       text,
  "chapter"     text,
  "position_x"  double precision NOT NULL DEFAULT 0,
  "position_y"  double precision NOT NULL DEFAULT 0,
  "data"        jsonb NOT NULL DEFAULT '{}'::jsonb,
  "sort_order"  integer NOT NULL DEFAULT 0,
  "owner_id"    text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "is_deleted"  boolean NOT NULL DEFAULT false,
  "deleted_at"  timestamptz,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "story_graph_edges" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id"    uuid NOT NULL REFERENCES "story_graph_documents"("id") ON DELETE CASCADE,
  "project_id"     uuid NOT NULL REFERENCES "project_projects"("id") ON DELETE CASCADE,
  "edge_type"      text NOT NULL,
  "source_node_id" text NOT NULL,
  "target_node_id" text NOT NULL,
  "data"           jsonb NOT NULL DEFAULT '{}'::jsonb,
  "sort_order"     integer NOT NULL DEFAULT 0,
  "owner_id"       text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "is_deleted"     boolean NOT NULL DEFAULT false,
  "deleted_at"     timestamptz,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "updated_at"     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS story_graph_nodes_document_id_idx ON story_graph_nodes (document_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS story_graph_edges_document_id_idx ON story_graph_edges (document_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS story_graph_nodes_project_id_idx ON story_graph_nodes (project_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS story_graph_edges_project_id_idx ON story_graph_edges (project_id) WHERE is_deleted = false;

ALTER TABLE "story_graph_documents" ADD COLUMN IF NOT EXISTS "version"  varchar(20) NOT NULL DEFAULT '1.0.0';
ALTER TABLE "story_graph_documents" ADD COLUMN IF NOT EXISTS "metadata" jsonb       NOT NULL DEFAULT '{"title":"스토리"}'::jsonb;

-- Backfill nodes from story JSONB
INSERT INTO story_graph_nodes (
  id, document_id, project_id, node_type, label, notes, chapter,
  position_x, position_y, data, sort_order, owner_id, created_at, updated_at
)
SELECT
  CASE
    WHEN (node_obj->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (node_obj->>'id')::uuid
    ELSE gen_random_uuid()
  END AS id,
  doc.id AS document_id,
  doc.project_id,
  COALESCE(node_obj->>'type', 'scene') AS node_type,
  node_obj->>'label' AS label,
  node_obj->>'notes' AS notes,
  node_obj->>'chapter' AS chapter,
  COALESCE((node_obj->'position'->>'x')::double precision, 0) AS position_x,
  COALESCE((node_obj->'position'->>'y')::double precision, 0) AS position_y,
  COALESCE(node_obj->'data', '{}'::jsonb) AS data,
  ord - 1 AS sort_order,
  doc.owner_id,
  doc.created_at,
  doc.updated_at
FROM story_graph_documents doc
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(doc.story->'nodes', '[]'::jsonb))
  WITH ORDINALITY AS t(node_obj, ord)
WHERE doc.story IS NOT NULL
  AND jsonb_typeof(doc.story->'nodes') = 'array'
ON CONFLICT (id) DO NOTHING;

-- Backfill edges from story JSONB
INSERT INTO story_graph_edges (
  id, document_id, project_id, edge_type, source_node_id, target_node_id,
  data, sort_order, owner_id, created_at, updated_at
)
SELECT
  CASE
    WHEN (edge_obj->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (edge_obj->>'id')::uuid
    ELSE gen_random_uuid()
  END AS id,
  doc.id AS document_id,
  doc.project_id,
  COALESCE(edge_obj->>'type', 'sequence') AS edge_type,
  COALESCE(edge_obj->>'source', '') AS source_node_id,
  COALESCE(edge_obj->>'target', '') AS target_node_id,
  (edge_obj - 'id' - 'type' - 'source' - 'target') AS data,
  ord - 1 AS sort_order,
  doc.owner_id,
  doc.created_at,
  doc.updated_at
FROM story_graph_documents doc
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(doc.story->'edges', '[]'::jsonb))
  WITH ORDINALITY AS t(edge_obj, ord)
WHERE doc.story IS NOT NULL
  AND jsonb_typeof(doc.story->'edges') = 'array'
  AND COALESCE(edge_obj->>'source', '') <> ''
  AND COALESCE(edge_obj->>'target', '') <> ''
ON CONFLICT (id) DO NOTHING;

-- Move metadata + version from story JSONB to columns
UPDATE story_graph_documents
SET
  version = COALESCE(story->>'version', '1.0.0'),
  metadata = COALESCE(story->'metadata', jsonb_build_object('title', title))
WHERE story IS NOT NULL;

-- review P0 #4 — backfill audit. silent drop 방지: invalid edges (empty source/target)
-- 또는 invalid uuid id 였던 row count 를 NOTICE 로 surface. 비-zero 면 staging 환경에서
-- 검토 후 production 진행 결정.
DO $$
DECLARE
  total_doc_count INTEGER;
  total_node_count INTEGER;
  total_edge_count INTEGER;
  expected_nodes INTEGER;
  expected_edges INTEGER;
  bad_edges INTEGER;
BEGIN
  SELECT count(*) INTO total_doc_count FROM story_graph_documents WHERE story IS NOT NULL;
  SELECT count(*) INTO total_node_count FROM story_graph_nodes;
  SELECT count(*) INTO total_edge_count FROM story_graph_edges;
  SELECT COALESCE(SUM(jsonb_array_length(story->'nodes')), 0) INTO expected_nodes
    FROM story_graph_documents WHERE jsonb_typeof(story->'nodes') = 'array';
  SELECT COALESCE(SUM(jsonb_array_length(story->'edges')), 0) INTO expected_edges
    FROM story_graph_documents WHERE jsonb_typeof(story->'edges') = 'array';
  bad_edges := expected_edges - total_edge_count;
  RAISE NOTICE '[0020 backfill audit] documents=%, nodes %/%, edges %/%, dropped_edges=%',
    total_doc_count, total_node_count, expected_nodes, total_edge_count, expected_edges, bad_edges;
  IF total_node_count < expected_nodes THEN
    RAISE NOTICE '[0020 backfill audit] WARN nodes dropped: % (likely invalid id but cast safe-guard recovered them via gen_random_uuid; check audit count)',
      expected_nodes - total_node_count;
  END IF;
END $$;

-- review P0 #3 — story 컬럼 DROP 은 별도 migration (0021) 으로 분리 권장. 본 마이그레이션은
-- 신규 테이블 생성 + backfill 만 수행하고 story JSONB 컬럼은 보존하여 canary 후 별도
-- 0021 으로 안전하게 DROP. 이번 PR 에서는 0021 도 같이 추가했지만 운영 환경에서는
-- 0020 만 먼저 배포 후 검증 가능.
-- ALTER TABLE "story_graph_documents" DROP COLUMN IF EXISTS "story";  -- moved to 0021
