# 관리자 커뮤니티 콘텐츠 복구 API (PB-COMM-ADMIN-001 / BBR-1095)

BBR-699 프론트가 노출하는 관리자 모더레이션 계약에는 report resolve, ban/unban,
sanctions, sanction history 는 있으나 **콘텐츠 복구(restore/recover)** 가 빠져 있었다.
이 문서는 그 델타로 추가된 server-authoritative 복구 엔드포인트의 계약을 정의한다.

## 엔드포인트

```
POST /admin/community/restore
```

- 가드: `BetterAuthGuard` + `BetterAuthAdminGuard` (관리자) + 서비스 레벨
  `assertCommunityPermission(owner|admin|moderator)` — 기존 `admin/community` 엔드포인트
  (report resolve, ban 등)와 동일한 이중 게이트.
- 요청 본문 (`RestoreContentDto`, zod 검증):

  | 필드 | 타입 | 필수 | 설명 |
  |------|------|------|------|
  | `targetType` | `"post" \| "comment"` | ✓ | 복구 대상 유형 |
  | `targetId` | uuid | ✓ | 대상 게시글/댓글 ID |
  | `reason` | string(≤1000) | – | 복구 사유 (감사 로그에 기록) |

- 성공 응답 (`RestoreContentResponseDto`):

  ```json
  { "targetType": "post", "targetId": "…", "status": "published", "restored": true }
  ```

  게시글은 `status: "published"`, 댓글은 `status: "visible"` 를 돌려준다.

## 복구 시맨틱

### 게시글 (원문은 항상 보존됨)

- 모더레이션 제거(`remove()`)는 `status → removed` 만 바꾸고 **본문을 파괴하지 않는다.**
  따라서 숨김/제거된 게시글은 언제나 안전하게 복구된다.
- `status ∈ { hidden, removed }` → `published`, `removalReason`/`removedBy` 초기화.
- 작성자 삭제(`deleted`)·임시저장(`draft`)·이미 공개(`published`)는 복구 대상이 아니다 → **409**.
  (판정: `post-deletion-policy.canRestore`)

### 댓글 (원문 보존 여부가 관건)

댓글은 제거/삭제 시 원본 본문을 sentinel 로 **덮어쓴다** — 이것이 게시글과의 핵심 차이다.

| 상태 | 본문 | 복구 |
|------|------|------|
| `isHidden=true` (금칙어 필터) | 원문 보존 | ✅ 복구 (`is_hidden=false`) |
| `isRemoved=true` + 원문 보존 | 살아있음 | ✅ 복구 (`is_removed=false`) |
| `isRemoved=true` + 원문 파괴(`[removed]`/null/공백) | 없음 | ❌ **409** `content_destroyed` |
| `isDeleted=true` (작성자 삭제, `[삭제됨]`) | 없음(작성자 의사) | ❌ **409** `author_deleted` |
| 숨김·제거 아님 | – | ❌ **409** `not_moderated` |

- 판정은 DB-free 순수 함수 `content-restore-policy.decideCommentRestore` 로 분리해
  서비스가 재사용한다. `isCommentContentDestroyed` 는 sentinel(`[removed]`,`[삭제됨]`)과
  null/공백을 **fail-closed** 로 파괴 처리한다.
- 복구 성공 시 `is_removed=false`, `is_hidden=false`, `removalReason`/`removedBy` 초기화.
- 거부(409)는 **side-effect free** — 상태 변경도, 감사 로그도 남기지 않는다.

## 감사 로그

모든 복구 성공은 `community_mod_logs` 에 append 된다 (append-only 운영 감사).

- `action = "other"` (전용 restore enum 은 없음 — 기존 `post_restored` 감사 관례와 일치,
  **마이그레이션 없음**).
- `targetType = "post" | "comment"`, `targetId`, `reason` (미지정 시 `admin_content_restored`).
- `details.kind = "post_restored" | "comment_restored"` — 게시글은 `fromStatus`,
  댓글은 `wasRemoved`/`wasHidden` 스냅샷을 함께 기록.

## 에러 계약

| 상황 | 코드 |
|------|------|
| 대상 게시글/댓글 없음 | 404 |
| 커뮤니티 권한 없음 | 403 |
| 복구 대상 아님 / 원문 파괴 / 작성자 삭제 | 409 |
| 잘못된 body (targetType/targetId) | 400 (zod) |

사용자-대면 메시지는 `content-restore-policy.COMMENT_RESTORE_REJECTION_MESSAGE` 를 통해
비기술적 한국어로 매핑되며 raw 에러를 노출하지 않는다.

## 검증

- `content-restore-policy.spec.ts` (DB-free, 10 케이스): 파괴 판정·복구 결정 전 분기.
- `community-restore.service.spec.ts` (DB-gated, 8 케이스): 게시글/댓글 복구 성공 +
  감사 로그 기록, 원문 파괴 제거 댓글 409(무부작용), 작성자 삭제·미모더·404 거부.

## 미해결 — 생성 api-client 재생성 (별도 블로커)

`pnpm api:codegen`(server OpenAPI dump → openapi-typescript) 파이프라인은 이 변경과
무관한 **기존** 결함으로 막혀 있다: `service-domain`/`doctor-curation` DTO 의 순환
의존성(`endYear`) 및 중복 `ChangeStatusDto` 로 Swagger 문서 생성이 크래시한다. 이 결함은
커뮤니티 라인 이전부터 존재해 `packages/api-client/src/generated/paths.ts` 는 vendor seed
이후 최근 커뮤니티 엔드포인트(reports/resolve·hidden-content·filter·ban·blocks 등)를
전부 누락한 상태다. 따라서 본 이슈에서 생성 클라이언트 재생성은 도메인 밖 수정 없이는
불가능하며, 언블록은 별도 이슈로 분리한다(서비스는 server-authoritative 계약의 원천이며,
FE 는 기존과 동일하게 도메인 zod fetch 레이어로 연동한다).
