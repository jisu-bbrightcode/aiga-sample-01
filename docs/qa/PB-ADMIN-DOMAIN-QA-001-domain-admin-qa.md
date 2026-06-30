# 도메인 운영 관리자 검증 (PB-ADMIN-DOMAIN-QA-001 / BBR-683)

QA Engineer regression report for the admin **도메인 운영 관리자** capability
(`admin.domain.qa`) — 의사/병원 카탈로그 리소스의 목록/상세/생성/수정/상태/비활성을
관리자 콘솔에서 운영하는 경로의 CRUD·권한·감사 로그 검증.

- **Build**: `bp-0b891299-66b7-438f-a3a4-7a63fbf8632b` (online-service-standard)
- **Verified against**: `origin/main` @ `7d8c34d` (clean worktree, not the dirty
  KCB feature branch the session was checked out on)
- **Depends on** (all merged to `main`):
  - PB-ADMIN-DOMAIN-LIST-001 — list/search
  - PB-ADMIN-DOMAIN-READ-001 — detail + 민감정보 마스킹 (PR #96)
  - PB-ADMIN-DOMAIN-CREATE-001 — 생성 + 감사 (PR #111)
  - PB-ADMIN-DOMAIN-UPDATE-001 — 수정/상태 전이 + 감사 (PR #120, current `main` HEAD)
  - PB-ADMIN-DOMAIN-DELETE-001 — 비활성/archive + restore + 감사 (PR #115)

The backend capability under test is fully merged. This QA item adds a focused
regression spec (no production code) plus this evidence report.

## Surface under test

- **Backend** — `packages/features/service-domain/`
  - Controller: `controller/service-domain-admin-resources.controller.ts`
    (`@Controller("admin/domain")`, gated by `BetterAuthGuard` →
    `BetterAuthAdminGuard`).
  - Service: `service/service-domain.service.ts` (CRUD + status + audit).
  - Pure policy: `transitions.ts` (allowed status moves), `status.ts` (column
    patch), `admin-resource-detail.ts` (`maskSecret`, detail mappers).
- **Frontend** — `apps/admin/src/features/domain/` (list/detail/create/edit
  pages + thin schema-validated fetch layer in `api.ts`). The frontend is a
  contract-first fetch layer over the same REST URLs; backend behaviour is the
  authoritative QA surface.

## REST contract verified

| Method | Path | Operation |
|--------|------|-----------|
| GET | `/api/admin/domain/resources` | 목록/검색 (의사·병원 통합, 필터·정렬·페이지) |
| GET | `/api/admin/domain/resources/:type/:id` | 상세 (운영 필드 + 관련 정보, 민감정보 마스킹) |
| POST | `/api/admin/domain/resources/doctors` | 의사 생성 (기본 draft) |
| POST | `/api/admin/domain/resources/hospitals` | 병원 생성 (기본 draft) |
| PATCH | `/api/admin/domain/resources/doctors/:id` | 의사 수정 |
| PATCH | `/api/admin/domain/resources/hospitals/:id` | 병원 수정 |
| POST | `/api/admin/domain/resources/:type/:id/status` | 상태 변경 (허용 전이만, 422) |
| POST | `/api/admin/domain/resources/:type/:id/archive` | 비활성/archive |
| POST | `/api/admin/domain/resources/:type/:id/restore` | 복구 (→ draft) |
| GET | `/api/admin/domain/resources/:type/:id/history` | 변경 이력 (감사 로그, 최신순) |

## How to reproduce

```bash
cd packages/features
# 전체 도메인 관리자 회귀 (mock Drizzle — DB 불필요)
NODE_OPTIONS=--experimental-vm-modules jest --testPathPatterns service-domain

# 이 QA 항목이 추가한 회귀 스펙만
NODE_OPTIONS=--experimental-vm-modules jest --testPathPatterns admin-domain-mutation.qa
```

## Result summary

| Suite | Purpose | Status |
|-------|---------|--------|
| `transitions.spec.ts` | 상태 전이 정책 (허용/거부/no-op, archived→published 차단) | ✅ |
| `status.spec.ts` | 상태→컬럼 패치 (publishedAt 보정) | ✅ |
| `mappers.spec.ts` | 공개/관리자 매퍼 (민감 컬럼 비노출) | ✅ |
| `admin-resources.spec.ts` | 목록/검색 프로젝션 | ✅ |
| `admin-resource-detail.spec.ts` | 상세 + `maskSecret` (license/사업자번호 마스킹) | ✅ |
| `service/service-domain.service.spec.ts` | CRUD + 상태 + archive/restore + 감사 | ✅ |
| `service/list-doctors-search.qa.spec.ts` | 검색/정렬 QA (PB-FEAT-FR004-QA) | ✅ |
| `controller/...-admin-resources.controller.spec.ts` | 라우팅 + 가드 + actor 전달 | ✅ |
| **`service/admin-domain-mutation.qa.spec.ts`** (**NEW**) | 수정 경로 상태-우회 차단 (AC#1) | ✅ |
| **Total** | **9 suites / 94 tests** | ✅ |

## Acceptance Criteria → evidence

### AC#1 — CRUD 각 작업의 성공/실패/권한 없는 접근이 검증되어 있다

| 작업 | 성공 | 실패 | 권한 없는 접근 |
|------|------|------|----------------|
| **생성** | `createDoctor`/`createHospital` stamp publishedAt + return admin record (`service-domain.service.spec.ts`) | slug 중복 → 409 `ConflictException` (unique-violation 매핑) | 컨트롤러 `BetterAuthGuard + BetterAuthAdminGuard` (controller spec: guards metadata) |
| **읽기(목록)** | 통합 목록/정렬/페이지 (`admin-resources.spec.ts`) | — | 동일 가드 |
| **읽기(상세)** | 운영 필드 + 관련 + **민감정보 마스킹** (`admin-resource-detail.spec.ts`) | — | 동일 가드 + `maskSecret`로 license/사업자번호 원문 미노출 |
| **수정** | `updateDoctor`/`updateHospital` before/after 감사 (`service-domain.service.spec.ts`) | 404 (대상 부재), 409 (slug 중복) | 동일 가드 + **수정 경로로 상태 변경 불가** (NEW QA spec, 아래) |
| **상태 변경** | 허용 전이 통과 + 감사 | **422** disallowed 전이 (archived→published), no write/audit; **no-op** 동일 상태 skip | 동일 가드 |
| **비활성/archive** | archived 상태 + 공개 노출 차단(연결 데이터 보존) + 감사; restore→draft | 404 대상 부재; 멱등 (이미 archived → no write/audit) | 동일 가드 |

권한 검증은 컨트롤러 클래스 데코레이터(`@UseGuards(BetterAuthGuard,
BetterAuthAdminGuard)`)로 모든 라우트에 일괄 적용되며, controller spec이 guards
메타데이터로 익명/비관리자 접근 차단을 고정한다. 이는 다른 `/api/admin/*`
라우트와 동일한 패턴이다.

### AC#2 — 관리자 변경 작업 감사 로그가 확인된다

모든 변경(create/update/status/archive/restore)이 공유 `admin_audit_log`에
append-only로 기록된다(`AdminAuditService.log`). 서비스 스펙이 actor·action·
targetType·targetId·payloadBefore/After를 단언:

| 작업 | action | 기록 내용 |
|------|--------|-----------|
| 의사/병원 생성 | `domain.{doctor,hospital}.created` | payloadAfter |
| 의사/병원 수정 | `domain.{doctor,hospital}.updated` | payloadBefore + payloadAfter |
| 상태 변경 | `service_domain.status_changed` | before/after {status, publishedAt} |
| archive / restore | `service_domain.{archived,restored}` | before/after lifecycle |

변경 이력 조회(`GET .../history`)는 동일 `admin_audit_log`을 targetType+targetId로
필터링해 최신순 반환(`getDomainResourceHistory`).

## Gap closed (new regression)

`service/admin-domain-mutation.qa.spec.ts` — **수정 경로의 상태-우회 차단**.

수정 DTO(`UpdateDoctorDto`/`UpdateHospitalDto`)는 생성 DTO와 shape 호환을 위해
optional `status` 필드를 그대로 가진다. 서비스는 이를 의도적으로 버린다
(`const { status, ...fields } = dto; void status;`) — 발행 상태는 전이 검증
(`assertStatusTransition`)을 강제하는 `changeStatus` 경로만이 바꿀 수 있어야
한다. 기존 스펙은 이 strip을 **간접적으로만** 통과시킬 뿐, `set` 패치에 `status`/
`publishedAt`이 새지 않는다는 점을 직접 단언하지 않았다.

이 갭이 회귀하면 운영자가 **수정 폼으로 archived 리소스를 곧장 published로 되돌려**
전이 정책(archived→published 금지)과 그 감사 트레일을 우회할 수 있다. 신규 4개
테스트가 그 경계를 고정한다:

- `updateDoctor`/`updateHospital`이 payload의 `status: "published"`를 받아도
  `set` 패치에 `status`·`publishedAt`이 포함되지 않는다.
- 두 수정 경로의 감사 action이 `domain.*.updated`(콘텐츠 수정)이며
  `service_domain.status_changed`가 **아니다**.

## 잔여 리스크 (Residual risks)

1. **단위/계약 레벨 검증, 라이브 E2E 아님** — 본 QA는 mock Drizzle + 컨트롤러
   단위 레벨이다. 가드 적용은 메타데이터로, audit 기록은 mock `AdminAuditService`
   호출로 단언한다. Neon DB에 실제 행이 쓰이는 것과 Better Auth 세션으로 401/403이
   실제 반환되는 것은 배포 환경(Vercel + Neon) E2E로 별도 확인이 필요하다.
2. **권한 음성 케이스의 깊이** — 비관리자/익명 차단은 가드 *부착*으로 보장된다.
   `BetterAuthAdminGuard` 자체의 owner/admin 판정 로직은 `@repo/core` 소속이며 이
   QA 범위 밖이다(해당 가드의 자체 스펙에 의존).
3. **프론트 표면 미실행** — `apps/admin` 도메인 화면은 contract-first fetch
   레이어로, 본 QA는 백엔드 계약만 검증한다. 화면 렌더/모달/토스트 흐름은 admin
   vite build + 수동 확인 대상.
4. **민감정보 마스킹 범위** — license/사업자등록번호는 마스킹이 검증되었으나,
   `internalNotes`/`sourceUrl` 등 운영 전용 필드는 관리자 상세에 평문 노출된다
   (의도된 동작 — 관리자 전용 화면). 공개 매퍼(`mappers.spec.ts`)는 이들을
   노출하지 않음이 확인된다.
5. **상태 전이 표 자체의 정책 변경** — 전이 표(`SERVICE_STATUS_TRANSITIONS`)가
   바뀌면 본 QA의 422 기대도 함께 갱신해야 한다.
