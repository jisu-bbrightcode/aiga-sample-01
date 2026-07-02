import { ApiProperty } from "@nestjs/swagger";
import { INVITABLE_ROLES } from "../helpers/invite-policy";

export class InviteUserBodyDto {
  @ApiProperty({ description: "초대할 운영자 이메일", example: "operator@example.com" })
  email!: string;

  @ApiProperty({
    enum: INVITABLE_ROLES,
    description: "초기 접근 역할 (owner는 초대로 부여할 수 없음)",
  })
  role!: (typeof INVITABLE_ROLES)[number];

  @ApiProperty({ required: false, description: "초대 사유 (감사 로그에 기록)" })
  reason?: string;
}

export class ResendInvitationBodyDto {
  @ApiProperty({ required: false, description: "재발송 사유 (감사 로그에 기록)" })
  reason?: string;
}

export class InvitationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ description: "초기 접근 역할" })
  role!: string;

  @ApiProperty({ description: "초대 상태 (pending/accepted/canceled 등)" })
  status!: string;

  @ApiProperty({ description: "만료 시각 (ISO-8601)" })
  expiresAt!: string;

  @ApiProperty({ nullable: true, description: "생성 시각 (ISO-8601)" })
  createdAt!: string | null;
}

export class InvitationListResponseDto {
  @ApiProperty({ type: [InvitationResponseDto] })
  invitations!: InvitationResponseDto[];
}
