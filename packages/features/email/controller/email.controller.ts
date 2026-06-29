/**
 * Email Feature - REST Controller
 *
 * tRPC 프로시저와 1:1 대응하는 REST 엔드포인트를 제공합니다.
 * 모든 엔드포인트는 Admin 권한이 필요합니다.
 */

import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { User } from "@repo/core/nestjs/auth";
import { BetterAuthAdminGuard, BetterAuthGuard, CurrentUser } from "@repo/core/nestjs/auth";
import type { EmailTemplateType } from "@repo/drizzle/schema";
import {
  CreateEmailTemplateDto,
  EmailLogResponseDto,
  EmailTemplateDetailDto,
  EmailTemplatePreviewDto,
  EmailTemplateSummaryDto,
  EmailTemplateValidationDto,
  PreviewTemplateResponseDto,
  ResendEmailResponseDto,
  TemplateVariablesBodyDto,
} from "../dto";
import { EmailService } from "../service/email.service";
import { EmailTemplateService } from "../service/email-template.service";
import { EmailTemplateRegistryService } from "../service/email-template-registry.service";

@ApiTags("Email")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, BetterAuthAdminGuard)
@Controller("admin/email")
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: EmailTemplateService,
    private readonly templateRegistry: EmailTemplateRegistryService,
  ) {}

  // ============================================================================
  // Admin Endpoints (Admin 권한 필요)
  // ============================================================================

  @Get("logs")
  @ApiOperation({ summary: "[Admin] 이메일 로그 목록 조회" })
  @ApiQuery({ name: "page", required: false, type: Number, description: "페이지 번호 (기본값: 1)" })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "페이지당 항목 수 (기본값: 20, 최대: 100)",
  })
  @ApiQuery({
    name: "status",
    required: false,
    type: String,
    description: "이메일 상태 필터 (pending, sending, sent, delivered, failed, bounced, opened)",
  })
  @ApiQuery({
    name: "templateType",
    required: false,
    type: String,
    description:
      "템플릿 타입 필터 (welcome, email-verification, password-reset, password-changed, notification)",
  })
  @ApiQuery({ name: "search", required: false, type: String, description: "이메일 주소 검색" })
  @ApiResponse({
    status: 200,
    description: "이메일 로그 목록 반환",
    type: EmailLogResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  async getLogs(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("status") status?: string,
    @Query("templateType") templateType?: string,
    @Query("search") search?: string,
  ) {
    return this.emailService.getEmailLogs({
      page,
      limit,
      status: status as any,
      templateType: templateType as any,
      search,
    });
  }

  @Get("logs/:logId")
  @ApiOperation({ summary: "[Admin] 이메일 로그 상세 조회" })
  @ApiParam({ name: "logId", description: "이메일 로그 ID (UUID)" })
  @ApiResponse({ status: 200, description: "이메일 로그 상세 반환", type: EmailLogResponseDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "이메일 로그를 찾을 수 없음" })
  async getLog(@Param("logId", ParseUUIDPipe) logId: string) {
    const log = await this.emailService.getEmailLog(logId);

    if (!log) {
      throw new NotFoundException("Email log not found");
    }

    return log;
  }

  @Post("logs/:logId/resend")
  @ApiOperation({ summary: "[Admin] 이메일 재발송" })
  @ApiParam({ name: "logId", description: "재발송할 이메일 로그 ID (UUID)" })
  @ApiResponse({ status: 200, description: "재발송 성공", type: ResendEmailResponseDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "이메일 로그를 찾을 수 없음" })
  async resend(@Param("logId", ParseUUIDPipe) logId: string) {
    const log = await this.emailService.resendEmail(logId);
    return { success: true, log };
  }

  // ============================================================================
  // Template registry (PB-NOTI-EMAIL-TEMPLATE-001 / BBR-656)
  // ============================================================================

  @Get("templates")
  @ApiOperation({ summary: "[Admin] 이메일 템플릿 목록 (현재 published 상태 포함)" })
  @ApiResponse({
    status: 200,
    description: "템플릿 목록 반환",
    type: EmailTemplateSummaryDto,
    isArray: true,
  })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  listTemplates() {
    return this.templateRegistry.listTemplates();
  }

  @Post("templates")
  @ApiOperation({ summary: "[Admin] 이메일 템플릿 생성 (초기 draft 버전 포함)" })
  @ApiBody({ type: CreateEmailTemplateDto })
  @ApiResponse({
    status: 201,
    description: "생성된 템플릿 + 초기 draft 버전 반환",
    type: EmailTemplateDetailDto,
  })
  @ApiResponse({ status: 400, description: "요청 본문이 올바르지 않음" })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 422, description: "중복 템플릿 키 또는 잘못된 변수 스키마" })
  createTemplate(@CurrentUser() user: User, @Body() dto: CreateEmailTemplateDto) {
    return this.templateRegistry.createTemplate(user.id, dto);
  }

  @Get("templates/:key")
  @ApiOperation({ summary: "[Admin] 이메일 템플릿 상세 (draft/published 버전 구분)" })
  @ApiParam({ name: "key", description: "템플릿 키 (예: auth.welcome)" })
  @ApiResponse({
    status: 200,
    description: "템플릿 + 버전 목록 반환",
    type: EmailTemplateDetailDto,
  })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "템플릿을 찾을 수 없음" })
  getTemplate(@Param("key") key: string) {
    return this.templateRegistry.getTemplate(key);
  }

  @Post("templates/:key/validate")
  @ApiOperation({ summary: "[Admin] 템플릿 변수 검증 (발송 전 누락/타입 불일치 확인)" })
  @ApiParam({ name: "key", description: "템플릿 키 (예: password.password-reset)" })
  @ApiBody({ type: TemplateVariablesBodyDto, description: "검증할 템플릿 변수 맵" })
  @ApiResponse({ status: 200, description: "검증 결과 반환", type: EmailTemplateValidationDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "게시된 버전을 찾을 수 없음" })
  validateTemplate(@Param("key") key: string, @Body() variables: Record<string, unknown>) {
    return this.templateRegistry.validateVariables(key, variables ?? {});
  }

  @Post("templates/:key/preview")
  @ApiOperation({ summary: "[Admin] 템플릿 미리보기 (subject/body 렌더 + 변수 검증 리포트)" })
  @ApiParam({ name: "key", description: "템플릿 키 (예: auth.welcome)" })
  @ApiBody({ type: TemplateVariablesBodyDto, description: "미리보기에 사용할 템플릿 변수 맵" })
  @ApiResponse({
    status: 200,
    description: "렌더링된 미리보기 payload 반환",
    type: EmailTemplatePreviewDto,
  })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "게시된 버전을 찾을 수 없음" })
  previewByKey(@Param("key") key: string, @Body() variables: Record<string, unknown>) {
    return this.templateRegistry.preview(key, variables ?? {});
  }

  @Get("templates/:templateType/preview")
  @ApiOperation({ summary: "[Admin] React 렌더러 단위 HTML 미리보기 (쿼리 변수 사용)" })
  @ApiParam({
    name: "templateType",
    description:
      "템플릿 타입 (welcome, email-verification, password-reset, password-changed, notification)",
  })
  @ApiResponse({ status: 200, description: "렌더링된 HTML 반환", type: PreviewTemplateResponseDto })
  @ApiResponse({ status: 401, description: "인증 필요" })
  @ApiResponse({ status: 403, description: "관리자 권한 필요" })
  @ApiResponse({ status: 404, description: "템플릿 타입을 찾을 수 없음" })
  async previewTemplate(
    @Param("templateType") templateType: string,
    @Query() variables: Record<string, string>,
  ) {
    const html = await this.templateService.render(
      templateType as EmailTemplateType,
      variables ?? {},
    );
    return { html };
  }
}
