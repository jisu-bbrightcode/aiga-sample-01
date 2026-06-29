import { ApiProperty } from "@nestjs/swagger";

export class AdminAuditLogItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  actorUserId!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty({ nullable: true })
  targetType!: string | null;

  @ApiProperty({ nullable: true })
  targetId!: string | null;

  @ApiProperty({ nullable: true, type: Object })
  payloadBefore!: unknown;

  @ApiProperty({ nullable: true, type: Object })
  payloadAfter!: unknown;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ nullable: true })
  userAgent!: string | null;

  @ApiProperty({ nullable: true })
  reason!: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class AdminAuditListResponseDto {
  @ApiProperty({ type: [AdminAuditLogItemDto] })
  rows!: AdminAuditLogItemDto[];

  @ApiProperty({ nullable: true, description: "다음 페이지 커서 (id), 없으면 null" })
  nextCursor!: string | null;
}
