# DB Safety — 운영 DB 파괴적 변경 금지

> **Product Builder 운영 DB에는 절대 파괴적 DB 작업을 실행하지 않는다.**
> `drizzle-kit push`, `db:reset`, raw `DROP/TRUNCATE/ALTER` 등은 **개발 환경에서만** 허용된다.

---

## Iron Rule

```
drizzle-kit push / db:push / db:reset / db:drop / drizzle-kit drop
raw SQL: DROP TABLE / TRUNCATE / DELETE FROM (WHERE 없이) / ALTER TABLE

  → 운영 DB에서 실행 금지. 예외 없음.
  → 개발 DB에서도 명시적 허용 플래그 필요.
```

운영 DB = Product Builder가 사용하는 Neon 프로덕션 브랜치.
개발 DB = 별도 Neon dev 브랜치 또는 로컬 Postgres.

---

## 파괴적 vs 안전 작업 분류

| 작업 | 분류 | 운영 허용 | 개발 허용 |
|------|:----:|:---------:|:---------:|
| `drizzle-kit generate` (마이그레이션 파일 생성) | 안전 | O | O |
| `drizzle-kit check` (스키마 검증) | 안전 | O | O |
| `drizzle-kit migrate` (추적된 마이그레이션 적용) | 반(半)안전 | 승인 후 | O |
| `drizzle-kit push` (스키마 직접 push) | **파괴적** | ❌ | 플래그 필요 |
| `drizzle-kit push --force` | **파괴적** | ❌ | 플래그 필요 |
| `drizzle-kit drop` | **파괴적** | ❌ | 플래그 필요 |
| `pnpm db:reset` (DB 전체 초기화 + seed) | **파괴적** | ❌ | 플래그 필요 |
| raw `DROP TABLE` / `TRUNCATE` | **파괴적** | ❌ | 플래그 필요 |
| raw `DELETE FROM` WHERE 없이 | **파괴적** | ❌ | 플래그 필요 |
| raw `ALTER TABLE ... DROP COLUMN` | **파괴적** | ❌ | 플래그 필요 |
| raw `INSERT` / `UPDATE`(WHERE 있음) / `SELECT` | 안전 | 승인 후 | O |

---

## 운영 워크플로우 — 안전한 스키마 변경

```
1. 스키마 수정 (packages/drizzle/src/schema/)
2. pnpm -F @repo/drizzle db:generate  ← 마이그레이션 파일 생성
3. migrations/{new}.sql 사람이 직접 리뷰
   - DROP / ALTER COLUMN / TRUNCATE 있으면 위험 — 별도 계획
   - ADD COLUMN / CREATE TABLE / CREATE INDEX 는 일반적으로 안전
4. PR 올리고 코드 리뷰
5. 승인 후 pnpm -F @repo/drizzle db:migrate  (추적됨)
6. drizzle_migrations 테이블로 idempotent 보장
```

**`db:push`는 이 워크플로우를 건너뛴다. 운영 DB drift 원인이 된다.**

---

## 허용 플래그

개발 환경에서 파괴적 작업을 실행할 때:

```bash
# 방법 1: 환경 변수로 명시적 허용
PRODUCT_BUILDER_DB_ALLOW_DESTRUCTIVE=1 pnpm -F @repo/drizzle db:push

# 방법 2: 개발 전용 DB URL 사용
DATABASE_URL=postgresql://.../product_builder_dev pnpm -F @repo/drizzle db:push
```

hook이 아래를 확인한다:
1. `PRODUCT_BUILDER_DB_ALLOW_DESTRUCTIVE=1` 이 설정되었는가?
2. `DATABASE_URL` 이 운영 호스트와 일치하는가? → 일치하면 **플래그가 있어도 차단**
3. 일치하지 않으면 플래그 있을 때만 통과

---

## 운영 DB 호스트 식별

현재 운영 DB 호스트는 `.env.local` 의 `DATABASE_URL` 호스트 부분이다.

```
postgresql://{user}:{pw}@{PROD_HOST}/{db}
                         ^^^^^^^^^^
                         이 부분이 일치하면 운영 DB
```

`PROD_DB_HOSTS` 환경 변수 또는 `.claude/state/prod-db-hosts.txt` 에 호스트를 기록한다.
hook은 이 목록과 현재 `DATABASE_URL` 을 대조한다.

---

## 금지

| 금지 | 이유 |
|------|------|
| 운영 DB에 `drizzle-kit push` | drift 발생 + 트래킹 없음 |
| 운영 DB에 `db:reset` | 모든 데이터 소실 |
| `--force` 플래그로 우회 | drop → recreate = 데이터 소실 |
| hook 우회 (`--no-verify` 류) | 안전 메커니즘 무력화 |
| raw SQL로 `DROP TABLE` | 백업 없이 복구 불가 |
| "잠깐만 dev 모드니까" 라는 생각 | 실수가 운영에 도달하는 경로 |

---

## 관련 hook

- `.claude/hooks/check-db-destructive.sh` — Bash 커맨드를 검사하여 파괴적 DB 작업 차단
- 등록: `.claude/settings.json` PreToolUse → Bash matcher
