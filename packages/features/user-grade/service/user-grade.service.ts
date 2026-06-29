import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { userGradeDefinitions, userGrades } from "@repo/drizzle/schema";
import { desc, eq, type SQL, sql } from "drizzle-orm";
import type { AssignUserGradeDto, ListUserGradesQueryDto } from "../dto";
import { type AdminUserGradeView, toAdminUserGrade, type UserGradeWithDefinition } from "../mappers";

/** Postgres unique-violation SQLSTATE — one grade per user → friendly 409. */
const PG_UNIQUE_VIOLATION = "23505";
/** Postgres FK-violation SQLSTATE — unknown user id → friendly 404. */
const PG_FK_VIOLATION = "23503";

/** Default grade granted at user creation (소셜 로그인 가입). */
const DEFAULT_SIGNUP_GRADE_SLUG = "basic";

/**
 * FR-001 사용자 — user-grade assignment service (PB-FEAT-FR001-API-CREATE).
 *
 * Owns the NEW grade-determination write/read paths over the FR-001 DATA model
 * (`user_grades` + `user_grade_definitions`). Identity itself (social login,
 * accounts, sessions) is REUSED from core better-auth and is not created here —
 * see doc/api/PB-FEAT-FR001-API-CREATE-user-create.md for the reuse map.
 */
@Injectable()
export class UserGradeService {
  private readonly logger = new Logger(UserGradeService.name);

  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * Assign (create) a user's grade. Admin-only. Validates the target grade
   * exists and is active, stamps provenance (source/determinedBy/note), and
   * enforces the one-grade-per-user invariant (409 if already assigned).
   */
  async assignGrade(
    adminId: string,
    userId: string,
    dto: AssignUserGradeDto,
  ): Promise<AdminUserGradeView> {
    const grade = await this.resolveGrade(dto.gradeId, dto.gradeSlug);
    try {
      const rows = await this.db
        .insert(userGrades)
        .values({
          userId,
          gradeId: grade.id,
          source: dto.source ?? "manual",
          determinedBy: adminId,
          note: dto.note ?? null,
          expiresAt: dto.expiresAt ?? null,
          determinedAt: new Date(),
        })
        .returning();
      const created = rows[0];
      if (!created) {
        throw new Error("등급 부여 결과가 비어 있습니다.");
      }
      return toAdminUserGrade({ ...created, grade });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  /** Get a user's current grade assignment (detail). 404 if none. */
  async getUserGrade(userId: string): Promise<AdminUserGradeView> {
    const row = await this.db.query.userGrades.findFirst({
      where: eq(userGrades.userId, userId),
      with: { grade: true },
    });
    if (!row) {
      throw new NotFoundException("해당 사용자의 등급 정보를 찾을 수 없습니다.");
    }
    return toAdminUserGrade(row as UserGradeWithDefinition);
  }

  /** List grade assignments (paginated), optionally filtered by grade slug. */
  async listUserGrades(query: ListUserGradesQueryDto) {
    const { page, limit, gradeSlug } = query;

    let gradeId: string | undefined;
    if (gradeSlug) {
      const def = await this.db.query.userGradeDefinitions.findFirst({
        where: eq(userGradeDefinitions.slug, gradeSlug),
      });
      // unknown slug → empty page, not an error
      if (!def) {
        return { items: [], total: 0, page, limit };
      }
      gradeId = def.id;
    }

    const where = gradeId ? eq(userGrades.gradeId, gradeId) : undefined;
    const [rows, countRows] = await Promise.all([
      this.db.query.userGrades.findMany({
        where,
        with: { grade: true },
        orderBy: desc(userGrades.determinedAt),
        limit,
        offset: (page - 1) * limit,
      }),
      this.db.select({ count: sql<number>`cast(count(*) as int)` }).from(userGrades).where(where),
    ]);

    return {
      items: (rows as UserGradeWithDefinition[]).map(toAdminUserGrade),
      total: countRows[0]?.count ?? 0,
      page,
      limit,
    };
  }

  /**
   * Idempotent default-grade provisioning for user creation (초기 상태).
   *
   * Called from the signup path (better-auth `user.create.after` wiring lives
   * in the app layer) to guarantee a freshly-created user has the default
   * `basic` grade. Safe to call repeatedly — the unique `user_id` constraint
   * makes a re-run a no-op via `onConflictDoNothing`.
   */
  async ensureSignupGrade(userId: string, slug: string = DEFAULT_SIGNUP_GRADE_SLUG): Promise<void> {
    const grade = await this.resolveGrade(undefined, slug);
    await this.db
      .insert(userGrades)
      .values({
        userId,
        gradeId: grade.id,
        source: "signup",
        determinedAt: new Date(),
      })
      .onConflictDoNothing({ target: userGrades.userId });
  }

  /** Resolve a grade definition by id or slug; must exist and be active. */
  private async resolveGrade(gradeId?: string, gradeSlug?: string) {
    let where: SQL | undefined;
    if (gradeId) {
      where = eq(userGradeDefinitions.id, gradeId);
    } else if (gradeSlug) {
      where = eq(userGradeDefinitions.slug, gradeSlug);
    }
    if (!where) {
      throw new BadRequestException("gradeSlug 또는 gradeId 중 하나는 필수입니다.");
    }
    const grade = await this.db.query.userGradeDefinitions.findFirst({ where });
    if (!grade) {
      throw new NotFoundException("등급 정의를 찾을 수 없습니다.");
    }
    if (!grade.isActive) {
      throw new BadRequestException("비활성화된 등급은 부여할 수 없습니다.");
    }
    return grade;
  }

  private mapWriteError(error: unknown): Error {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === PG_UNIQUE_VIOLATION) {
        return new ConflictException(
          "이미 등급이 부여된 사용자입니다. 등급 변경은 수정 API를 사용해주세요.",
        );
      }
      if (code === PG_FK_VIOLATION) {
        return new NotFoundException("대상 사용자를 찾을 수 없습니다.");
      }
    }
    this.logger.error(
      "user grade write failed",
      error instanceof Error ? error.stack : String(error),
    );
    return error instanceof Error ? error : new Error(String(error));
  }
}
