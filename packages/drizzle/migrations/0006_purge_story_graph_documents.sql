-- 과거 fixture/시드 데이터에 legacy 옵션 형식 (`text`/`nextSceneId`) 이 박혀있다.
-- ChoiceOption schema 정식 필드는 `label`/`targetNodeId`. story 컬럼은 jsonb 라
-- ALTER 가 아닌 row 단위 변환이 필요한데, 새 fixture 를 playground 에서 다시
-- 시딩하기로 결정했으므로 단순히 모든 도큐먼트를 비운다.
--
-- 안전: 외부 reference 가 cascade. project 보존, draft 만 정리.
DELETE FROM "story_graph_documents";
