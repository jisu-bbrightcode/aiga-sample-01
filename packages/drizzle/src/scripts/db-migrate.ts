/**
 * DB Migrate Script — drizzle-orm SDK 기반
 *
 * drizzle-kit push 대신 drizzle-orm 의 migrator 를 사용하여
 * migrations/ 폴더의 SQL 파일을 순차 적용한다.
 *
 * 안전성:
 * - __drizzle_migrations 테이블에 적용 이력 기록 → idempotent
 * - 0000 baseline 은 CREATE TABLE IF NOT EXISTS + DO 블록으로 이미 존재하는 객체 skip
 * - 파괴적 작업 없음 (DROP / TRUNCATE 없음)
 *
 * 규칙: .claude/rules/backend/db-safety.md
 */

import * as path from "node:path";
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
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
  const db = drizzle(client);

  const migrationsFolder = path.resolve(__dirname, "../../migrations");
  console.log(`[db-migrate] migrations folder: ${migrationsFolder}`);

  try {
    await migrate(db, { migrationsFolder });
    console.log("[db-migrate] ✅ migrations applied");
  } catch (err) {
    console.error("[db-migrate] ❌ failed:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
