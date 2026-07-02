import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import type { User } from "@repo/core/nestjs/auth";
import { RateLimitService } from "@repo/core/rate-limit";

/**
 * 커뮤니티 회원 등급 — 게시글 열람 일일 제한 정책의 기준.
 *
 * - `guest`    : 비회원(미인증 요청). 가장 엄격한 일일 제한.
 * - `general`  : 로그인했으나 인증회원으로 분류되지 않은 일반 회원. 일일 제한 적용.
 * - `verified` : 인증회원(또는 운영/관리자 role). 열람 무제한.
 */
export type CommunityMemberGrade = "guest" | "general" | "verified";

/** 게시글 열람 제한 검사를 위한 요청 주체 정보. */
export interface PostViewActor {
  /** 인증된 사용자. 비회원이면 `undefined`/`null`. */
  user?: Pick<User, "id" | "role" | "roleIds"> | null;
  /** 비회원 식별용 클라이언트 IP (없으면 `unknown` 버킷으로 합산). */
  clientIp?: string | null;
}

const RATE_LIMIT_ACTION = "community:post-view";
const ONE_DAY_SECONDS = 86_400;

const DEFAULT_GUEST_DAILY_LIMIT = 5;
const DEFAULT_GENERAL_DAILY_LIMIT = 20;
const DEFAULT_VERIFIED_ROLES = ["admin", "moderator", "verified", "verified_member", "system"];

/** 열람 제한 정책 설정 (환경변수 기반, 요청 시점에 안전하게 파싱). */
interface PostViewLimitConfig {
  guestDailyLimit: number;
  generalDailyLimit: number;
  verifiedRoles: Set<string>;
  authenticatedUnlimited: boolean;
}

function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parseCsvSet(raw: string | undefined, fallback: string[]): Set<string> {
  const source = raw && raw.trim() !== "" ? raw.split(",") : fallback;
  return new Set(source.map((value) => value.trim().toLowerCase()).filter((value) => value !== ""));
}

/**
 * 등급별 게시글 열람 일일 N회 제한 서비스.
 *
 * 정책: **비회원/일반 회원은 하루 N회로 제한, 인증회원은 무제한.**
 * 슬라이딩 24시간 창을 사용하는 공용 {@link RateLimitService} 를 재사용한다.
 *
 * ## 등급 판정 (`resolveGrade`)
 * 현재 REST 인증 가드는 `User` 에 `id/email/activeOrganizationId` 만 채우므로,
 * 인증회원 판정은 `user.role` / `user.roleIds` 를 설정 가능한 verified role 집합과
 * 대조해 수행한다. 인증/등급 체계([BBR-1121])가 role/grade 를 세션에 주입하면
 * 별도 변경 없이 자동으로 인증회원이 무제한으로 전환된다. 그전까지는 보수적으로
 * "미분류 로그인 사용자 = general(제한)" 로 취급한다.
 *
 * ## 설정 (환경변수)
 * - `COMMUNITY_POST_VIEW_GUEST_DAILY_LIMIT`   (기본 5)
 * - `COMMUNITY_POST_VIEW_GENERAL_DAILY_LIMIT` (기본 20)
 * - `COMMUNITY_POST_VIEW_VERIFIED_ROLES`      (CSV, 기본 admin,moderator,verified,verified_member,system)
 * - `COMMUNITY_POST_VIEW_AUTHENTICATED_UNLIMITED` ("true" 면 로그인만 하면 무제한)
 * - `RATE_LIMIT_ENABLED=false` 면 전체 비활성 (RateLimitService 위임).
 */
@Injectable()
export class CommunityPostViewLimitService {
  constructor(private readonly rateLimit: RateLimitService) {}

  private readConfig(): PostViewLimitConfig {
    return {
      guestDailyLimit: parseNonNegativeInt(
        process.env.COMMUNITY_POST_VIEW_GUEST_DAILY_LIMIT,
        DEFAULT_GUEST_DAILY_LIMIT,
      ),
      generalDailyLimit: parseNonNegativeInt(
        process.env.COMMUNITY_POST_VIEW_GENERAL_DAILY_LIMIT,
        DEFAULT_GENERAL_DAILY_LIMIT,
      ),
      verifiedRoles: parseCsvSet(
        process.env.COMMUNITY_POST_VIEW_VERIFIED_ROLES,
        DEFAULT_VERIFIED_ROLES,
      ),
      authenticatedUnlimited:
        (process.env.COMMUNITY_POST_VIEW_AUTHENTICATED_UNLIMITED ?? "").toLowerCase() === "true",
    };
  }

  /** 요청 주체의 커뮤니티 등급을 판정한다. */
  resolveGrade(
    user: PostViewActor["user"],
    config: PostViewLimitConfig = this.readConfig(),
  ): CommunityMemberGrade {
    if (!user?.id) return "guest";
    if (config.authenticatedUnlimited) return "verified";

    const roles = [user.role, ...(user.roleIds ?? [])]
      .filter((role): role is string => typeof role === "string" && role.trim() !== "")
      .map((role) => role.toLowerCase());

    if (roles.some((role) => config.verifiedRoles.has(role))) return "verified";
    return "general";
  }

  /**
   * 게시글 열람 가능 여부를 검사하고 초과 시 429 를 던진다.
   * 통과하면 소비된 등급을 반환한다 (호출부 로깅/응답 헤더용).
   */
  async assertCanView(actor: PostViewActor): Promise<CommunityMemberGrade> {
    const config = this.readConfig();
    const grade = this.resolveGrade(actor.user, config);

    // 인증회원은 무제한 — 카운트 소비 없이 통과.
    if (grade === "verified") return grade;

    const limit = grade === "guest" ? config.guestDailyLimit : config.generalDailyLimit;
    const identifier =
      grade === "guest" ? `guest:${actor.clientIp?.trim() || "unknown"}` : `user:${actor.user?.id}`;

    const result = await this.rateLimit.check(identifier, {
      action: RATE_LIMIT_ACTION,
      maxRequests: limit,
      windowSeconds: ONE_DAY_SECONDS,
    });

    if (!result.allowed) {
      throw new HttpException(
        {
          message:
            grade === "guest"
              ? "비회원 일일 게시글 열람 한도를 초과했습니다. 로그인 후 이용해 주세요."
              : "일일 게시글 열람 한도를 초과했습니다. 인증회원으로 전환하면 무제한 열람이 가능합니다.",
          errorCode: "POST_VIEW_DAILY_LIMIT_EXCEEDED",
          grade,
          dailyLimit: limit,
          retryAfter: result.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return grade;
  }
}
