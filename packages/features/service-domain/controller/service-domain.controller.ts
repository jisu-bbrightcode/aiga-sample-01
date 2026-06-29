import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  DoctorListDto,
  HospitalListDto,
  ListDoctorsQueryDto,
  ListHospitalsQueryDto,
  ListRegionsQueryDto,
  PublicDoctorDetailDto,
  PublicHospitalDetailDto,
  PublicRegionDto,
  PublicSpecialtyDto,
} from "../dto";
import { ServiceDomainService } from "../service";

/**
 * Public service-domain catalog API.
 *
 * Every route here is unauthenticated and returns ONLY published, non-deleted
 * records — public sites (apps/site) must stay browsable without login per the
 * online-service workflow rules. Protected mutations live on the admin
 * controller behind the auth + admin guards.
 */
@ApiTags("Service Domain")
@Controller("service")
export class ServiceDomainController {
  constructor(private readonly service: ServiceDomainService) {}

  @Get("specialties")
  @ApiOperation({ summary: "진료과 목록 (공개)" })
  @ApiResponse({ status: 200, type: PublicSpecialtyDto, isArray: true })
  listSpecialties() {
    return this.service.listSpecialties();
  }

  @Get("regions")
  @ApiOperation({ summary: "지역 목록 (공개, parentId로 하위지역 필터)" })
  @ApiResponse({ status: 200, type: PublicRegionDto, isArray: true })
  listRegions(@Query() query: ListRegionsQueryDto) {
    return this.service.listRegions(query.parentId);
  }

  @Get("doctors")
  @ApiOperation({ summary: "의사 목록 (공개, published만)" })
  @ApiResponse({ status: 200, type: DoctorListDto })
  listDoctors(@Query() query: ListDoctorsQueryDto) {
    return this.service.listDoctors(query);
  }

  @Get("doctors/:slug")
  @ApiOperation({ summary: "의사 상세 (공개, 진료과/병원/지역 포함)" })
  @ApiResponse({ status: 200, type: PublicDoctorDetailDto })
  @ApiResponse({ status: 404, description: "의사를 찾을 수 없음" })
  getDoctor(@Param("slug") slug: string) {
    return this.service.getDoctorBySlug(slug);
  }

  @Get("hospitals")
  @ApiOperation({ summary: "병원 목록 (공개, published만)" })
  @ApiResponse({ status: 200, type: HospitalListDto })
  listHospitals(@Query() query: ListHospitalsQueryDto) {
    return this.service.listHospitals(query);
  }

  @Get("hospitals/:slug")
  @ApiOperation({ summary: "병원 상세 (공개, 지역/소속의사 포함)" })
  @ApiResponse({ status: 200, type: PublicHospitalDetailDto })
  @ApiResponse({ status: 404, description: "병원을 찾을 수 없음" })
  getHospital(@Param("slug") slug: string) {
    return this.service.getHospitalBySlug(slug);
  }
}
