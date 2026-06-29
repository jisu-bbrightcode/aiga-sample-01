# PB-FEAT-FR-005-API-CREATE — 프로필 생성 API (BBR-543)

- Capability: `domain.feature.fr-005.api.create`
- Decision: **NEW** (Backend Engineer)
- Depends on: FEAT-FR-005-DATA (BBR-523, 프로필 데이터 모델), PB-DOMAIN-001 (BBR-525, 핵심 서비스 REST API)
- Target: `packages/features/service-domain` (wired into `apps/server`)

## 결정값과 근거

FR-005 "프로필"은 PB-DOMAIN-001이 만든 의사/병원 핵심 레코드 위에 얹는 **상세 프로필 레이어**다.
FEAT-FR-005-DATA가 추가한 3개 테이블을 대상으로 한다:

- `service_doctor_credentials` — 의사 프로필 이력(학력/경력/자격/수상)
- `service_hospital_specialties` — 병원 진료과(병원 상세)
- `service_hospital_hours` — 병원 운영시간(병원 상세)

PB-DOMAIN-001은 이 테이블들의 **생성 API가 없었다**. 본 task는 그 생성 API + 입력 검증 +
초기 상태 + 권한 + 감사 로그를 NestJS Swagger(OpenAPI 단일 소스) + zod DTO 패턴으로 EXTEND한다.

## 라우트 (관리자 전용 — `BetterAuthGuard` + `BetterAuthAdminGuard`)

| Method | Path | 설명 |
|--------|------|------|
| POST | `/service/admin/doctors/:id/credentials` | 의사 프로필 이력 생성(학력/경력/자격/수상) |
| POST | `/service/admin/hospitals/:id/specialties` | 병원 진료과 추가 |
| POST | `/service/admin/hospitals/:id/hours` | 병원 운영시간 추가(요일별) |

생성 결과 조회 반영(공개 상세, published만):

- `GET /service/doctors/:slug` → `credentials[]`(visible만, kind→sortOrder 정렬) 추가
- `GET /service/hospitals/:slug` → `specialties[]`(활성/sortOrder 정렬) + `hours[]`(요일순) 추가

## 핵심 설계 결정

- **입력 검증(필수 필드)**: zod DTO를 경계에서 강제.
  - credential: `kind`(enum), `title`(필수, ≤200) 필수. `startYear/endYear` 1900–2200, `sortOrder≥0`.
  - hours: `dayOfWeek` 0–6, `opensAt/closesAt` `HH:MM` 정규식.
  - specialty: `specialtyId` UUID.
- **권한 없는 생성 차단**: 세 라우트 모두 admin 가드 뒤에 위치(공개/사용자 컨트롤러에는 없음).
- **참조 무결성**: credential은 부모 의사, specialty/hours는 부모 병원 존재를 선검증(404).
  specialty는 활성 진료과 존재도 선검증(404).
- **초기 상태**: credential `isVisible=true`(편집자가 숨기기 전 공개), `sortOrder=0`;
  hours `isClosed=false`.
- **중복 처리(409)**: 병원 진료과(복합 PK)·병원 운영시간(`uq_hospital_hours_hospital_day`)
  unique 위반을 리소스별 메시지의 `ConflictException`으로 매핑.
- **감사 로그**: 생성 시 actor id + 리소스 식별자를 서버 로그로 기록(테이블에 createdBy 컬럼
  없음 — FR-005-DATA 스키마 동결 유지, 마이그레이션 미추가).
- **public/admin 분리 유지**: 공개 매퍼(`toPublicDoctorCredential`/`toPublicHospitalHours`)는
  `isVisible` 같은 편집자 전용 필드를 제외. 관리자 생성 응답만 전체 필드 노출.

## 마이그레이션

**없음.** 대상 테이블은 FEAT-FR-005-DATA(PR #16, main 78e0269)에서 이미 생성됨. 본 task는
API 전용이라 신규 마이그레이션이 없어 동시 머지 renumber 경쟁이 발생하지 않는다.

## 검증

- `jest service-domain` → 34/34 통과 (신규 9: credential/specialty/hours 생성 happy/404/409 +
  상세 조회 일관성 2)
- `tsc --noEmit` (packages/features, service-domain) → 0 error
- `biome check` → 신규/변경 파일 clean
- 격리 worktree는 베이스 체크아웃이 구 브랜치라 `@repo/drizzle/schema`가 FR-005 export를
  못 찾으므로, tsc 검증은 worktree 자체 drizzle 소스로 path 매핑해 확인.

## 후속(merge/CI 단계)

OpenAPI generated client은 머지 후 정상 체크아웃에서 `pnpm api:codegen` + `pnpm api:verify`로
재생성한다(격리 worktree 심링크 node_modules는 신규 라우트를 누락시킴 — PB-DOMAIN-001 doc 참조).
