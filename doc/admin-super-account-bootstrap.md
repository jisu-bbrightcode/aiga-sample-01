# 최초 슈퍼 계정 Bootstrap (admin.super-account-bootstrap)

최초 운영 진입/검증을 위한 슈퍼 관리자 계정을 idempotent 하게 생성하는 절차와,
**production 인수 전 반드시 수행해야 하는 기본 비밀번호 교체/비활성/권한이전 절차**를 정리한다.

관련 이슈: BBR-675 `[PB-ADMIN-SUPER-ACCOUNT-001]`

## 무엇이 만들어지는가

`pnpm db:bootstrap:super-admin` 은 다음을 멱등하게 보장한다.

1. **슈퍼 계정** (`users` + `profiles`) — Better Auth `signUpEmail` 로 생성. 이미 있으면 skip.
2. **기본 조직** (`organizations`, slug `aiga`) + 슈퍼 계정의 **owner 멤버십** (`members`).
   - 관리자 앱(apps/admin)은 Better Auth organization 멤버십의 `role`(`owner`/`admin`)로
     접근을 게이트한다 (`packages/core/auth/guards/admin-guard.tsx`,
     `packages/core/auth/hooks/use-profile-sync.ts`). 따라서 owner 멤버십이 admin 접근 권한이다.
3. **검증** — `signInEmail` 로 실제 로그인 가능 여부 + owner 멤버십을 확인하고,
   실패 시 비-0 종료코드로 끝낸다.

## 기본 자격 증명 (Acceptance Criteria 고정값)

| 항목 | 기본값 | override 환경변수 |
|------|--------|-------------------|
| email | `first@super.local` | `PRODUCT_BUILDER_SEED_EMAIL` |
| password | `q1w2e3r4t5!$` | `PRODUCT_BUILDER_SEED_PASSWORD` |
| name | `Super Admin` | `PRODUCT_BUILDER_SEED_NAME` |
| org name | `AIGA` | `PRODUCT_BUILDER_SEED_ORG_NAME` |
| org slug | `aiga` | `PRODUCT_BUILDER_SEED_ORG_SLUG` |

> ⚠️ **이 기본 비밀번호는 공개된 알려진 값이다.** production 환경에서는 아래 "운영 전환 절차"를
> 반드시 수행하라.

## 실행

```bash
# 1) DB 스키마 준비 (fresh DB 인 경우)
DATABASE_URL=postgres://... pnpm db:migrate

# 2) 슈퍼 계정 bootstrap (기본값 사용)
DATABASE_URL=postgres://... BETTER_AUTH_SECRET=... pnpm db:bootstrap:super-admin

# override 예시 (고객 소유 계정으로 바로 생성)
PRODUCT_BUILDER_SEED_EMAIL=ops@customer.com \
PRODUCT_BUILDER_SEED_PASSWORD='<strong-random>' \
  pnpm --filter server db:bootstrap:super-admin
```

멱등성: 같은 인자로 여러 번 실행해도 user/org/owner-member 는 각각 1건만 유지된다.

## 운영 전환(인수) 전 필수 절차 — 셋 중 하나 이상

기본 슈퍼 계정은 알려진 비밀번호를 갖고 있으므로, production 인수 전 아래 중 하나 이상을
수행하고 그 사실을 인수 체크리스트/이슈에 기록한다.

### A. 비밀번호 교체 (권장: 운영 직후 즉시)

관리자 앱 로그인 → 비밀번호 변경, 또는 Better Auth password reset 메일 플로우 사용:

```bash
# reset 메일 발송 트리거 (Resend 설정 필요)
curl -X POST "$API_URL/api/auth/forget-password" \
  -H 'Content-Type: application/json' \
  -d '{"email":"first@super.local"}'
```

또는 신규 강력 비밀번호로 계정을 재-bootstrap:

```bash
PRODUCT_BUILDER_SEED_PASSWORD='<strong-random>' pnpm db:bootstrap:super-admin
```
> 주의: 위 재실행은 계정이 이미 있으면 create 를 skip 하므로 **비밀번호를 덮어쓰지 않는다.**
> 비밀번호 교체는 반드시 password-reset / 계정 설정 플로우로 수행하라.

### B. 계정 비활성

`profiles.is_active = false` 로 내려 로그인/접근을 차단한다.

```sql
UPDATE profiles SET is_active = false, updated_at = now()
WHERE email = 'first@super.local';
```

### C. 고객 소유 관리자 계정으로 권한 이전

고객 이메일로 owner 멤버십을 부여한 뒤, 기본 계정의 멤버십을 회수한다.

```bash
# 1) 고객 계정 + owner 멤버십 생성
PRODUCT_BUILDER_SEED_EMAIL=ops@customer.com \
PRODUCT_BUILDER_SEED_PASSWORD='<strong-random>' \
PRODUCT_BUILDER_SEED_ORG_SLUG=aiga \
  pnpm db:bootstrap:super-admin
```
```sql
-- 2) 기본 슈퍼 계정의 owner 멤버십 회수 (org 는 유지)
DELETE FROM members
WHERE organization_id = 'org_aiga'
  AND user_id = (SELECT id FROM users WHERE email = 'first@super.local');
```

## 인수 체크리스트 (이슈에 기록)

- [ ] A/B/C 중 수행한 항목과 일시
- [ ] 변경 후 `first@super.local` 로 관리자 앱 접근이 차단/교체되었는지 재확인
- [ ] 고객 owner 계정으로 관리자 앱 접근 성공 확인 (권한 이전 시)
