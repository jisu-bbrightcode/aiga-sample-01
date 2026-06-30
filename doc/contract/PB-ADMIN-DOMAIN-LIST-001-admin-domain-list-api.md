# PB-ADMIN-DOMAIN-LIST-001 — Admin Domain Resource List API contract

**Issue:** BBR-678 (`admin.domain.list`)
**Consumer:** `apps/admin` → `src/features/domain` (shipped — list/search UI).
**Producer (follow-up):** `apps/server` admin module over the PB-DATA-001
`service_doctors` / `service_hospitals` tables.

The admin UI is built **contract-first**: it calls the endpoint below through a
thin, zod-validated fetch layer (`apps/admin/src/features/domain/api.ts`) that
reuses the same base URL + auth headers as the generated `apiClient`. The list
renders empty/error/loading states today and returns live data the moment this
endpoint ships — **no frontend change required**, only api-client regeneration
is optional (the UI does not depend on the generated path types).

## Endpoint

```
GET /api/admin/domain/resources
```

Auth: admin session (same guard as the other `/api/admin/*` routes — see
PB-ADMIN-002 / BBR-677 scope+permission work). Non-admins → 401/403.

### Query parameters

| Param    | Type                                   | Default     | Notes                                              |
| -------- | -------------------------------------- | ----------- | -------------------------------------------------- |
| `page`   | integer ≥ 1                            | `1`         | 1-based page index                                 |
| `limit`  | integer 1..100                         | `20`        | page size                                          |
| `type`   | `doctor` \| `hospital`                 | (all)       | resource kind filter                               |
| `status` | `draft` \| `published` \| `archived`   | (all)       | editorial lifecycle filter                         |
| `search` | string                                 | (none)      | case-insensitive match on `name` and `slug`        |
| `sort`   | `name` \| `status` \| `updatedAt`      | `updatedAt` | sort column                                        |
| `order`  | `asc` \| `desc`                        | `desc`      | sort direction                                     |

### Response `200`

```jsonc
{
  "items": [
    {
      "id": "uuid",
      "type": "doctor",              // "doctor" | "hospital"
      "name": "김의사",
      "slug": "kim-uisa",
      "status": "published",         // "draft" | "published" | "archived"
      "regionName": "서울",          // nullable
      "specialtyName": "정형외과",   // nullable; doctors only (null for hospitals)
      "isFeatured": true,             // 명의 badge / featured hospital
      "updatedAt": "2026-06-30T04:00:00.000Z",
      "createdAt": "2026-06-01T00:00:00.000Z"
    }
  ],
  "total": 137,
  "page": 1,
  "limit": 20,
  "totalPages": 7
}
```

### Field-visibility / security requirements

- This endpoint is **admin-only** and may surface all lifecycle states
  (`draft`/`published`/`archived`), unlike public surfaces which expose only
  `published`.
- It MUST NOT include sensitive admin columns (`licenseNumber`,
  `internalNotes`, `sourceUrl`, etc.) in the list projection. The list view
  needs only the fields above.
- `type=doctor|hospital` selects the source table; when omitted, the response
  is a UNION ordered by the requested sort key across both tables.

## Acceptance mapping (BBR-678)

- _관리자는 핵심 리소스를 검색/필터링해 찾을 수 있다_ → `search` + `type` + `status`.
- _목록에는 운영에 필요한 상태와 최근 변경 정보가 표시된다_ → `status` + `updatedAt`
  columns rendered by `domain-table.tsx`.

## Frontend touch-points

- `apps/admin/src/features/domain/api.ts` — `fetchDomainResources()` +
  `DOMAIN_ADMIN_RESOURCES_ENDPOINT`, response zod schema.
- `apps/admin/src/features/domain/hooks/use-domain-resources.ts` — react-query.
- `apps/admin/src/features/domain/routes/admin-domain-list-page.tsx` — page.
- Route `/domain` registered in `apps/admin/src/router.tsx`; nav entry in
  `apps/admin/src/layouts/admin-layout.tsx`.
