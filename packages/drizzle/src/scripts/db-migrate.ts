/**
 * DB Migrate Script — drizzle-orm SDK 기반 (per-migration transaction)
 *
 * drizzle-kit push 대신 migrations/ 폴더의 SQL 파일을 순차 적용한다.
 *
 * 왜 drizzle 기본 migrate() 를 쓰지 않는가:
 * - drizzle-orm/postgres-js 의 migrate() 는 **전체 마이그레이션 체인을 단일 트랜잭션**으로
 *   감싼다. 이 저장소 히스토리는 enum 값을 추가(`ALTER TYPE ... ADD VALUE`, 0013)한 뒤
 *   이후 마이그레이션(0041)에서 그 값을 사용한다. PostgreSQL 은 같은 트랜잭션 안에서
 *   새 enum 값을 사용하는 것을 금지하므로(`unsafe use of new value ...`) migrate-from-scratch
 *   가 항상 실패한다. 실제 배포에서는 마이그레이션이 배포마다 1개씩 커밋되며 적용됐기 때문에
 *   드러나지 않았고, 신규 Neon 브랜치(scratch) 에서만 터진다.
 * - 해결: 각 마이그레이션을 **자신만의 트랜잭션**으로 커밋한다(실제 증분 배포와 동일한 모델).
 *   enum ADD VALUE 가 사용 전에 커밋되므로 add-then-use 클래스가 통째로 해소된다.
 *
 * 안전성:
 * - drizzle 와 동일한 `drizzle.__drizzle_migrations` (hash, created_at=folderMillis) 장부를
 *   사용 → 기존/표준 drizzle migrator 와 호환되고 재실행 시 idempotent.
 * - 파괴적 작업 없음 (이 스크립트 자체는 DROP / TRUNCATE 를 수행하지 않음).
 *
 * 규칙: .claude/rules/backend/db-safety.md
 */

import * as path from "node:path";
import * as dotenv from "dotenv";
import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });

const DATABASE_URL_RAW = process.env.DATABASE_URL;

if (!DATABASE_URL_RAW) {
  console.error("[db-migrate] DATABASE_URL is not set");
  process.exit(1);
}
const DATABASE_URL: string = DATABASE_URL_RAW;

function maskHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? "***" : ""}@${u.host}${u.pathname}`;
  } catch {
    return "<invalid>";
  }
}

async function run() {
  console.log(`[db-migrate] target: ${maskHost(DATABASE_URL)}`);

  const client = postgres(DATABASE_URL, { max: 1 });

  const migrationsFolder = path.resolve(__dirname, "../../migrations");
  console.log(`[db-migrate] migrations folder: ${migrationsFolder}`);

  try {
    const migrations = readMigrationFiles({ migrationsFolder });

    // drizzle 와 동일한 장부 스키마/테이블
    await client.unsafe('CREATE SCHEMA IF NOT EXISTS "drizzle"');
    await client.unsafe(
      'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)',
    );

    const lastRows = await client.unsafe(
      'select created_at from "drizzle"."__drizzle_migrations" order by created_at desc limit 1',
    );
    const lastRow = lastRows[0];
    const lastApplied =
      lastRow?.created_at != null ? Number(lastRow.created_at) : 0;

    let appliedCount = 0;
    let skippedCount = 0;

    for (const migration of migrations) {
      // 이미 적용된(=장부의 마지막 created_at 이하) 마이그레이션은 건너뛴다.
      if (migration.folderMillis <= lastApplied) {
        skippedCount += 1;
        continue;
      }

      // ⬇️ 핵심: 마이그레이션 1개 = 트랜잭션 1개 (실제 증분 배포와 동일)
      await client.begin(async (tx) => {
        for (const stmt of migration.sql) {
          await tx.unsafe(stmt);
        }
        await tx.unsafe(
          'insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values ($1, $2)',
          [migration.hash, migration.folderMillis],
        );
      });

      appliedCount += 1;
    }

    console.log(
      `[db-migrate] ✅ migrations applied (applied=${appliedCount}, skipped=${skippedCount}, total=${migrations.length})`,
    );
  } catch (err) {
    console.error("[db-migrate] ❌ failed:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
