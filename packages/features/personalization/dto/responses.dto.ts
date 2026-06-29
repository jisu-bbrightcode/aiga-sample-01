/**
 * Personalization list response DTOs (FR-002 / BBR-724).
 *
 * These classes exist purely to give Nest/Swagger a concrete type for the
 * OpenAPI contract (acceptance: OpenAPI 계약 반영). The actual values are built
 * by the service mappers; we keep the wire shape here so it is the single
 * source of truth for the documented response.
 */
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/** Catalog resource kind a save/interest points at. */
export type PersonalizationTargetType = "doctor" | "hospital";

export class SavedItemDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["doctor", "hospital"] })
  targetType!: PersonalizationTargetType;

  @ApiProperty({ format: "uuid" })
  targetId!: string;

  @ApiPropertyOptional({ nullable: true, description: "사용자가 저장에 남긴 비공개 메모" })
  memo!: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true, description: "사용자 지정 태그" })
  tags!: string[] | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;
}

export class InterestDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["doctor", "hospital"] })
  targetType!: PersonalizationTargetType;

  @ApiProperty({ format: "uuid" })
  targetId!: string;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;
}

export class SearchHistoryDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ description: "검색어 (필터 전용 검색은 빈 문자열 허용)" })
  query!: string;

  @ApiPropertyOptional({
    nullable: true,
    type: "object",
    additionalProperties: true,
    description: "적용된 필터 스냅샷 (지역/진료과/정렬 등)",
  })
  filters!: unknown;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;
}

export class SavedItemListDto {
  @ApiProperty({ type: [SavedItemDto] })
  items!: SavedItemDto[];

  @ApiProperty({
    nullable: true,
    description: "다음 페이지 커서. null이면 마지막 페이지.",
  })
  nextCursor!: string | null;
}

export class InterestListDto {
  @ApiProperty({ type: [InterestDto] })
  items!: InterestDto[];

  @ApiProperty({ nullable: true, description: "다음 페이지 커서. null이면 마지막 페이지." })
  nextCursor!: string | null;
}

export class SearchHistoryListDto {
  @ApiProperty({ type: [SearchHistoryDto] })
  items!: SearchHistoryDto[];

  @ApiProperty({ nullable: true, description: "다음 페이지 커서. null이면 마지막 페이지." })
  nextCursor!: string | null;
}
