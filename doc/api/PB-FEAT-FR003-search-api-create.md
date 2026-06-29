# FR-003 통합검색 생성 API (BBR-533)

- **Capability:** `domain.feature.fr-003.api.create`
- **Decision:** NEW
- **Feature module:** `@repo/features/service-search` → `ServiceSearchModule` (EXISTING module from BBR-531 list API; this issue adds the synonym create surface to it)
- **Server:** `apps/server` (module already wired in `app.module.ts` by BBR-531)
- **Data model:** PB-DATA-FR003 / BBR-521 — `service_search_synonyms` (migration `0048_service_search`). No schema change in this issue.

## What "통합 생성" means here

FR-003 (통합검색) has three data surfaces:

| Table | Owner of writes | Createable by an operator? |
|-------|-----------------|----------------------------|
| `service_search_documents` | reindex job (rebuildable projection of the published catalog) | ❌ generated |
| `service_search_queries` | search execution path (append-only log) | ❌ system-written |
| `service_search_synonyms` | **admins** (curated query expansion) | ✅ **this API** |

The only curated, mutable resource is the **search synonym** (term → expansions),
so the CREATE API is scoped to synonyms. The BBR-531 sibling shipped the
list/search read path on the same module; this issue adds the create/browse of
synonyms via a dedicated controller + service.

## Endpoints

All routes gated by `BetterAuthGuard` → `BetterAuthAdminGuard` (authenticated
**and** owner/admin org role). Unauthenticated → `401`, non-admin → `403`.
Mounted under `service/admin/search/synonyms` (distinct from the list
controller's `service/search/admin`).

### `POST /service/admin/search/synonyms`

Create a search synonym. Body (`CreateSynonymDto`, zod-validated):

| Field | Type | Rules |
|-------|------|-------|
| `term` | string | required, 1–100 chars |
| `expansions` | string[] | required, 1–50 entries, each 1–100 chars |
| `specialtyId` | uuid | optional |
| `isActive` | boolean | optional, **defaults to `true`** (초기 상태) |
| `notes` | string | optional, ≤2000 chars |

Server-side normalization before insert (reuses BBR-531 `normalizeQuery` so a
synonym term canonicalizes exactly like an incoming search query):
- `term` → trimmed, lowercased, whitespace-collapsed (the table's
  `uq_service_search_synonyms_term` unique index is on this canonical form).
- `expansions` → each normalized, empties dropped, the canonical term removed,
  de-duplicated (first-seen order preserved).

Responses: `201` → `SynonymDto`; `400` validation; `409` duplicate term or all
expansions collapsed to the term; `401/403` auth.

**감사 로그:** every successful create emits a structured server-side audit
line (non-user-facing) — `[audit] search synonym created id=… term="…"
expansions=N active=… actor=<adminUserId>`. The synonyms table has no
`created_by` column (PB-DATA-FR003 used `baseColumns()` only), so the actor is
captured in the application audit log rather than a new column — keeping this
issue free of a schema migration.

### `GET /service/admin/search/synonyms`

Paginated browse (so a create is verifiably reflected in the list). Query:
`page` (≥1, default 1), `limit` (1–100, default 20), `active` (optional bool),
`q` (optional term substring). Returns `SynonymListDto`.

### `GET /service/admin/search/synonyms/:id`

Detail by id. `200` → `SynonymDto`, `404` if absent.

## OpenAPI sync

DTOs are `createZodDto` classes (`dto/synonyms.dto.ts`): `CreateSynonymDto`,
`ListSynonymsQueryDto`, `SynonymDto`, `SynonymListDto`. NestJS Swagger derives
the contract from these. Tagged `Service Search Synonyms (Admin)`.

## Acceptance criteria mapping

- **필수 필드 / 권한 없는 생성 검증** → zod `min(1)` on term + expansions (400);
  admin guard (401/403). Covered by `synonyms.service.spec.ts`.
- **목록/상세 일관 반영** → `GET` list + `GET :id` read back the created row.
- **OpenAPI 동기화** → Swagger generated from the zod DTOs above.

## Tests

Added to `packages/features/service-search/**` (jest):
- `synonyms-normalize.spec.ts` — term/expansion normalization, immutability.
- `service/synonyms.service.spec.ts` — create (normalize + default state +
  explicit inactive + collapse-409 + unique-409), list pagination, detail
  found/404.
