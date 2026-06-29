# FEA-147: Source 수집과 Requirement 정규화 저장 구조

> Linear: [FEA-147](https://linear.app/bbrightcode/issue/FEA-147)
> FRD: FRD-AD-201 ~ FRD-AD-206
> Branch: `feature/fea-147`

## 1. 목표

다중 문서 source를 동일 contract로 저장하고, 정규화된 requirement와 source trace를 세션에 영속화한다.

## 2. Schema 변경

### 2.1 새 테이블: `agent_desk_requirement_sources`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| session_id | uuid FK → agent_desk_sessions | |
| source_type | enum('pdf','docx','md','txt','manual') | |
| title | varchar(500) | |
| raw_content | text | 원본 텍스트 |
| parsed_content | text | 파싱된 텍스트 |
| priority | integer default 3 | 1-5 |
| trust_score | numeric default 1.0 | 0-1 |
| parse_status | enum('pending','parsed','failed') | |
| file_id | uuid FK → agent_desk_files, nullable | 파일 업로드 시 연결 |
| metadata | jsonb | 파일 크기, 추출 길이 등 |
| created_at, updated_at | timestamp | |

### 2.2 새 테이블: `agent_desk_normalized_requirements`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | |
| session_id | uuid FK → agent_desk_sessions | |
| category | enum('feature','role','entity','validation','exception') | |
| summary | varchar(500) | |
| detail | text | |
| source_ids | text[] | requirement_source ID 목록 |
| confidence | numeric default 0.8 | 0-1 |
| conflict_status | enum('none','duplicate','conflict') | |
| dedupe_group_id | uuid nullable | |
| created_at, updated_at | |

### 2.3 Relations

- session 1:N requirement_sources
- session 1:N normalized_requirements
- requirement_source N:1 file (optional)

## 3. API 계약

| Procedure | Type | Input | Output | 권한 |
|-----------|------|-------|--------|------|
| addRequirementSource | mutation | { sessionId, sourceType, title, rawContent?, fileId? } | source | adminProcedure (세션 소유권) |
| listRequirementSources | query | { sessionId } | source[] | adminProcedure (세션 소유권) |
| normalizeRequirements | mutation | { sessionId, model? } | { requirements[], conflicts[] } | adminProcedure (세션 소유권) |
| listNormalizedRequirements | query | { sessionId } | requirement[] | adminProcedure (세션 소유권) |

REST 매핑:
- POST /api/agent-desk/sources
- GET /api/agent-desk/sources?sessionId=
- POST /api/agent-desk/requirements/normalize
- GET /api/agent-desk/requirements?sessionId=

## 4. Service 구조

### RequirementSourceService
- `addSource(sessionId, input, userId)` — source 생성 + 파싱 트리거
- `listSources(sessionId)` — 세션별 source 목록
- `parseSource(sourceId)` — FileParserService 연동, parsed_content 저장

### RequirementNormalizerService
- `normalize(sessionId, model?)` — LLM 호출로 requirement 정규화
- `listRequirements(sessionId)` — 세션별 requirement 목록
- `detectConflicts(requirements)` — 충돌/중복 감지

## 5. 소유권 검증

모든 source/requirement API에 공통 적용:
```typescript
async verifySessionOwnership(sessionId: string, userId: string): Promise<void> {
  const session = await this.db.query.agentDeskSessions.findFirst({
    where: and(eq(agentDeskSessions.id, sessionId), eq(agentDeskSessions.createdById, userId)),
  });
  if (!session) throw new ForbiddenException('Session access denied');
}
```

## 6. 핵심 결정

- `.doc` 파일은 지원하지 않음 — 에러 메시지 반환
- 직접 입력(`manual`)도 동일한 source contract
- source trace는 `normalized_requirement.source_ids[]`로 역추적
- 기존 `agentDeskFiles` 테이블 유지, `requirement_sources.file_id`로 연결

## 7. Acceptance Criteria

- [ ] PDF/DOCX/MD/TXT/직접 입력이 동일 source contract로 저장된다
- [ ] requirement가 category, summary/detail, source_ids, conflict_status를 가진다
- [ ] source trace가 requirement에서 역추적 가능하다
- [ ] source 관련 API에 세션 소유권 검증이 공통 적용된다
