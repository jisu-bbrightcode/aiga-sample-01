# 도메인 운영 관리자 범위 / 권한 (admin.domain-management)

> **PB-ADMIN-002** — 서비스 핵심 도메인 리소스에 대한 관리자 CRUD·공개 상태 관리·운영 필드·검색/필터/페이지네이션 범위와 권한 경계를 확정하는 **권위 문서(authoritative scope map)**.
>
> 이 문서는 실행 코드를 근거로 한다. 후속 CRUD task는 여기 정의된 리소스·연산·상태·권한·감사 정책을 그대로 따른다.
>
> 의존: PB-ADMIN-001(admin shell + RBAC 게이트 + 일반 감사 로그), PB-DOMAIN-001(`@repo/features/service-domain` 허브).
> 기준 커밋: `origin/main` (PB-ADMIN-001 #35, service-domain 허브 머지 이후).

---

## 1. 목적과 경계

관리자 콘솔(`apps/admin`)이 **다룰 수 있는 도메인 리소스**와 **금지된 작업**을 한 곳에서 정의한다. 데이터 정책은 워크스페이스 표준대로 **서버 권위(server-authoritative)** — 모든 변경은 서버 REST API + 서버 DB 검증 경로를 통과하며, 관리자 UI는 그 위의 얇은 클라이언트다.

이 문서의 범위는 **AIGA 서비스 핵심 도메인**(의사/병원/명의 큐레이션/검색 메타/서비스 분류·지역/사용자 등급·디렉터리)이다. 결제/이메일/본인확인/영상강의/커뮤니티/스케줄잡 등 **별도 feature가 자체 관리자 면**을 이미 소유한 리소스는 §6에서 경계만 교차 참조하고, 각 feature 문서가 권위를 가진다.

---

## 2. 권한 모델 (서버 + 클라이언트)

### 2.1 서버 게이트 — `OrgAdminGuard` / `BetterAuthAdminGuard`

- 모든 관리자 mutation/조회 엔드포인트는 `@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)`로 보호한다.
  - `BetterAuthGuard` — 인증. `request.user = { id, email, activeOrganizationId }` 주입.
  - `OrgAdminGuard` (`packages/core/nestjs/auth/org-admin.guard.ts`) — 인가. **fail-closed**.
- **권위 신호: Better Auth 조직 멤버십 역할** — `members.role ∈ {owner, admin}`. 클라이언트 가드(`useActiveOrganization().members[].role`)·슈퍼계정 부트스트랩(최초 운영자를 `owner` 멤버로 시드)과 동일한 신호다.
- **폴백:** 레거시 RBAC `user_roles`/`roles` 슬러그(`owner`/`admin`). 두 신호 중 하나면 충분하고 모두 strict admin 신호다. 어떤 오류든 `false`로 닫는다.
- `activeOrganizationId`가 있으면 해당 org로 멤버십을 스코프한다(멀티-org 분리).

> ⚠️ `NestAdminGuard`(레거시 alias)는 `user_roles`만 검사 → 시드되지 않은 배포에서 owner조차 403. **신규 관리자 엔드포인트는 반드시 `BetterAuthAdminGuard`(= `OrgAdminGuard` 합성)를 쓴다.** (PB-ADMIN-001에서 교정됨.)

### 2.2 클라이언트 가드 — `AdminGuard`

- `packages/core/auth` 의 `AdminGuard`로 라우트 래핑(`apps/admin/src/layouts/admin-layout.tsx`).
- `authenticated` + `userRole ∈ {owner, admin}` 확인, 실패 시 `/sign-in` 리다이렉트.
- 클라이언트 가드는 **UX 게이트일 뿐, 신뢰 경계는 서버 가드**다. 모든 보호 데이터는 서버에서 재검증한다.

### 2.3 운영자 역할 변경 — `AdminRoleService`

- `PATCH /admin/users/:id/role` (`@repo/features/_common`). `admin ↔ member` 전환만 허용.
- 안전 규칙(privileged surface — fail closed):
  - `admin`/`member` 사이 전환만. 그 외 역할 거부(400).
  - **`owner`는 이 엔드포인트로 절대 수정 불가**(403).
  - **본인 역할 변경 불가**(자기 잠금/자기 승격 차단, 403).
  - 대상은 이미 actor org의 멤버여야 함(404). 이 엔드포인트는 재-역할 부여이지 멤버십 생성이 아니다.
- 모든 전환은 `admin_audit_log`에 `user.role_changed`로 기록(§3).

### 2.4 신원 게이트(KCB)와의 구분

KCB 본인확인은 **로그인 대체가 아니라** 보호 액션/결제/성인/권한 확인용 identity gate다. 관리자 권한은 KCB 인증 결과가 아니라 **조직 멤버십 역할**로만 부여된다. 본인확인 raw PII는 관리자에게도 마스킹 뷰로만 노출된다(§6, §7).

---

## 3. 감사 로그 정책

세 계층을 명확히 구분한다.

| 계층 | 저장소 | 무엇을 기록 | 사용처 |
|------|--------|------------|--------|
| **일반 관리자 감사** | `admin_audit_log` (mig `0054`) via `AdminAuditService` | 도메인 전용 로그가 없는 모든 privileged mutation | admin shell 감사 뷰어(`/admin/audit-logs`) |
| **도메인 전용 감사** | `payment_audit_log` via 결제 `AuditService` | 결제/환불/크레딧/플랜 변경 | 결제 관리자 감사 탭 |
| **운영 추적 로그** | 앱 로거(`Logger.log` 라인, DB 컬럼 아님) | 카탈로그 편집(의사/병원/큐레이션/시노님 생성·수정·상태변경) | 서버 로그/관측성 |

### 3.1 `admin_audit_log` 계약 (`AdminAuditEntry`)

```
actorUserId   (required)  변경을 수행한 운영자
action        (required)  점 표기 액션 코드 (예: user.role_changed)
targetType    nullable    리소스 종류 (예: user, doctor, hospital, collection)
targetId      nullable    리소스 식별자
payloadBefore nullable    변경 전 스냅샷 (jsonb)
payloadAfter  nullable    변경 후 스냅샷 (jsonb)
ipAddress / userAgent / reason  nullable  요청 메타·사유
```

- `log()` = 단일 append-only INSERT(잠금 없음). `list()` = `id DESC` + 필터 + cursor 페이지네이션(기본 50, 최대 200).
- 액션 코드는 DB enum이 아니라 코드 상수(`AdminAuditAction`)로 관리 — feature가 자유롭게 추가.

### 3.2 무엇을 반드시 감사하는가 (정책)

- **MUST(일반 감사 로그 행):** 운영자 권한 변경, 사용자 등급 수동 배정/회수, soft-delete/복구, 공개 상태 강제 변경 등 **권한·노출·신원에 영향을 주는 모든 변경**.
- **SHOULD(운영 추적 로그 라인 이상):** 카탈로그 콘텐츠 편집(이름/설명/featured 등). 현 카탈로그 서비스는 `createdBy`/`updatedBy` 컬럼 + Logger 라인으로 추적; 민감/권한 변경으로 격상되면 `admin_audit_log` 행으로 승격한다.
- **감사 행에 PII·비밀을 넣지 않는다.** `payloadBefore/After`는 상태 전이·식별자 위주로 최소화.

> **후속 task 규칙:** 새 관리자 mutation이 **권한·공개노출·신원·삭제** 중 하나라도 건드리면 `AdminAuditService.log(...)` 호출이 acceptance criteria에 포함되어야 한다.

---

## 4. 도메인 관리자 리소스 맵

각 리소스의 **소유 패키지 · 현재 관리자 라우트(머지됨) · 허용 연산 · 금지 연산 · 후속 CRUD 갭**. 모든 경로는 `apps/server` REST(`BetterAuthAdminGuard` 게이트).

### 4.1 핵심 카탈로그 (PB-DOMAIN-001 허브 · `@repo/features/service-domain`)

| 리소스 | 테이블 | 현재 관리자 라우트(`service/admin/...`) | 허용 연산 | 갭(후속 CRUD) |
|--------|--------|------------------------------------------|-----------|----------------|
| **의사 Doctor** | `service_doctors` | `POST doctors` · `PUT doctors/:id` · `PATCH doctors/:id/status` · `DELETE doctors/:id`(soft) | 생성·수정·상태변경·소프트삭제 | 목록/상세 admin 조회 뷰(필터·페이지네이션), 복구(undelete) |
| **의사 이력 Credential** | `service_doctor_credentials` | `POST doctors/:id/credentials` | 생성 | **수정·삭제·정렬 (현재 create-only)** |
| **병원 Hospital** | `service_hospitals` | `POST hospitals` · `PUT hospitals/:id` · `PATCH hospitals/:id/status` · `DELETE hospitals/:id`(soft) | 생성·수정·상태변경·소프트삭제 | 목록/상세 admin 조회 뷰, 복구 |
| **병원 진료과 링크** | `service_hospital_specialties` | `POST hospitals/:id/specialties` | 추가(409 중복) | **링크 제거(detach)** |
| **병원 운영시간 Hours** | `service_hospital_hours` | `POST hospitals/:id/hours` | 추가(요일 중복 409) | **수정·삭제** |
| **진료과 Specialty(분류)** | `service_specialties` | — (공개 `GET /service/specialties`만) | (없음) | **마스터 데이터 admin CRUD 전체** |
| **지역 Region(분류)** | `service_regions` | — (공개 `GET /service/regions`만) | (없음) | **마스터 데이터 admin CRUD 전체** |

### 4.2 명의 큐레이션 (PB-FEAT-004 · `@repo/features/doctor-curation`)

| 리소스 | 테이블 | 현재 관리자 라우트(`service/curation/admin/collections`) | 허용 | 갭(후속) |
|--------|--------|----------------------------------------------------------|------|----------|
| **컬렉션(기획전)** | `service_doctor_collections` | `POST` · `GET` · `GET :id` | 생성·목록·상세 | **수정·상태변경·소프트삭제·컬렉션 아이템(추가/제거/정렬)** |

- `kind` enum: `editorial` / `specialty`(→`service_specialties` 스코프) / `region`(→`service_regions` 스코프). `kind ↔ scope` 정합성은 생성 시 refine.
- 상태는 허브 `service_publish_status` 재사용(§5).

### 4.3 통합 검색 메타 (PB-DATA-FR003 · `@repo/features/service-search`)

| 리소스 | 성격 | 현재 관리자 라우트(`service/search/admin`) | 허용 | 금지/주의 |
|--------|------|---------------------------------------------|------|-----------|
| **시노님 Synonym** | 운영자만 생성 가능한 검색 보조 사전 | `GET` (목록) | 조회 | **생성/수정은 BBR-533에서 추가(현 main read-only)**; documents=리인덱스 투영(직접 편집 금지), query log=append-only(편집 금지) |

- 검색 문서(`service_search_documents`)는 카탈로그의 **투영(projection)**이다. 관리자는 원본(의사/병원)을 편집하고 재색인이 반영하지, 문서를 직접 CRUD하지 않는다 → **금지 작업**.

### 4.4 사용자 등급 / 디렉터리

| 리소스 | 소유 패키지 | 관리자 라우트 | 허용 | 금지 |
|--------|-------------|----------------|------|------|
| **사용자 등급 배정** | `@repo/features/user-grade` | `POST /admin/users/:userId/grade` · `GET /admin/users/:userId/grade` · `GET /admin/user-grades` | 수동 등급 배정(provenance·감사) + 조회 | 등급 **정의 자체** 변경(시드 관리) |
| **사용자 디렉터리(조회)** | `@repo/features/user-directory` | `GET /admin/users` · `GET /admin/users/:id` | 목록/상세 조회 | 편집 없음(읽기 전용) |
| **운영자 역할** | `@repo/features/_common` | `PATCH /admin/users/:id/role` | `admin↔member` | owner 변경·본인 변경(§2.3) |
| **감사 로그** | `@repo/features/_common` | `GET /admin/audit-logs` | 조회 | 변경/삭제 불가(append-only) |

> **사용자 계정 생성/삭제는 관리자 범위 밖이다.** 가입은 Better Auth 소셜 로그인 + `user.create` 훅으로만 발생한다. 관리자는 **역할/등급만** 조정한다.

---

## 5. 운영 상태값 (operational status)

### 5.1 카탈로그 공개 라이프사이클 — `service_publish_status`

`draft → published → archived`, **편집자에 의해 자유롭게 가역**. 의사/병원/큐레이션 컬렉션이 공유.

- **오직 `published`만 공개 노출.** `draft`/`archived`는 어떤 공개 표면에도 나오지 않는다.
- `publishedAt` 규칙(`service-domain/status.ts` `resolveStatusChange`, 순수 함수):
  - 최초 publish 시 `publishedAt` 스탬프.
  - 재-publish는 기존 스탬프 보존(unpublish→republish가 원래 시각 유지).
  - `published`를 벗어나면(`draft`/`archived`) `publishedAt = null`.
- 상태 전환은 전용 엔드포인트(`PATCH .../:id/status`)로만 — 직접 컬럼 쓰기 금지.

### 5.2 노출/운영 플래그

- **`isFeatured`**(+의사 `featuredRank`) — 편집 하이라이트(명의 레일). `published`일 때만 공개 효과.
- **소프트 삭제** — `deletedAt`/`deletedBy`(`baseColumnsWithSoftDelete`). **하드 삭제 금지**; 모든 `DELETE`는 soft. 복구는 후속 task에서 정의.
- **`createdBy`/`updatedBy`** — 편집 출처(감사 추적용, admin-only).

### 5.3 인접 리소스 상태(교차 참조)

- 큐레이션 컬렉션: `service_publish_status` 재사용 + `kind`(editorial/specialty/region).
- 시노님: `active` 불리언(기본 active), append-only 성격.
- (결제/파일/영상/본인확인 상태 enum은 각 feature 문서가 권위 — §6.)

---

## 6. 도메인 외부 — 별도 feature 관리자 면 (경계만)

다음 리소스는 자체 관리자 컨트롤러·문서를 이미 소유한다. PB-ADMIN-002 범위는 **경계 인지**까지이며 CRUD 변경은 해당 feature task에서 다룬다.

| 영역 | 관리자 컨트롤러(루트) | 권위 문서 |
|------|----------------------|-----------|
| 결제 | `admin/payment`, `admin/payment/inicis` | 결제 feature 문서 |
| 이메일 | `admin/email` | 이메일 템플릿/로그 문서 |
| 본인확인(KCB) | `admin/identity-verifications` | KCB 문서(마스킹 PII만) |
| 영상강의 | `admin/video-lectures` | 영상강의 문서 |
| 커뮤니티 모더레이션 | `admin/community` | 커뮤니티 문서 |
| 스케줄 잡 | `admin/scheduled-job` | 운영 잡 문서 |

---

## 7. 전역 금지 작업 (prohibited)

관리자 면 전반에서 **명시적으로 금지**한다:

1. **사용자 계정 생성/삭제** — 가입은 소셜 로그인 전용. 관리자는 역할/등급만.
2. **`owner` 역할 변경 / 본인 역할 변경** — `AdminRoleService`가 거부.
3. **하드 삭제** — 도메인 리소스는 soft-delete만. 물리 삭제·DB 직접 변경 금지.
4. **공개 라이프사이클 우회** — `published` 노출은 status 전환으로만. 상태/`publishedAt` 직접 쓰기 금지.
5. **검색 문서/쿼리 로그 직접 편집** — 문서는 투영(재색인), 쿼리 로그는 append-only.
6. **결제 원장(ledger) 직접 수정** — 환불/크레딧은 결제 도메인 엔드포인트(자체 감사)로만.
7. **본인확인 raw PII 접근** — 관리자에게도 마스킹 뷰만. 익명화(`anonymized_at`) 이후 복원 불가.
8. **감사 로그 변경/삭제** — append-only.
9. **게이트 우회** — 신규 관리자 엔드포인트는 반드시 `BetterAuthAdminGuard`. 클라이언트 가드만으로 보호 데이터 노출 금지.

---

## 8. 관리자 목록 규약 (검색/필터/페이지네이션)

후속 관리자 **목록/조회** task는 다음 규약을 따른다:

- **페이지네이션:** keyset/cursor 우선(`id DESC` 또는 `(created_at, id)` desc) — `admin_audit_log.list`·디렉터리·개인화 목록과 일관. opaque 커서, 기본 limit 50(또는 20), 하드 캡 200.
- **필터:** 리소스별 `status`(draft/published/archived), `includeDeleted`(기본 false), 정렬 키(`updatedAt` desc 기본), 텍스트 검색(name/slug `ilike` `or`).
- **필드 분리(fail-closed 매퍼):** 관리자 뷰는 admin-only 필드 포함(`status`, `internalNotes`, `sourceUrl`, `businessRegistrationNo`, `createdBy/updatedBy`, soft-delete 컬럼). 공개 매퍼는 이들을 **절대** 누출하지 않으며 `mappers.spec`가 이를 단언. 신규 관리자 DTO는 공개 DTO와 분리한다.
- **인덱스:** 관리자 콘솔 정렬은 `idx_*_updated_at` 등 전용 인덱스를 사용.

---

## 9. 후속 CRUD task 수용 경로 템플릿 (acceptance path)

AC#2("후속 CRUD task가 각자 검증 가능한 acceptance path를 가진다")를 위해, §4 갭에서 파생되는 각 CRUD task는 아래 6개 검증 축을 채운다:

1. **권한:** `BetterAuthGuard + BetterAuthAdminGuard`로 게이트 + 비관리자 403 테스트(class-level guard 메타 reflect 또는 통합).
2. **검증:** zod DTO 입력 검증(400), 부모 존재(404), 유니크 충돌(409), 상태 enum 유효성.
3. **상태/노출:** 공개 라이프사이클·soft-delete 규칙 준수, 공개 표면에 `published`만 노출(매퍼 spec).
4. **감사:** 권한/노출/신원/삭제 변경이면 `admin_audit_log` 행, 그 외 카탈로그 편집이면 최소 Logger 라인 + `updatedBy`.
5. **금지작업:** §7 위반 경로가 막혀 있음을 테스트(하드삭제 부재, owner/self 거부, 직접 status write 부재).
6. **회귀:** 기존 service-domain/관련 suite green, tsc 0, biome clean, 마이그레이션 없으면 renumber race 없음.

### 9.1 식별된 후속 CRUD task 후보 (각각 별도 issue로 위임)

| # | 리소스/연산 | 근거(§4 갭) |
|---|-------------|-------------|
| A | 의사/병원 **관리자 목록·상세 조회 뷰**(필터·페이지네이션) | 4.1 |
| B | 의사 이력 credential **수정·삭제·정렬** | 4.1 |
| C | 병원 진료과 **detach** + 운영시간 **수정·삭제** | 4.1 |
| D | **진료과·지역 마스터 데이터** admin CRUD | 4.1 |
| E | 큐레이션 컬렉션 **수정·상태변경·소프트삭제 + 아이템 관리** | 4.2 |
| F | 시노님 **생성/수정**(BBR-533) | 4.3 |
| G | 도메인 리소스 **soft-delete 복구(undelete)** | 5.2 |

> 각 후보는 본 문서를 참조해 acceptance criteria를 §9 6축으로 작성한 별도 issue로 만든다. 본 task(PB-ADMIN-002)는 **범위·경계·정책 확정**까지가 deliverable이다.

---

## 부록 A. 코드 레퍼런스

| 구성요소 | 경로 |
|----------|------|
| 서버 관리자 가드 | `packages/core/nestjs/auth/org-admin.guard.ts` (`OrgAdminGuard` = `BetterAuthAdminGuard`) |
| 일반 감사 서비스/스키마 | `packages/features/_common/service/admin-audit.service.ts` · `packages/drizzle/src/schema/core/admin-audit.ts` (mig `0054`) |
| 운영자 역할 변경 | `packages/features/_common/service/admin-role.service.ts` · `controller/admin-users.controller.ts` |
| 감사 뷰어 | `apps/admin/src/pages/admin/audit-logs.tsx` · `_common/controller/admin-audit.controller.ts` |
| 카탈로그 관리자 컨트롤러 | `packages/features/service-domain/controller/service-domain-admin.controller.ts` |
| 공개 라이프사이클 순수 함수 | `packages/features/service-domain/status.ts` |
| 공개/관리자 필드 분리 매퍼 | `packages/features/service-domain/mappers.ts` (+ `mappers.spec.ts`) |
| 큐레이션 관리자 컨트롤러 | `packages/features/doctor-curation/controller/doctor-curation-admin.controller.ts` |
| 검색 시노님 관리자 컨트롤러 | `packages/features/service-search/controller/service-search-admin.controller.ts` |
| 클라이언트 가드 | `packages/core/auth` `AdminGuard` · `apps/admin/src/layouts/admin-layout.tsx` |
