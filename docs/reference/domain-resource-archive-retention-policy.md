# 도메인 리소스 비활성/archive · 연결 데이터 보존 정책 (admin.domain.delete)

> **PB-ADMIN-DOMAIN-DELETE-001 / BBR-682** — 관리자가 핵심 도메인 리소스(의사/병원)를
> **실제 삭제 대신 비활성/archive** 처리하고 공개 노출을 차단하되 연결 데이터를
> 안전하게 보존하는 흐름의 권위 정책.
>
> 상위 범위/권한/감사 정책은 [admin-domain-management.md](./admin-domain-management.md)
> (PB-ADMIN-002, §3 감사 · §5 상태 · §7 금지작업)를 따른다. 본 문서는 그 §9.1 후속
> 후보 중 **archive 라이프사이클**을 구체화한다.
>
> 의존: PB-ADMIN-DOMAIN-READ-001(상세 조회, #96), PB-DOMAIN-001(`service-domain` 허브).

---

## 1. 무엇을 하는가

archive는 **삭제가 아니다.** 카탈로그 행과 모든 연결 데이터는 그대로 두고, 공개
라이프사이클 상태만 내려 공개/앱 노출을 차단한다. 되돌릴 수 있다(restore).

| 동작 | 상태 전이 | 효과 |
|------|-----------|------|
| **archive (비활성)** | `published`·`draft` → `archived`, `publishedAt = null` | 공개/앱 노출 즉시 차단, 관리자 콘솔엔 유지 |
| **restore (복구)** | `archived` → `draft`, `publishedAt = null` | 비공개 초안으로 되살림(자동 재게시 ❌ — 재공개는 별도 발행) |

- 두 동작 모두 **멱등**: 이미 archived 면 archive는 추가 write 없이 현재 상태 반환,
  archive 가 아니면 restore 는 게시 상태를 함부로 내리지 않고 그대로 반환.
- soft-delete(`isDeleted=true`)된 리소스는 archive/restore 대상이 아니다(404). 삭제
  복구는 별도 경로(§5.2 admin-domain-management).

## 2. 노출 차단 (Acceptance #1 — archive된 리소스는 공개/앱 노출에서 제외된다)

공개/앱 표면은 모두 `status = 'published' AND isDeleted = false` 만 노출한다
(`ServiceDomainService.listDoctors`/`getDoctorBySlug`/`listHospitals`/`getHospitalBySlug`).
archive 는 status 를 `archived` 로 바꾸므로 **즉시** 모든 공개 표면에서 사라진다.

- 의사 상세의 소속 병원, 병원 상세의 소속 의사도 동일 필터를 거치므로, archive 된
  리소스는 **다른 published 리소스의 연관 목록을 통해서도** 노출되지 않는다.
- 관리자 콘솔(`admin/domain/resources*`)은 모든 상태를 보므로 archived 리소스는 계속
  조회·복구 가능하다.

## 3. 연결 데이터 보존 (Acceptance #2 — 기존 주문/이력/감사 데이터는 보존된다)

archive/restore 는 **대상 행의 `status` + `publishedAt` + `updatedBy` 컬럼만** 갱신한다.
물리 DELETE 는 발생하지 않으며, 아래 연결 데이터는 행이 그대로 살아남는다:

- 의사: 진료과 링크(M:N), 소속 병원 링크, 이력(credentials)
- 병원: 진료과 링크, 소속 의사 링크, 운영시간(hours)
- 횡단: 명의 큐레이션 컬렉션 아이템, 검색 문서/쿼리 로그, 감사 이력 등 이 리소스를
  참조하는 하위 데이터 — archive 는 참조 무결성을 깨지 않는다.

→ 따라서 운영/이력/감사 데이터는 archive 전후로 동일하게 보존되며, restore 시 연결
데이터가 그대로 복귀한다.

## 4. 감사 로그 (Deliverable — 감사 로그)

모든 archive/restore 전이는 공개 노출에 영향을 주는 privileged mutation 이므로
`admin_audit_log` 에 append-only 로 1행 기록한다(PB-ADMIN-002 §3.2 MUST).

```
action        service_domain.archived | service_domain.restored
targetType    service_doctor | service_hospital
targetId      리소스 id
payloadBefore { status, publishedAt }   (전이 전 — PII/비밀 없음)
payloadAfter  { status, publishedAt }   (전이 후)
actorUserId   변경을 수행한 운영자
```

멱등 경로(상태 변화 없음)에서는 write 도 감사도 발생하지 않는다.

## 5. API 표면

`admin/domain` 베이스(상세 조회와 동일, `BetterAuthGuard + BetterAuthAdminGuard`):

| 메서드 | 경로 | 응답 |
|--------|------|------|
| `POST` | `/api/admin/domain/resources/:type/:id/archive` | `{ type, id, name, slug, status, isDeleted }` |
| `POST` | `/api/admin/domain/resources/:type/:id/restore` | 동일 |

- `type ∈ { doctor, hospital }`, `id` = uuid (zod 검증, 400). 없는 리소스 404.
- 관리자 콘솔 UI(`apps/admin/src/features/domain`)는 상세 화면 헤더의 **보관/복구**
  버튼 → 확인 다이얼로그 → mutation → 상세·목록 쿼리 무효화 + 토스트로 소비한다.

## 6. 검증 (PB-ADMIN-002 §9 6축)

1. 권한: 두 엔드포인트 class-level `BetterAuthGuard + BetterAuthAdminGuard`.
2. 검증: zod param(type enum/uuid), 없는 리소스 404.
3. 상태/노출: archive→`archived`+`publishedAt=null`(공개 표면 제외), restore→`draft`.
4. 감사: 전이마다 `admin_audit_log` 행(before/after), 멱등 경로는 무기록.
5. 금지작업: 하드삭제 없음(soft·상태 전이만), 직접 status write 없음(전용 엔드포인트).
6. 회귀: service-domain jest green, tsc 0, biome clean, **마이그레이션 없음**(컬럼은
   PB-DATA-001 이후 main 에 존재).
