/**
 * Bootstrap Super Admin (admin.super-account-bootstrap)
 *
 * 최초 운영 진입/검증을 위한 슈퍼 관리자 계정을 idempotent 하게 생성한다.
 *
 * 무엇을 하는가:
 *   1. Better Auth signUpEmail 로 슈퍼 계정(users + profiles)을 생성한다. 이미 있으면 skip.
 *   2. 기본 조직(organizations)을 생성하고 슈퍼 계정을 owner 멤버(members)로 등록한다. 이미 있으면 skip.
 *      → admin 앱은 organization 멤버십 role(owner/admin)로 접근을 게이트한다
 *        (packages/core/auth/guards/admin-guard.tsx).
 *   3. 검증: signInEmail 로 실제 로그인 가능 여부 + owner 멤버십을 확인한다.
 *      검증 실패 시 비-0 종료코드로 끝낸다 (AC: 실패 시 완료로 보지 않는다).
 *
 * 기본 자격 증명(Acceptance Criteria 고정값, 환경변수로 override 가능):
 *   email    = first@super.local   (PRODUCT_BUILDER_SEED_EMAIL)
 *   password = q1w2e3r4t5!$        (PRODUCT_BUILDER_SEED_PASSWORD)
 *   name     = Super Admin         (PRODUCT_BUILDER_SEED_NAME)
 *   org      = AIGA / aiga         (PRODUCT_BUILDER_SEED_ORG_NAME / _ORG_SLUG)
 *
 * ⚠️ 기본 비밀번호는 알려진 값이다. production 인수 전 반드시 교체/비활성/권한이전 하라.
 *    절차: doc/admin-super-account-bootstrap.md
 *
 * Usage:
 *   pnpm -F server db:bootstrap:super-admin
 *   # 또는 자격 증명 override:
 *   PRODUCT_BUILDER_SEED_EMAIL=ops@acme.com PRODUCT_BUILDER_SEED_PASSWORD=... \
 *     pnpm -F server exec tsx src/scripts/bootstrap-super-admin.ts
 */

import * as path from "node:path";
import * as dotenv from "dotenv";
import postgres from "postgres";
import {
  deterministicMemberId,
  isUserAlreadyExistsError,
  resolveSuperAdminConfig,
} from "./super-admin-config";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });

const config = resolveSuperAdminConfig(process.env);
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("[bootstrap-super-admin] DATABASE_URL required");
  process.exit(1);
}
const REQUIRED_DATABASE_URL: string = DATABASE_URL;

const ORG_ID = `org_${config.orgSlug}`;

interface BootstrapResult {
  userId: string;
  organizationId: string;
  role: string;
}

async function ensureUser(): Promise<void> {
  const { auth } = await import("@repo/core/auth/server");
  console.log(`[bootstrap-super-admin] step 1: ensure user ${config.email}`);
  try {
    const result = await auth.api.signUpEmail({
      body: { email: config.email, password: config.password, name: config.name },
    });
    console.log("[bootstrap-super-admin]   ✅ user created:", {
      id: result.user?.id,
      email: result.user?.email,
    });
  } catch (err: unknown) {
    const msg = (err as { message?: string } | null)?.message ?? String(err);
    if (isUserAlreadyExistsError(msg)) {
      console.log("[bootstrap-super-admin]   ↩︎ user already exists, skipping create");
    } else {
      // signUpEmail 이 후처리(이메일 발송 등)에서 던졌어도 user 는 생성됐을 수 있다.
      // DB 에 실제로 존재하는지 확인하고, 없으면 그때 실패로 처리한다.
      throw err;
    }
  }
}

async function ensureOrgAndMembership(sql: postgres.Sql): Promise<BootstrapResult> {
  // user id 조회 (Better Auth users 테이블)
  const userRows = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${config.email} LIMIT 1
  `;
  const userId = userRows[0]?.id;
  if (!userId) {
    throw new Error(`user not found after signUp: ${config.email}`);
  }

  // 조직 upsert (slug unique) — 멱등
  console.log(`[bootstrap-super-admin] step 2: ensure org ${config.orgSlug} + owner membership`);
  await sql`
    INSERT INTO organizations (id, name, slug)
    VALUES (${ORG_ID}, ${config.orgName}, ${config.orgSlug})
    ON CONFLICT (slug) DO NOTHING
  `;
  const orgRows = await sql<{ id: string }[]>`
    SELECT id FROM organizations WHERE slug = ${config.orgSlug} LIMIT 1
  `;
  const organizationId = orgRows[0]?.id;
  if (!organizationId) {
    throw new Error(`organization not found after upsert: ${config.orgSlug}`);
  }

  // owner 멤버십 upsert — 결정적 PK 로 멱등
  const memberId = deterministicMemberId(userId, organizationId);
  await sql`
    INSERT INTO members (id, organization_id, user_id, role)
    VALUES (${memberId}, ${organizationId}, ${userId}, ${config.role})
    ON CONFLICT (id) DO NOTHING
  `;
  console.log("[bootstrap-super-admin]   ✅ org + owner membership ensured:", {
    organizationId,
    userId,
    role: config.role,
  });

  return { userId, organizationId, role: config.role };
}

async function verify(sql: postgres.Sql, expected: BootstrapResult): Promise<void> {
  console.log("[bootstrap-super-admin] step 3: verify admin login + owner role");
  const { auth } = await import("@repo/core/auth/server");

  // 1) 실제 로그인 가능 여부 (비밀번호 해시 검증 포함)
  const signIn = await auth.api.signInEmail({
    body: { email: config.email, password: config.password },
  });
  if (!signIn.user?.id) {
    throw new Error("verify: signInEmail returned no user");
  }
  console.log("[bootstrap-super-admin]   ✅ signIn ok:", { id: signIn.user.id });

  // 2) owner 멤버십 확인 (admin-guard 가 allow 하는 role)
  const memberRows = await sql<{ role: string }[]>`
    SELECT role FROM members
    WHERE user_id = ${expected.userId} AND organization_id = ${expected.organizationId}
    LIMIT 1
  `;
  const role = memberRows[0]?.role;
  if (role !== expected.role) {
    throw new Error(`verify: expected owner membership, got role=${role ?? "<none>"}`);
  }
  console.log("[bootstrap-super-admin]   ✅ owner membership confirmed:", { role });
}

async function run(): Promise<void> {
  await ensureUser();

  const sql = postgres(REQUIRED_DATABASE_URL, { max: 1 });
  try {
    const result = await ensureOrgAndMembership(sql);
    await verify(sql, result);
    console.log("[bootstrap-super-admin] ✅ DONE — super admin ready:", {
      email: config.email,
      organizationId: result.organizationId,
      role: result.role,
    });
    console.log(
      "[bootstrap-super-admin] ⚠️ 기본 비밀번호는 알려진 값입니다. production 인수 전 교체/비활성/권한이전 하세요 (doc/admin-super-account-bootstrap.md).",
    );
  } finally {
    await sql.end();
  }
}

run().catch((err) => {
  console.error("[bootstrap-super-admin] ❌ FAILED:", err);
  process.exit(1);
});
