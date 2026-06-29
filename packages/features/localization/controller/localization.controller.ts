import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { BetterAuthGuard } from "@repo/core/nestjs/auth";
import { LocalizationService } from "../service/localization.service";
import {
  BulkUpdateTranslationDto,
  CreateGlossaryDto,
  CreateLanguageDto,
  CreateTranslationDto,
  DeleteResponseDto,
  GlossaryResponseDto,
  LanguageResponseDto,
  ProgressResponseDto,
  TranslationResponseDto,
  UpdateGlossaryDto,
  UpdateLanguageDto,
  UpdateTranslationDto,
} from "../dto";

@ApiTags("Localization")
@Controller("localization")
@UseGuards(BetterAuthGuard)
@ApiBearerAuth()
export class LocalizationController {
  constructor(private readonly localizationService: LocalizationService) {}

  // ============================================================================
  // Languages
  // ============================================================================

  @Get("projects/:projectId/languages")
  @ApiOperation({ summary: "프로젝트의 언어 목록 조회" })
  @ApiParam({ name: "projectId", description: "프로젝트 ID" })
  @ApiResponse({ status: 200, description: "언어 목록 반환", type: LanguageResponseDto, isArray: true })
  async listLanguages(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ) {
    return this.localizationService.listLanguages(projectId);
  }

  @Get("languages/:id")
  @ApiOperation({ summary: "언어 상세 조회" })
  @ApiParam({ name: "id", description: "언어 ID" })
  @ApiResponse({ status: 200, description: "언어 상세 정보", type: LanguageResponseDto })
  @ApiResponse({ status: 404, description: "언어를 찾을 수 없음" })
  async getLanguage(@Param("id", ParseUUIDPipe) id: string) {
    return this.localizationService.getLanguage(id);
  }

  @Post("projects/:projectId/languages")
  @ApiOperation({ summary: "언어 생성" })
  @ApiParam({ name: "projectId", description: "프로젝트 ID" })
  @ApiResponse({ status: 201, description: "언어 생성 성공", type: LanguageResponseDto })
  async createLanguage(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateLanguageDto,
  ) {
    return this.localizationService.createLanguage(projectId, dto);
  }

  @Put("languages/:id")
  @ApiOperation({ summary: "언어 수정" })
  @ApiParam({ name: "id", description: "언어 ID" })
  @ApiResponse({ status: 200, description: "언어 수정 성공", type: LanguageResponseDto })
  async updateLanguage(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateLanguageDto) {
    return this.localizationService.updateLanguage(id, dto);
  }

  @Delete("languages/:id")
  @ApiOperation({ summary: "언어 삭제 (soft delete)" })
  @ApiParam({ name: "id", description: "언어 ID" })
  @ApiResponse({ status: 200, description: "언어 삭제 성공", type: DeleteResponseDto })
  async deleteLanguage(@Param("id", ParseUUIDPipe) id: string) {
    return this.localizationService.deleteLanguage(id);
  }

  // ============================================================================
  // Translations
  // ============================================================================

  @Get("projects/:projectId/languages/:languageId/translations")
  @ApiOperation({ summary: "번역 목록 조회" })
  @ApiParam({ name: "projectId", description: "프로젝트 ID" })
  @ApiParam({ name: "languageId", description: "언어 ID" })
  @ApiQuery({ name: "entityType", required: false, type: String })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiResponse({ status: 200, description: "번역 목록 반환", type: TranslationResponseDto, isArray: true })
  async listTranslations(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("languageId", ParseUUIDPipe) languageId: string,
    @Query("entityType") entityType?: string,
    @Query("status") status?: string,
  ) {
    return this.localizationService.listTranslations(projectId, languageId, {
      entityType,
      status,
    });
  }

  @Get("translations/:id")
  @ApiOperation({ summary: "번역 상세 조회" })
  @ApiParam({ name: "id", description: "번역 ID" })
  @ApiResponse({ status: 200, description: "번역 상세 정보", type: TranslationResponseDto })
  @ApiResponse({ status: 404, description: "번역을 찾을 수 없음" })
  async getTranslation(@Param("id", ParseUUIDPipe) id: string) {
    return this.localizationService.getTranslation(id);
  }

  @Post("projects/:projectId/translations")
  @ApiOperation({ summary: "번역 생성" })
  @ApiParam({ name: "projectId", description: "프로젝트 ID" })
  @ApiResponse({ status: 201, description: "번역 생성 성공", type: TranslationResponseDto })
  async createTranslation(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateTranslationDto,
  ) {
    return this.localizationService.createTranslation(projectId, dto);
  }

  @Put("translations/:id")
  @ApiOperation({ summary: "번역 수정" })
  @ApiParam({ name: "id", description: "번역 ID" })
  @ApiResponse({ status: 200, description: "번역 수정 성공", type: TranslationResponseDto })
  async updateTranslation(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTranslationDto,
  ) {
    return this.localizationService.updateTranslation(id, dto);
  }

  @Post("translations/bulk-update")
  @ApiOperation({ summary: "번역 일괄 수정" })
  @ApiResponse({ status: 200, description: "번역 일괄 수정 성공", type: TranslationResponseDto, isArray: true })
  async bulkUpdateTranslations(@Body() dto: BulkUpdateTranslationDto) {
    return this.localizationService.bulkUpdateTranslations(dto.items);
  }

  @Get("projects/:projectId/languages/:languageId/progress")
  @ApiOperation({ summary: "번역 진행률 조회" })
  @ApiParam({ name: "projectId", description: "프로젝트 ID" })
  @ApiParam({ name: "languageId", description: "언어 ID" })
  @ApiResponse({ status: 200, description: "번역 진행률 반환", type: ProgressResponseDto })
  async calculateProgress(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("languageId", ParseUUIDPipe) languageId: string,
  ) {
    return this.localizationService.calculateProgress(projectId, languageId);
  }

  // ============================================================================
  // Glossary
  // ============================================================================

  @Get("projects/:projectId/glossary")
  @ApiOperation({ summary: "용어집 목록 조회" })
  @ApiParam({ name: "projectId", description: "프로젝트 ID" })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiResponse({ status: 200, description: "용어집 목록 반환", type: GlossaryResponseDto, isArray: true })
  async listGlossary(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query("search") search?: string,
  ) {
    return this.localizationService.listGlossary(projectId, search);
  }

  @Get("glossary/:id")
  @ApiOperation({ summary: "용어집 항목 상세 조회" })
  @ApiParam({ name: "id", description: "용어집 항목 ID" })
  @ApiResponse({ status: 200, description: "용어집 항목 상세 정보", type: GlossaryResponseDto })
  @ApiResponse({ status: 404, description: "용어집 항목을 찾을 수 없음" })
  async getGlossaryEntry(@Param("id", ParseUUIDPipe) id: string) {
    return this.localizationService.getGlossaryEntry(id);
  }

  @Post("projects/:projectId/glossary")
  @ApiOperation({ summary: "용어집 항목 생성" })
  @ApiParam({ name: "projectId", description: "프로젝트 ID" })
  @ApiResponse({ status: 201, description: "용어집 항목 생성 성공", type: GlossaryResponseDto })
  async createGlossaryEntry(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateGlossaryDto,
  ) {
    return this.localizationService.createGlossaryEntry(projectId, dto);
  }

  @Put("glossary/:id")
  @ApiOperation({ summary: "용어집 항목 수정" })
  @ApiParam({ name: "id", description: "용어집 항목 ID" })
  @ApiResponse({ status: 200, description: "용어집 항목 수정 성공", type: GlossaryResponseDto })
  async updateGlossaryEntry(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateGlossaryDto,
  ) {
    return this.localizationService.updateGlossaryEntry(id, dto);
  }

  @Delete("glossary/:id")
  @ApiOperation({ summary: "용어집 항목 삭제 (soft delete)" })
  @ApiParam({ name: "id", description: "용어집 항목 ID" })
  @ApiResponse({ status: 200, description: "용어집 항목 삭제 성공", type: DeleteResponseDto })
  async deleteGlossaryEntry(@Param("id", ParseUUIDPipe) id: string) {
    return this.localizationService.deleteGlossaryEntry(id);
  }
}
