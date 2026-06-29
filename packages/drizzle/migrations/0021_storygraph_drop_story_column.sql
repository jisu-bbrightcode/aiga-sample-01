-- 0021_storygraph_drop_story_column
--
-- cycle-26 step L 후속 (review P0 #3): story_graph_documents.story JSONB 컬럼
-- DROP. 0020 에서 backfill + new tables (nodes/edges) 만 추가하고 story 컬럼은
-- 보존 — canary 검증 후 본 0021 로 DROP. 비가역.
--
-- 운영 가이드:
--   1. 0020 배포 후 production 에서 nodes/edges 정상 sync 검증.
--   2. backup: pg_dump --table=story_graph_documents (story 컬럼 포함) snapshot.
--   3. 0021 적용 — DROP COLUMN.
--
-- DOWN: 별도 정의 없음. backup snapshot 으로부터 컬럼 + 데이터 복원 필요.

ALTER TABLE "story_graph_documents" DROP COLUMN IF EXISTS "story";
