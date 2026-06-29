import { Module } from "@nestjs/common";
import { PersonalizationController } from "./controller";
import { PersonalizationService } from "./service";

/**
 * Personalization REST API (FR-002 / BBR-724).
 *
 * Capability: `personalization.list-api` — owner-scoped list endpoints for the
 * 저장/관심/검색 히스토리 records defined by PB-FEAT-002 (BBR-732). Auth-gated
 * read-only; mutations are owned by sibling FR-002 issues.
 */
@Module({
  controllers: [PersonalizationController],
  providers: [PersonalizationService],
  exports: [PersonalizationService],
})
export class PersonalizationModule {}
