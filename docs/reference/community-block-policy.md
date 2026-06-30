# 커뮤니티 작성자 차단 정책 (PB-COMM-BLOCK-API-CREATE-001 / BBR-615)

사용자가 다른 작성자를 차단하면 그 작성자의 콘텐츠·상호작용·알림이 사용자
화면에서 제외된다. 이 문서는 차단 예외 정책, 노출 제외 정책, 알림 차단 정책의
계약을 한 곳에 고정한다.

## 데이터 모델 (기존, EXTEND)

`community_user_blocks` (양방향 mute 의미):

- `blockerId` — 차단을 건 사용자
- `blockedId` — 차단당한 사용자
- `(blockerId, blockedId)` unique → 중복 차단 차단

## REST 엔드포인트

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/community/blocks` | 필요 | 작성자 차단 생성 (body `{ blockedId }`) |
| GET | `/community/blocks` | 필요 | 내가 차단한 작성자 목록 |
| DELETE | `/community/blocks/:blockedId` | 필요 | 차단 해제 |

- 차단 주체(`blockerId`)는 항상 인증 컨텍스트(`CurrentUser`)에서 가져온다.
  본문/경로로 받지 않는다 → 타인 명의 차단 불가.
- 응답은 `BlockResponseDto`(`id`, `blockerId`, `blockedId`, `createdAt`)로
  제한된다. 내부 timestamp 등은 노출하지 않는다.

## 예외 정책 (AC#2)

순수 함수 `evaluateBlockTarget()` (`service/block-policy.ts`)가 단일 진실원천:

1. **자기 자신 차단 불가** — `blockerId === blockedId` → `403 self_block`.
2. **시스템 계정 차단 불가** — `blockedId ∈ systemAccountIds` → `403 system_account`.
   - 시스템 계정 ID 집합은 환경설정 `COMMUNITY_SYSTEM_ACCOUNT_IDS`(쉼표 구분)에서
     주입한다. 공지/모더레이션 봇을 차단하면 안전 공지가 사라질 수 있어 제외한다.
   - 설정이 비어 있으면 시스템 계정 제약은 적용되지 않는다(자기 자신 차단만 강제).
3. 중복 차단 → `409 conflict` (DB unique).

self-block 검사가 system-account 검사보다 우선한다.

## 노출 제외 정책 (AC#1)

차단 ID 집합의 단일 소스는 `CommunityBlockService.getBlockedUserIds(userId)`이며
**양방향**(내가 차단한 + 나를 차단한)으로 계산된다. 다음 읽기 경로가 이 집합을
`notInArray(authorId, blockedUserIds)` 로 적용한다:

- 게시글 목록 — `CommunityPostService` (`blockedUserIds`)
- 홈/인기 피드 — `CommunityFeedService`
- 댓글 목록 — `CommunityCommentService`

비로그인 요청에는 차단 집합이 없으므로 필터가 적용되지 않는다(차단은 로그인
사용자의 개인 설정).

## 노출 복구 정책 (BBR-616, AC#1)

차단 해제(`DELETE /community/blocks/:blockedId` → `CommunityBlockService.unblock`)는
`community_user_blocks` 행을 물리 삭제한다. 노출 제외의 단일 소스인
`getBlockedUserIds()`는 **요청마다 라이브 테이블에서 재계산**되므로, 해제 직후의
다음 읽기에서 해당 작성자가 차단 집합에서 빠지고 피드/상세/댓글 노출이 자동으로
복구된다. 별도의 캐시 무효화나 재인덱싱이 필요 없으며, 노출 제외와 동일한 소스를
공유하므로 차단/해제가 완전히 대칭이다.

- 양방향(mutual mute) 의미상 한쪽이 해제하면 양쪽 모두에서 상대가 차단 집합을
  떠난다.
- 존재하지 않는 차단을 해제하면 `404 NotFound`(멱등 대신 명시적 부재 신호).
- 차단 주체는 항상 `CurrentUser`에서 가져오므로 **타인의 차단 목록은 해제할 수
  없다**(AC#2). 경로의 `:blockedId`는 해제 대상일 뿐 주체가 아니다.

## 알림 차단 정책

알림 발송 게이트는 `CommunityBlockService.shouldNotify(recipientId, actorId)`:

- recipient/actor 사이에 (양방향) 차단이 있으면 `false` → 발송하지 않는다.
- 자기 자신 대상 알림은 항상 `true`.

커뮤니티 알림 fan-out 이 추가될 때 이 게이트를 **단일 진입점**으로 사용한다.
노출 제외와 동일한 차단 소스를 공유하므로 정책이 한 곳에서 일관되게 유지된다.

## 테스트

- `service/block-policy.spec.ts` — 예외 정책 순수 단위 테스트(DB 불필요).
- `service/community-block.service.spec.ts` — block/unblock/목록/`shouldNotify`
  + 해제 후 노출 복구(BBR-616 AC#1) DB 통합 테스트(`describeIfDb`).
