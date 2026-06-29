# PB-DOMAIN-001 — 핵심 서비스 REST API (BBR-525)

- Capability: `domain.service-api`
- Decision: **NEW** (Backend Engineer)
- Depends on: PB-DATA-001 (service-domain schema), PB-INFRA-002 (migrate-from-scratch), PB-AUTH-002 (auth guards)
- Target: `packages/features/service-domain` (wired into `apps/server`)

## 결정값과 근거

선택된 도메인은 **의사/병원 큐레이션**(PB-DATA-001 hub). 핵심 리소스는 **의사(doctor)**
와 **병원(hospital)**, 그리고 참조 분류 데이터인 **진료과(specialty)**·**지역(region)**.
이 task는 그 핵심 리소스의 CRUD / 조회 / 상태 변경 API를 NestJS Swagger(OpenAPI 계약의
단일 소스)에 맞춰 구현한다. tRPC는 표준 워크플로우에서 제외되므로 REST 컨트롤러 + Swagger
데코레이터 + zod DTO 패턴(기존 `blog` feature와 동일)을 따른다.

## 실행 산출물

새 feature 모듈 `@repo/features/service-domain`:

```
service-domain/
  status.ts            # 게시 상태 전이 (pure) — published만 공개
  mappers.ts           # public/admin 필드 분리 projection (pure, fail-closed)
  dto/                 # zod 요청 DTO + Swagger 응답 DTO
  service/             # ServiceDomainService (Drizzle 데이터 접근)
  controller/          # 공개 컨트롤러 + 관리자(가드) 컨트롤러
  service-domain.module.ts
  *.spec.ts            # 25 tests (status / mappers / service)
```

### 라우트

공개(비로그인 탐색 가능, published만):

| Method | Path | 설명 |
|--------|------|------|
| GET | `/service/specialties` | 진료과 목록 |
| GET | `/service/regions?parentId=` | 지역 목록(시/도 → 시군구) |
| GET | `/service/doctors?page&limit&specialtyId&regionId&featured&q` | 의사 목록 |
| GET | `/service/doctors/:slug` | 의사 상세(진료과/병원/지역 포함) |
| GET | `/service/hospitals?page&limit&regionId&featured&q` | 병원 목록 |
| GET | `/service/hospitals/:slug` | 병원 상세(지역/소속의사 포함) |

관리자(`BetterAuthGuard` + `BetterAuthAdminGuard` = owner/admin role):

| Method | Path | 설명 |
|--------|------|------|
| POST | `/service/admin/doctors` | 의사 생성 |
| PUT | `/service/admin/doctors/:id` | 의사 수정 |
| PATCH | `/service/admin/doctors/:id/status` | 의사 상태 변경 |
| DELETE | `/service/admin/doctors/:id` | 의사 soft delete |
| POST | `/service/admin/hospitals` | 병원 생성 |
| PUT | `/service/admin/hospitals/:id` | 병원 수정 |
| PATCH | `/service/admin/hospitals/:id/status` | 병원 상태 변경 |
| DELETE | `/service/admin/hospitals/:id` | 병원 soft delete |

## 핵심 설계 결정

- **public/admin 필드 분리** (PB-DATA-001 acceptance criteria): 공개 매퍼는 명시적
  allow-list로 객체를 새로 구성한다. 민감 컬럼(면허번호·사업자등록번호·internalNotes·
  sourceUrl·status·editor id·soft-delete)은 공개 응답에 절대 포함되지 않으며, 스키마에
  컬럼이 추가돼도 기본 제외(fail-closed)된다. `mappers.spec.ts`가 이를 강제한다.
- **published-only 노출**: 모든 공개 조회는 `status='published' AND isDeleted=false`.
  상세 응답의 중첩 관계(소속 병원/의사)도 동일 필터를 적용해 draft 데이터 누출을 막는다.
- **상태 변경 부수효과**: `published`로 전이 시 최초 1회 `publishedAt` 스탬프(재게시 시 보존),
  draft/archived 전이 시 `publishedAt` 해제. `status.ts`에 순수 함수로 분리·테스트.
- **소프트 삭제**: 삭제는 `isDeleted`/`deletedAt` 마킹(하드 삭제 아님), 참조 보존.
- **specialty 필터**: 공개 목록은 인덱스 정렬된 `primarySpecialtyId` 사용(`idx_service_doctors_status_specialty`).
  전체 M:N 진료과 세트는 상세 엔드포인트에서 노출.

## 검증

- `jest service-domain` → 25/25 통과 (pure logic + service 흐름, 공개 매퍼 누출 차단 포함)
- `tsc --noEmit` (packages/features) → service-domain 0 error
- `biome lint service-domain` → clean
- 사전 존재(베이스 main) tsc 경고: `packages/core/auth/server.ts`의 better-auth CommonJS/ESM
  interop 4건은 본 변경과 무관(기존 `blog` 컨트롤러도 동일 import 경로 사용).

## 후속(merge/CI 단계)

OpenAPI generated client(`packages/api-client/src/generated/paths.ts`)는 실제 서버를
부팅해 `/api-docs/json`을 덤프하는 `pnpm api:codegen`으로 재생성된다. 이는 워크스페이스가
정상 설치된 체크아웃(merge 후 main 또는 CI)에서 실행해야 한다 — 격리 worktree의 심링크
node_modules는 `@repo/*`를 베이스 체크아웃으로 해석하므로 본 worktree에서 덤프하면 신규
라우트가 반영되지 않는다. **머지 후 `pnpm api:codegen` 실행 + `pnpm api:verify` 확인 필요.**
```
