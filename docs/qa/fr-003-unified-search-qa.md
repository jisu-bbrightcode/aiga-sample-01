# FR-003 통합 검색 — 통합 기능 QA (BBR-492)

**Feature card:** `domain.feature.fr-003.qa` — 통합 검색 (online-service-standard)
**Scope:** API · 화면 · 권한 · 관리자 · AI 흐름을 선택 surface에 맞춰 검증
**QA date:** 2026-06-30
**Verified ref:** `origin/main` @ `a80fb2b` (through PR #81; all FR-003 deps merged)

## Dependency landing status

모든 FR-003 의존 task가 main에 머지된 상태에서 통합 검증을 수행했다.

| Dependency | Issue | PR | State |
|---|---|---|---|
| FR-003-DATA (service-search 스키마/시드) | — | #11 (pb-data-001) | MERGED |
| FR-003-API-LIST (통합 목록/검색) | BBR-531 | #39 | MERGED |
| FR-003-API-READ (통합 상세) | BBR-532 | #46 | MERGED |
| FR-003-API-CREATE (synonym 생성) | BBR-533 | #33 | MERGED |
| FR-003-API-UPDATE (synonym 수정/상태/이력) | BBR-534 | #64 | MERGED |
| FR-003-API-DELETE (문서 archive/restore) | BBR-535 | #80 | MERGED |
| FR-003-APP (통합검색 앱 화면) | BBR-582 | #83 | MERGED |

기능 모듈(`@repo/features/service-search`)은 `apps/server/src/app.module.ts:95`에 등록되어 end-to-end로 wiring되어 있다.

## 1. 기능 테스트 결과

### 서버 (packages/features/service-search) — jest 62/62 PASS

```
PASS service-search/normalize.spec.ts
PASS service-search/synonyms-normalize.spec.ts
PASS service-search/mappers.spec.ts
PASS service-search/service/synonyms.service.spec.ts
PASS service-search/service/service-search.service.spec.ts
PASS service-search/controller/service-search-detail.controller.spec.ts
Test Suites: 6 passed, 6 total / Tests: 62 passed, 62 total
```

커버 영역: 검색어 정규화(full-text + trigram 입력), synonym 정규화/확장, 공개/관리자 필드 매핑(fail-closed),
synonym 서비스(생성/수정/상태/이력 + 감사 로그), 검색 서비스(검색/인기/최근/archive/restore + 로그 실패 graceful),
상세 컨트롤러(published-only, 404 동일 응답).

### 앱 (apps/app, service-flow 통합검색 화면) — vitest 14/14 PASS

```
src/features/service-flow/lib/unified-search-params.test.ts        PASS
src/features/service-flow/components/unified-search-controls.test.tsx  PASS
Test Files  2 passed (2) / Tests  14 passed (14)
```

커버 영역: URL ↔ 검색 파라미터 순수 직렬화/역직렬화(sort featured→default), 검색 컨트롤(키워드/리셋).

### 마이그레이션 체인

service-search 마이그레이션 `0048_service_search`, `0057_service_search_archive` 모두 `_journal.json`에 정상 등재.
체인 무결성 확인.

## 2. 권한 / 상태 검증

### 공개 surface (`/service/search`) — 비로그인 탐색 가능

| Endpoint | Guard | 상태/노출 규칙 |
|---|---|---|
| `GET /service/search` | `@OptionalUser` | `is_published = true`만 노출, 공개 필드만 |
| `GET /service/search/popular` | 없음 (공개) | 집계 카운트만, 개별 로그 비노출 |
| `GET /service/search/recent` | `BetterAuthGuard` | 로그인 필요(401), 본인 검색 기록만 |
| `GET /service/search/:entityType/:entityId` | `@OptionalUser` | published-only, 없는/비공개 리소스 동일 404(존재 비노출), entityId UUID 검증(400) |

앱 `/search` 라우트는 public(`src/features/service-flow/routes/index.tsx`), 최근 검색어 섹션만 화면 내에서
`authenticatedAtom` tri-state로 auth-gating(미인증 → 안내 메시지, 인증 → fetch). 온라인 서비스 공개 탐색 규칙 준수.

### 관리자 surface — 이중 가드(`BetterAuthGuard` + `BetterAuthAdminGuard`)

| Controller | Endpoints |
|---|---|
| `service/search/admin` | list(미게시 포함) · detail · `DELETE`(archive) · `POST :id/restore` |
| `service/admin/search/synonyms` | `POST`·`GET`·`GET :id`·`PATCH :id`·`PATCH :id/status`·`GET :id/history` |

상태 모델: `is_published`(공개 노출), document `archived`/`restore`(soft-delete, 공개 surface 제외/관리자 노출),
synonym `active` 토글. archive/restore·synonym 변경은 감사 로그 기록(테스트로 검증).

### AI surface — N/A

통합 검색은 full-text + 트라이그램 랭킹 기반 질의 기능으로 LLM/agent 흐름이 없다.
AI 생성/대화 surface는 이 기능 카드 범위 밖이므로 **N/A** 처리한다.

## 3. Acceptance Criteria 대조

- [x] 기능 카드의 acceptance path가 검증됨 — 공개 목록/검색/상세/인기/최근 + 관리자 인덱스/synonym 운영 흐름 전부 테스트 통과.
- [x] 영역별 주요 흐름 확인 — 공개(비로그인 탐색) / 앱(/search) / 관리자(이중 가드) 검증, AI는 N/A 사유 기록.
- [x] REUSE/N/A SKIP 사유 — AI surface N/A(검색은 비-AI 질의 기능). 별도 REUSE 없음(전 dep NEW/EXTEND로 머지됨).

## 4. 잔여 리스크

1. **DB-integration 커버리지** — `service-search.service.spec`는 `createMockDb`(FIFO mock) 기반으로,
   full-text + trigram 랭킹 SQL이 라이브 Postgres에 대해 본 QA 스위트에서 직접 실행되지는 않는다.
   (원 API-LIST/READ/DELETE PR 개발 시 ephemeral pg16 마이그레이션 체인으로 검증된 이력 있음.)
   권장: 랭킹/정렬 회귀를 잡기 위한 실 DB 통합 테스트 추가를 후속 고려.
2. **배포 환경 E2E 미수행** — Vercel 배포 URL에서의 공개 탐색/로그인 모달/보호 액션 진입 검증은
   배포 게이트로 분리되어 본 코드-레벨 QA 범위에 포함되지 않음(playwright e2e 스펙은 존재).
3. **(범위 외) 베이스 마이그레이션 이상** — vendored base의 `0026`/`0035` 중복 prefix 파일이 `_journal.json`에
   미등재. FR-003 마이그레이션과 무관하나 base 유지보수자에게 플래그.

## 결론

FR-003 통합 검색의 공개/앱/관리자 acceptance path가 검증되었고, 서버 62/62 + 앱 14/14 테스트가 통과한다.
권한(공개 published-only / 관리자 이중 가드 / 최근검색 auth-gate)과 상태(게시·archive·synonym active) 규칙이
일관되게 적용된다. AI surface는 N/A. 잔여 리스크는 위 3건(전부 비차단)으로 한정된다. **QA PASS.**
