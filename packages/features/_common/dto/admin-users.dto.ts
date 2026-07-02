import { ApiProperty } from "@nestjs/swagger";

export class AdminUserListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  image!: string | null;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({
    enum: ["owner", "admin", "member"],
    nullable: true,
    description: "관리자 접근 역할 (조직 멤버십). 멤버가 아니면 null",
  })
  accessRole!: "owner" | "admin" | "member" | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ nullable: true, description: "프로필 최근 업데이트(최근활동) 시각" })
  lastActiveAt!: string | null;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty()
  isActive!: boolean;
}

export class AdminUserListResponseDto {
  @ApiProperty({ type: [AdminUserListItemDto] })
  users!: AdminUserListItemDto[];

  @ApiProperty()
  total!: number;
}

export class AdminUserAuthProviderDto {
  @ApiProperty({ description: "로그인 수단 식별자 (예: google, credential)" })
  providerId!: string;

  @ApiProperty({ description: "연결 시각" })
  linkedAt!: string;
}

export class AdminUserSessionSummaryDto {
  @ApiProperty({ description: "현재 유효한 세션 수" })
  activeCount!: number;

  @ApiProperty({ nullable: true, description: "마지막 활동 시각" })
  lastActiveAt!: string | null;

  @ApiProperty({ nullable: true, description: "최근 세션 IP" })
  lastIpAddress!: string | null;

  @ApiProperty({ nullable: true, description: "최근 세션 User-Agent" })
  lastUserAgent!: string | null;
}

export class AdminUserSubscriptionSummaryDto {
  @ApiProperty()
  status!: string;

  @ApiProperty({ nullable: true })
  currentPeriodEnd!: string | null;

  @ApiProperty()
  cancelAtPeriodEnd!: boolean;
}

export class AdminUserAuditEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  actorUserId!: string;

  @ApiProperty({ nullable: true })
  reason!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class AdminUserDetailDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true })
  image!: string | null;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ nullable: true })
  lastActiveAt!: string | null;

  @ApiProperty({
    enum: ["owner", "admin", "member"],
    nullable: true,
    description: "관리자 접근 역할 (조직 멤버십). 멤버가 아니면 null",
  })
  accessRole!: "owner" | "admin" | "member" | null;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({
    type: [AdminUserAuthProviderDto],
    description: "연결된 로그인 수단 (비밀값 제외)",
  })
  authProviders!: AdminUserAuthProviderDto[];

  @ApiProperty({ type: AdminUserSessionSummaryDto, description: "세션/활동 요약 (token 제외)" })
  sessions!: AdminUserSessionSummaryDto;

  @ApiProperty({ type: AdminUserSubscriptionSummaryDto, nullable: true, description: "결제 요약" })
  subscription!: AdminUserSubscriptionSummaryDto | null;

  @ApiProperty({ type: [AdminUserAuditEntryDto], description: "최근 관리자 변경 이력" })
  recentAudit!: AdminUserAuditEntryDto[];
}

export class ChangeUserStatusBodyDto {
  @ApiProperty({ description: "활성 여부 (false = 계정 정지)" })
  isActive!: boolean;

  @ApiProperty({ required: false, description: "변경 사유 (감사 로그에 기록)" })
  reason?: string;
}

export class ChangeUserStatusResponseDto {
  @ApiProperty()
  targetUserId!: string;

  @ApiProperty()
  previousActive!: boolean;

  @ApiProperty()
  isActive!: boolean;
}
