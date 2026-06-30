# 커뮤니티 멤버/모더레이터 노출 정책 (PB-COMM-MEMBER-API-001 / BBR-592)

`GET /community/:slug/members`, `GET /community/:slug/moderators` 의 공개/운영 필드 분리와
banned/left/deleted 사용자 노출 규칙을 정의한다.

## 뷰어 등급

| 등급 | 판정 | 비고 |
|------|------|------|
| 공개(public) | 비로그인 또는 일반 멤버 | 기본값. fail-closed |
| 운영(operational) | 차단되지 않은 `moderator` / `admin` / `owner` 멤버 | `canViewOperational()` |

운영 등급은 **해당 커뮤니티의** 멤버십 role 로만 판정한다(전역 admin 아님). 차단된(banned)
모더레이터는 운영 권한을 잃는다.

## AC#1 — 공개 정보와 운영 정보 분리

projection 은 순수 함수(`member-mappers.ts`)에서 필드를 하나씩 복사한다. row 에서
`delete` 하지 않으므로 **새 컬럼은 기본적으로 공개 view 에서 제외**된다(fail-closed).

### 멤버

- 공개 필드: `userId`, `role`, `tier`, `flairText`, `flairColor`, `joinedAt`
- 운영 전용: `id`, `communityId`, `isBanned`, `bannedAt`, `bannedReason`, `bannedBy`,
  `banExpiresAt`, `isMuted`, `mutedUntil`, `notificationsEnabled`,
  `onboardingCompletedAt`, `rulesAcceptedAt`

### 모더레이터

- 공개 필드: `userId`, `appointedAt` (누가 모더레이터인지만)
- 운영 전용: `id`, `communityId`, `permissions`, `appointedBy`

응답에는 `operational: boolean` 플래그가 포함되어 클라이언트가 어떤 뷰를 받았는지 구분한다.

## AC#2 — banned / left / deleted 노출 정책

| 상태 | 데이터 표현 | 공개 view | 운영 view |
|------|-------------|-----------|-----------|
| **active** | membership row, `isBanned=false` | 노출 | 노출 |
| **muted** | row, `isMuted=true` (밴 아님) | 노출(활성 멤버) | 노출, `status=muted` 로 필터 |
| **banned** | row, `isBanned=true` | **제외** | 노출, `status=banned` 로 필터 |
| **left** | 탈퇴 시 membership row 삭제 | 제외(행 없음) | 제외(행 없음) |
| **deleted** | user 삭제 → FK `onDelete: cascade` 로 row 삭제 | 제외(행 없음) | 제외(행 없음) |

- 공개 view 는 항상 `isBanned=false` 조건을 강제한다. 공개 요청으로 `status=banned`/`muted`
  를 보내도 무시되고 활성 멤버만 반환된다(권한 상승 방지, `resolveMemberStatusFilter`).
- left/deleted 는 별도 tombstone 없이 행 삭제로 처리되므로 어떤 view 에서도 노출되지 않는다.

## 필터 / 페이지네이션

- `role`: `member` / `moderator` / `admin` / `owner` (알 수 없는 값은 무시)
- `status`: `active` / `banned` / `muted` (운영 view 에서만 banned/muted 적용)
- `page` (기본 1), `limit` (기본 50, 최대 100)
- 정렬: 멤버 `joined_at desc`, 모더레이터 `appointed_at asc`

## 구현 위치

- `packages/features/community/member-mappers.ts` — 공개/운영 projection (순수)
- `packages/features/community/service/member-list-options.ts` — 필터 파싱(순수)
- `packages/features/community/service/community.service.ts` — `getMembers` / `getModerators`
- `packages/features/community/controller/community.controller.ts` — 엔드포인트 + `@OptionalUser`

마이그레이션 없음 — 기존 `community_memberships` / `community_moderators` 컬럼만 사용한다.
