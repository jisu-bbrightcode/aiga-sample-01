import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import {
  CollectionListDto,
  PublicCollectionDetailDto,
  PublicListCollectionsQueryDto,
} from "../dto";
import { OptionalUser } from "../optional-user.decorator";
import { DoctorCurationService } from "../service";

/**
 * Public 명의 큐레이션 browse API — FR-004 (BBR-536 list, BBR-537 detail/viewer-state).
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
  @ApiOperation({
    summary: "명의 컬렉션 상세 (공개, 수록 의사 rank 순)",
    description:
      "비로그인(guest)·로그인(member) 모두 조회 가능하며 응답의 viewerState로 구분된다. " +
      "published 컬렉션만 노출하고, 없는 slug와 미게시(draft)·삭제된 컬렉션은 동일하게 404로 응답해 " +
      "존재 여부가 새지 않게 한다(미게시 조회는 관리자 상세 라우트 사용).",
  })
  @ApiResponse({ status: 200, type: PublicCollectionDetailDto })
  @ApiResponse({ status: 404, description: "컬렉션을 찾을 수 없음(없거나 미게시/삭제됨)" })
  getCollection(@Param("slug") slug: string, @OptionalUser() user?: User) {
    return this.service.getPublicCollectionBySlug(slug, user);
  }
}
