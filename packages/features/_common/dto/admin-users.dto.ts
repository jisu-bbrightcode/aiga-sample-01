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

  @ApiProperty()
  createdAt!: string;

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
