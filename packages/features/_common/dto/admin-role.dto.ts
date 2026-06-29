import { ApiProperty } from "@nestjs/swagger";

export class ChangeUserRoleBodyDto {
  @ApiProperty({ enum: ["admin", "member"], description: "부여할 접근 역할" })
  role!: "admin" | "member";

  @ApiProperty({ required: false, description: "변경 사유 (감사 로그에 기록)" })
  reason?: string;
}

export class ChangeUserRoleResponseDto {
  @ApiProperty()
  targetUserId!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  previousRole!: string;

  @ApiProperty({ enum: ["admin", "member"] })
  role!: "admin" | "member";
}
