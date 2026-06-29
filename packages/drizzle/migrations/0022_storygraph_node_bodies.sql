-- FLT-326 (cycle-26 step L 후속, 2026-05-02)
--
-- scene node 의 body (메인 size 기여자) 를 별 row 로 분리해 list query lean
-- (cycle-26 step I) + Electric pull byte limit (cycle-26 step L) 분산.
--
-- 1:0 또는 1:1 — scene 만 row 보유. PK = node_id (cascade FK).
-- body 자체는 host/server codec wrapper (compressData) 적용 가능.
--
-- backfill: 기존 story_graph_nodes.data 의 body 필드 → story_graph_node_bodies.body
-- 분리. 기존 nodes.data 에서 body 키 제거.
--
-- 압축 wrapper 인 row (data._gz 형태) 는 application 레이어에서 read 시 decompress
-- 후 다시 compress 되므로 backfill 단계에선 compressed wrapper 그대로 보존 — body
-- 분리는 선택 (압축본 그대로 두면 나중에 application 이 read 시 자동 처리).
--
-- 즉 이번 migration 의 scope:
--   1. story_graph_node_bodies 테이블 생성
--   2. RAW data 의 body 분리 (압축 안 된 row 만 — compressed wrapper 는 application 처리)
--
-- DOWN: 미정의. body 합치기는 application 측에서 read 시 자동 (codec → buildStoryFromRows).

CREATE TABLE IF NOT EXISTS "story_graph_node_bodies" (
  "node_id" uuid PRIMARY KEY NOT NULL REFERENCES "story_graph_nodes"("id") ON DELETE CASCADE,
  "document_id" uuid NOT NULL REFERENCES "story_graph_documents"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "project_projects"("id") ON DELETE CASCADE,
  "body" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "owner_id" text NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "is_deleted" boolean NOT NULL DEFAULT false,
  "deleted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- backfill (raw, non-compressed nodes 만 — compressed wrapper 는 application 처리):
-- INSERT INTO node_bodies (body 만 분리) + nodes.data 에서 body 키 제거.
DO $$
DECLARE
  inserted INT := 0;
  cleaned INT := 0;
BEGIN
  -- 1. body 가 4KB+ raw data 인 nodes 의 body 분리
  WITH src AS (
    SELECT n.id AS node_id, n.document_id, n.project_id, n.owner_id, n.data->'body' AS body_val
    FROM story_graph_nodes n
    WHERE jsonb_typeof(n.data) = 'object'
      AND NOT n.data ? '_gz'
      AND n.data ? 'body'
  ), inserted_rows AS (
    INSERT INTO story_graph_node_bodies (node_id, document_id, project_id, body, owner_id)
    SELECT node_id, document_id, project_id,
           jsonb_build_object('body', body_val) AS body,
           owner_id
    FROM src
    ON CONFLICT (node_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM inserted_rows;

  -- 2. 분리된 body 키를 nodes.data 에서 제거
  WITH cleaned_rows AS (
    UPDATE story_graph_nodes
    SET data = data - 'body'
    WHERE jsonb_typeof(data) = 'object'
      AND NOT data ? '_gz'
      AND data ? 'body'
    RETURNING 1
  )
  SELECT count(*) INTO cleaned FROM cleaned_rows;

  RAISE NOTICE '[0022 backfill] inserted % node_bodies, cleaned % nodes (compressed wrappers untouched — handled by application read path)', inserted, cleaned;
END $$;
