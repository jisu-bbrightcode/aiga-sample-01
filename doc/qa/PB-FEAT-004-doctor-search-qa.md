# QA — 명의 찾기 검색·필터·정렬 (FR-004 / BBR-493)

- **Feature card:** 명의 (MVP) — 명의 찾기 검색·필터·정렬
- **Selected surface:** 어플리케이션 (in-app explore). 공개 사이트(apps/site/doctors)와 관리자/AI surface는 본 카드 범위 밖이라 SKIP 사유를 아래에 명시.
- **Verified against:** `origin/main` @ `e185383` (FR-004 DATA/API/APP 의존 task 전부 merge 완료).
- **Verdict:** ✅ PASS — acceptance path 검증됨. 잔여 리스크는 모두 비차단(설계상 의도된 동작 또는 후속 feature 의존)이며 아래에 기록.

## 1. 검증 범위 (surface mapping)

| 영역 | 결정 | 근거 |
|------|------|------|
| 앱(application) | **검증** | explore 화면의 검색·필터·정렬이 본 카드의 선택 surface. `apps/app/src/features/service-flow`. |
| 공개(site) | 참조만 | `apps/site/src/app/doctors`는 별도 카드. 동일 공개 contract(`GET /service/doctors`)를 읽으므로 서버 계약 검증이 간접 커버. |
| 관리자(admin) | N/A | 의사 CRUD/상태 관리는 FR-004 API-CREATE/UPDATE/DELETE 카드 소관(별도 QA). 본 카드는 read-only 탐색. |
| AI | N/A | 본 기능 카드에 AI 흐름 없음. |

## 2. Acceptance path

**흐름:** 비로그인 사용자가 `/explore` 진입 → 키워드/진료과/지역 필터 + 정렬(추천순·평점순) → `GET /service/doctors` 결과 그리드 → 저장/관심 액션 시 로그인 모달(return-to-intent).

상태(URL)가 단일 진실원: `useSearch` → `parseDoctorSearch` → 필터 → `toDoctorListParams` → 서버 쿼리. 공유 가능하고 검색 히스토리에서 재실행 가능.

### 정렬 레버 (API/UI 일관성)

카탈로그에는 자유 sort 파라미터가 없고 `featured` boolean이 유일한 정렬 레버다. UI sort는 클라이언트 임의 정렬을 만들지 않고 실제 서버 쿼리에 매핑된다:

| UI sort | 서버 호출 | ORDER BY |
|---------|-----------|----------|
| 추천순 `recommended` | `featured=true` | `featured_rank` asc, `rating_avg` desc |
| 평점순 `rating` | `featured` 생략 | `rating_avg` desc, `created_at` desc |

## 3. 테스트 결과

| 스위트 | 결과 |
|--------|------|
| 서버 `service-domain` jest | **53 passed** (신규 QA 4건 포함) |
| 서버 `doctor-curation` jest | **40 passed** (편집 컬렉션 lifecycle/public/mappers) |
| 앱 `service-flow` vitest | **55 passed / 11 files** |

### 신규 QA 커버리지 (close된 gap)

기존 서버 테스트는 `listDoctors` 기본 케이스(페이지네이션 + 민감필드 누출 차단)만 검증했고, **앱 정렬 기능이 의존하는 `featured` 기반 ORDER BY 전환과 필터 WHERE 절은 서버 측에서 무검증**이었다. `service-domain/service/list-doctors-search.qa.spec.ts` 추가로 고정:

1. 추천순 → `is_featured` 필터 + `featured_rank` asc / `rating_avg` desc 정렬.
2. 평점순 → featured 필터 없음 + `rating_avg` desc / `created_at` desc 정렬.
3. 키워드·진료과·지역 필터가 모두 WHERE 절에 도달(키워드는 `ilike(name)`).
4. count 쿼리가 items 쿼리와 동일 WHERE 재사용 → total 일관.

드리즐 SQL의 컬럼명·정렬방향을 직접 디코드해 단언하므로 쿼리 리팩터에도 견고하며, asc/desc를 뒤집거나 필터를 빠뜨리는 회귀를 잡는다.

## 4. 권한 / 상태 검증

- **공개 탐색:** `/explore`와 `GET /service/doctors`는 비인증. 로그인 없이 브라우징 가능(online-service 규칙 충족). `doctors.isPending`만으로 enabled — 401 보장 요청을 쏘지 않음.
- **노출 게이트:** 목록은 `status='published' AND is_deleted=false`만 반환. draft/삭제 의사는 목록·상세 모두 비노출(상세는 동일 404). 민감 컬럼(`licenseNumber`,`status`,`internalNotes`)은 public mapper에서 차단 — `mappers.spec.ts` + `listDoctors` 테스트가 누출 부재 단언.
- **보호 액션 게이트:** 저장/관심은 `GatedSaveButton`/`GatedActionButton`. 비로그인 → `buildSignInIntentPath(next)`로 sign-in 라우팅, 로그인 후 원위치 복귀 + `usePendingIntentReplay`로 시도했던 액션 재생(AC: 원래 액션 자동 복귀). gated 버튼 7건 + intent 라이브러리 테스트로 커버.
- **에러 표면:** 그리드 에러 상태는 `getAppErrorMessage(t, error)` 경유 — raw error.message 비노출(CLAUDE.md 정책 준수).

## 5. 잔여 리스크 (비차단)

1. **진료과 필터 = 주 진료과만.** WHERE는 `primary_specialty_id`만 매칭(인덱스 `idx_service_doctors_status_specialty` 정렬). 의사의 M:N 부가 진료과는 필터에 안 걸림 — 부가로 정형외과를 보는 내과 주전공 의사는 "정형외과" 필터에서 누락. 설계상 의도(상세에서 전체 진료과 노출)이나, 사용자 기대와 어긋날 수 있으므로 향후 M:N join 필터 고려.
2. **추천순은 재정렬이 아니라 필터링.** 추천순 선택 시 `featured=true`로 **featured 의사만** 좁혀짐(전체 재정렬 아님). 카탈로그에 다른 정렬 레버가 없어 생긴 제약. featured 의사가 적은 초기 데이터에서는 추천순 결과가 빈약할 수 있음 — empty-state 카피로 완화되나 제품 결정 필요.
3. **저장 WRITE 미연결.** `GatedSaveButton`의 로그인 상태 경로는 실제 저장 mutation이 아니라 내 페이지로 라우팅 + 토스트(저장 WRITE는 BBR-726, 미 merge). 의도된 임시 동작 — 명시적으로 문서화됨.
4. **앱 측 정렬/필터 E2E 부재.** 단위(파라미터 파싱·컨트롤·서버 계약)는 견고하나, URL ↔ 그리드 라운드트립의 브라우저 E2E(Playwright)는 없음. 현 단위 커버리지로 충분하다고 판단, 후속 통합 시 보강 권장.
5. **지역 필터 하위지역 비전개.** `GET /service/regions?parentId=`로 트리 조회는 가능하나 컨트롤은 평면 목록 사용 — 상위 지역 선택 시 하위지역 자동 포함은 미구현(현 데이터 규모에서 비차단).

## 6. 검증 방법 재현

```bash
# 서버 계약 (jest)
cd packages/features
NODE_OPTIONS=--experimental-vm-modules jest service-domain doctor-curation

# 앱 흐름 (vitest)
cd apps/app
NODE_ENV=test vitest run src/features/service-flow
```
