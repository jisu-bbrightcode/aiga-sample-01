import { Module, type OnModuleInit } from "@nestjs/common";
import {
  ServiceSearchAdminController,
  ServiceSearchController,
  ServiceSearchSynonymsAdminController,
} from "./controller";
import { ServiceSearchService, ServiceSearchSynonymsService } from "./service";
import { setServiceSearchService } from "./service-registry";

/**
 * 통합검색 REST API (FR-003).
 *
 * Capability: `domain.feature.fr-003.api.list` (BBR-531) — unified list/search
 * over the PB-DATA-FR003 search projection — plus `…api.create` (BBR-533) —
 * admin-curated search synonyms. Public read controller + admin list/search
 * controller share `ServiceSearchService`; the admin synonym controller uses a
 * dedicated `ServiceSearchSynonymsService`.
 */
@Module({
  controllers: [
    ServiceSearchController,
    ServiceSearchAdminController,
    ServiceSearchSynonymsAdminController,
  ],
  providers: [ServiceSearchService, ServiceSearchSynonymsService],
  exports: [ServiceSearchService, ServiceSearchSynonymsService],
})
export class ServiceSearchModule implements OnModuleInit {
  constructor(private readonly service: ServiceSearchService) {}

  onModuleInit() {
    setServiceSearchService(this.service);
  }
}
