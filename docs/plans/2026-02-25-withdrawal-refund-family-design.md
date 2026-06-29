# Design: 회원탈퇴 + 유저 환불 + 가족관리

> 2026-02-25 | FRD 기반 서버 구현 설계

## 구현 대상

| # | Feature | 유형 | 범위 |
|---|---------|------|------|
| 1 | 회원탈퇴 | 프로필 확장 | DB 2변경 + Service 3메서드 + tRPC 3프로시저 + REST 3엔드포인트 |
| 2 | 유저 환불 요청 | 결제 시스템 확장 | DB 1테이블 + Service 5메서드 + tRPC 5프로시저 + REST 5엔드포인트 |
| 3 | 가족관리 | 신규 Feature | DB 5테이블 + Service 22메서드 + tRPC 22프로시저 + REST ~15엔드포인트 |

## 구현 순서

서버(백엔드)만 먼저 구현. 프론트엔드는 화면정의서 완료 후 별도 진행.

```
Phase 1: 회원탈퇴 (기존 Profile 확장)
Phase 2: 유저 환불 요청 (기존 Payment 확장)
Phase 3: 가족관리 (신규 Feature 생성)
```

---

## Phase 1: 회원탈퇴

### 현재 상태
- Profile feature: `packages/features/profile/` 존재
- `profiles` 테이블: `isActive` boolean만 있음, `deleted_at` 없음
- `deactivate/reactivate` Admin 메서드 존재
- 사용자 셀프서비스 탈퇴 없음

### 변경 사항

**Schema:**
- `profiles` 테이블에 `deletedAt` 컬럼 추가
- `profile_withdrawal_reasons` 테이블 신규
- `profile_withdrawal_reason_type` pgEnum 신규

**Service (profile.service.ts 확장):**
- `checkWithdrawable(userId)` — Owner/구독 확인
- `withdraw(userId, input)` — 비밀번호 검증 + soft delete + 사유 저장
- `adminWithdrawalReasons(input)` — 탈퇴 사유 조회

**tRPC (profile.router.ts 확장):**
- `profile.checkWithdrawable` (protectedProcedure)
- `profile.withdraw` (protectedProcedure)
- `profile.admin.withdrawalReasons` (adminProcedure)

**REST (profile.controller.ts 확장):**
- `GET /api/profile/withdrawable` — 탈퇴 가능 여부
- `POST /api/profile/withdraw` — 탈퇴 요청
- `GET /api/admin/profile/withdrawal-reasons` — 탈퇴 사유 목록

---

## Phase 2: 유저 환불 요청

### 현재 상태
- Payment feature: `packages/features/payment/` 존재
- `payment_orders` 테이블에 `refunded`, `refundedAt`, `refundAmount` 컬럼 존재
- `refundOrder()`, `refundSubscription()` Admin 메서드 존재
- `payment_refund_requests` 테이블 없음

### 변경 사항

**Schema:**
- `payment_refund_requests` 테이블 신규
- `payment_refund_request_status` pgEnum 신규
- `payment_refund_reason_type` pgEnum 신규

**Service (payment.service.ts 확장):**
- `getMyOrders(userId, input)` — 본인 결제 내역
- `checkRefundable(userId, orderId)` — 환불 가능 여부
- `requestRefund(userId, input)` — 환불 요청 생성
- `getMyRefundRequests(userId, input)` — 본인 환불 요청 목록
- `adminProcessRefundRequest(adminId, input)` — Admin 환불 처리

**tRPC (payment.router.ts 확장):**
- `payment.getMyOrders` (protectedProcedure)
- `payment.checkRefundable` (protectedProcedure)
- `payment.requestRefund` (protectedProcedure)
- `payment.getMyRefundRequests` (protectedProcedure)
- `payment.admin.processRefundRequest` (adminProcedure)

**REST (payment.controller.ts 확장):**
- `GET /api/payment/orders` — 본인 결제 내역
- `GET /api/payment/orders/:id/refundable` — 환불 가능 여부
- `POST /api/payment/refund-requests` — 환불 요청
- `GET /api/payment/refund-requests` — 본인 환불 요청 목록
- `POST /api/admin/payment/refund-requests/:id/process` — Admin 환불 처리

---

## Phase 3: 가족관리

### 현재 상태
- 코드 없음, 완전 신규 Feature

### 변경 사항

**Schema (packages/drizzle/src/schema/features/family/index.ts):**
- `family_member_role` pgEnum
- `family_invitation_status` pgEnum
- `family_groups` 테이블
- `family_members` 테이블 (unique: group_id + user_id)
- `family_invitations` 테이블
- `family_children` 테이블
- `family_child_assignments` 테이블 (unique: child_id + therapist_id)

**서비스 분할:**
단일 FamilyService로 시작 (복잡도 증가 시 분할)

**Module (packages/features/family/):**
- `family.module.ts` — NestJS Module
- `family.router.ts` — tRPC Router (22 프로시저)
- `service/family.service.ts` — Business logic
- `controller/family.controller.ts` — REST API
- `dto/` — Zod DTOs

**4곳 등록:**
- Schema index
- App module
- app-router.ts (타입)
- router.ts (런타임)

---

## 주요 설계 결정

1. **서비스 분할**: 가족관리는 단일 FamilyService로 시작. 코드량이 커지면 GroupService / MemberService / ChildService로 분할
2. **Soft delete 패턴**: `baseColumnsWithSoftDelete()` 유틸 활용 (data-tracker 패턴 참조)
3. **권한 검사**: 가족관리는 그룹 멤버십 + 역할 기반 권한이므로 Service 내부에서 검사
4. **서버만 구현**: 프론트엔드는 화면정의서(.pen) 완료 후 별도 Phase로 진행
5. **알림 연동**: Notification feature 연동은 TODO로 남기고, 핵심 로직 먼저 구현
