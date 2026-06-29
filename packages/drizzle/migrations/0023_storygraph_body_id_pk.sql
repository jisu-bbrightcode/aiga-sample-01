-- 2026-05-03 — story_graph_node_bodies 의 PK 를 node_id → id 로 변경.
--
-- 배경: PGlite (client-side local DB) 의 live extension 이 모든 INSERT 를
-- internally wrap 하면서 RETURNING id 자동 추가. story_graph_node_bodies 만
-- PK 가 node_id 였고 id 컬럼이 없어 "column id does not exist" silent fail.
-- 다른 모든 graph 테이블 (storyGraphDocuments / storyGraphNodes /
-- storyGraphEdges) 과 일관 — id PK + 도메인 식별자는 UNIQUE.
--
-- 변경:
--   1. id 컬럼 추가 (UUID, default gen_random_uuid())
--   2. 기존 row 들에 id 채움 (gen_random_uuid)
--   3. node_id 의 PK 제약 drop
--   4. id 를 PK 로
--   5. node_id UNIQUE 제약 추가
--
-- DOWN: 미정의 (PK migration 은 일반적으로 forward-only).

ALTER TABLE story_graph_node_bodies
  ADD COLUMN IF NOT EXISTS id UUID;

UPDATE story_graph_node_bodies
  SET id = gen_random_uuid()
  WHERE id IS NULL;

ALTER TABLE story_graph_node_bodies
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE story_graph_node_bodies
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- PK constraint 이름은 PostgreSQL 의 자동 생성 명명 (`<table>_pkey`).
ALTER TABLE story_graph_node_bodies
  DROP CONSTRAINT IF EXISTS story_graph_node_bodies_pkey;

ALTER TABLE story_graph_node_bodies
  ADD CONSTRAINT story_graph_node_bodies_pkey PRIMARY KEY (id);

ALTER TABLE story_graph_node_bodies
  ADD CONSTRAINT story_graph_node_bodies_node_id_unique UNIQUE (node_id);
