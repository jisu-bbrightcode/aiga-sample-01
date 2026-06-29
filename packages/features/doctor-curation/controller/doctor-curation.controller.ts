import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  CollectionListDto,
  PublicCollectionDetailDto,
  PublicListCollectionsQueryDto,
} from "../dto";
import { DoctorCurationService } from "../service";

/**
 * Public 명의 큐레이션 browse API — FR-004 (BBR-536).
 *
 * Unauthenticated — the 명의 찾기 discovery surface stays browsable without login
 * per the online-service workflow rules. Every route returns ONLY published,
 * non-deleted collections, projected through the fail-closed public mapper. The
 * editorial create + admin read-back surface lives on the admin controller
 * (BBR-538) behind the auth + admin guards.
 */
@ApiTags("Doctor Curation")
@Controller("doctor-collections")
export class DoctorCurationController {
  constructor(private readonly service: DoctorCurationService) {}

  @Get()
  @ApiOperation({ summary: "명의 컬렉션 목록 (공개, published만, 검색/필터/페이지네이션)" })
  @ApiResponse({ status: 200, type: CollectionListDto })
  listCollections(@Query() query: PublicListCollectionsQueryDto) {
    return this.service.listPublicCollections(query);
  }

  @Get(":slug")
  @ApiOperation({ summary: "명의 컬렉션 상세 (공개, 수록 의사 rank 순)" })
  @ApiResponse({ status: 200, type: PublicCollectionDetailDto })
  @ApiResponse({ status: 404, description: "컬렉션을 찾을 수 없음" })
  getCollection(@Param("slug") slug: string) {
    return this.service.getPublicCollectionBySlug(slug);
  }
}
