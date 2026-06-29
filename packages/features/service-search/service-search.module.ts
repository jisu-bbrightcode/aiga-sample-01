import { Module, type OnModuleInit } from "@nestjs/common";
import { ServiceSearchAdminController, ServiceSearchController } from "./controller";
import { ServiceSearchService } from "./service";
import { setServiceSearchService } from "./service-registry";

/**
 * 통합검색 REST API (FR-003 / BBR-531).
 *
 * Capability: `domain.feature.fr-003.api.list` — the unified list/search API
 * over the PB-DATA-FR003 search projection (built on the PB-DATA-001 catalog
 * hub). Public read controller + admin-gated controller share one service.
 */
@Module({
  controllers: [ServiceSearchController, ServiceSearchAdminController],
  providers: [ServiceSearchService],
  exports: [ServiceSearchService],
})
export class ServiceSearchModule implements OnModuleInit {
  constructor(private readonly service: ServiceSearchService) {}

  onModuleInit() {
    setServiceSearchService(this.service);
  }
}
