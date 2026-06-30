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

  @ApiProperty({
    nullable: true,
    description: "보관(soft-delete) 시각. null = 보관되지 않음. 정지(isActive=false)와 구분",
  })
  deletedAt!: string | null;
}

export class AdminUserListResponseDto {
  @ApiProperty({ type: [AdminUserListItemDto] })
  users!: AdminUserListItemDto[];

  @ApiProperty()
  total!: number;
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

  @ApiProperty({ description: "이 변경으로 해제된 로그인 세션 수 (활성화 시 0)" })
  revokedSessions!: number;
}
