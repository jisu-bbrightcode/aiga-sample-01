# Terms & Marketing Consent Design

> 가입 시 약관 관리 + 마케팅 동의 추적 기능

## 개요

서비스 가입 시 조회되는 약관 목록을 Admin에서 등록/관리하고, 마케팅 동의 여부를 날짜로 기록하여 Admin 사용자 관리에서 필터링할 수 있도록 한다.

## 접근 방식

**Profile feature 확장** — 기존 `packages/features/profile/` + core schema 확장

- 약관 테이블은 core schema에 추가 (가입 기반, 여러 feature에서 참조 가능)
- 마케팅 동의는 profiles 테이블에 컬럼 추가
- 약관 CRUD는 기존 ProfileService 확장
- Admin UI는 system-admin의 profile feature 확장

## 1. DB Schema

### profiles 테이블 컬럼 추가

| 컬럼 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `marketingConsentAt` | `timestamp(tz)` | `null` | 마케팅 동의 시각. null이면 미동의 |

- 동의 철회 시 `null`로 되돌림
- Admin에서 "동의/미동의" 필터 가능

### 신규 terms 테이블 (`packages/drizzle/src/schema/core/terms.ts`)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | |
| `name` | `varchar(200)` | 약관 이름 (예: "이용약관", "개인정보처리방침") |
| `url` | `text` | 약관 내용 URL |
| `isRequired` | `boolean` default `true` | 필수 여부 |
| `sortOrder` | `integer` default `0` | 표시 순서 |
| `isActive` | `boolean` default `true` | 활성 여부 |
| `createdAt` | `timestamp(tz)` | |
| `updatedAt` | `timestamp(tz)` | |

- core schema 위치 (feature prefix 없음)
- 물리 삭제 대신 `isActive: false`로 비활성 처리

## 2. Server (Backend)

### ProfileService 확장

**Terms CRUD 메서드:**

| 메서드 | 용도 | 접근 |
|--------|------|------|
| `listTerms(onlyActive?)` | 약관 목록 조회 | Public / Admin |
| `createTerm(input)` | 약관 등록 | Admin |
| `updateTerm(id, input)` | 약관 수정 | Admin |
| `deleteTerm(id)` | 약관 비활성화 | Admin |

**사용자 목록 필터 확장:**

- 기존 `listAll()`에 `marketingConsent` 필터 추가
- `"agreed"`: `marketingConsentAt IS NOT NULL`
- `"not_agreed"`: `marketingConsentAt IS NULL`

### tRPC Router 확장

```
profile.termsList        — publicProcedure (활성 약관만)
profile.termsAdminList   — adminProcedure (전체)
profile.termsCreate      — adminProcedure
profile.termsUpdate      — adminProcedure
profile.termsDelete      — adminProcedure
```

### REST Controller 확장

```
GET    /api/terms              — 활성 약관 목록 (Public)
GET    /api/admin/terms        — 전체 약관 목록 (Admin)
POST   /api/admin/terms        — 약관 등록
PATCH  /api/admin/terms/:id    — 약관 수정
DELETE /api/admin/terms/:id    — 약관 비활성화
```

기존 `GET /api/admin/profiles`에 `?marketingConsent=agreed|not_agreed` 쿼리 파라미터 추가.

### DTO

- `CreateTermDto`: name, url, isRequired, sortOrder
- `UpdateTermDto`: name?, url?, isRequired?, sortOrder?, isActive?

## 3. Admin UI (system-admin)

### 약관 관리 페이지

- **경로**: `/admin/terms`
- **메뉴**: feature-config.ts에 "약관 관리" 추가 (icon: `FileCheck`)
- 약관 목록 테이블: 이름, URL(링크), 필수여부 Badge, 정렬순서, 활성상태 Badge
- 상단 "약관 추가" 버튼 → Dialog로 등록 폼
- 행별 수정/비활성화 액션

### 사용자 관리 페이지 확장

- 필터 영역에 "마케팅 동의" 드롭다운: 전체 / 동의 / 미동의
- 테이블 컬럼에 "마케팅 동의" 추가: 동의 날짜 표시 또는 "미동의" 텍스트

### 파일 구조 (신규/수정)

```
apps/system-admin/src/features/profile/
├── pages/
│   ├── terms-admin.tsx          ← 신규
│   └── user-list.tsx            ← 수정 (마케팅 필터 + 컬럼)
├── routes/
│   └── admin/
│       └── terms.tsx            ← 신규
└── hooks/
    └── use-terms-mutations.ts   ← 신규
```

## 4. 가입 화면 연동

- 기존 SignUp 5개 variant + mobile-registration의 하드코딩 체크박스 **변경 없음**
- 필요 시 `profile.termsList` API로 동적 약관 목록 조회 가능 (추후)

## 범위 외

- 약관별 개별 동의 기록 (user_consents 테이블) — 현재 불필요
- 약관 버전 관리 — 현재 불필요
- 가입 화면 UI 변경 — 추후 필요 시
