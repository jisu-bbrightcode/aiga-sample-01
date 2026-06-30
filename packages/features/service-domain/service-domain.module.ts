import { Module, type OnModuleInit } from "@nestjs/common";
import {
  ServiceDomainAdminController,
  ServiceDomainAdminResourcesController,
  ServiceDomainController,
} from "./controller";
import { ServiceDomainService } from "./service";
import { setServiceDomainService } from "./service-registry";

/**
 * Service-domain REST API (PB-DOMAIN-001 / BBR-525).
 *
 * Capability: `domain.service-api` — the core CRUD / browse / status-change
 * API for the 의사·병원 큐레이션 catalog defined by PB-DATA-001. Public read
 * controller + admin-gated mutation controller share one service.
 */
@Module({
  controllers: [
    ServiceDomainController,
    ServiceDomainAdminController,
    ServiceDomainAdminResourcesController,
  ],
  providers: [ServiceDomainService],
  exports: [ServiceDomainService],
})
export class ServiceDomainModule implements OnModuleInit {
  constructor(private readonly service: ServiceDomainService) {}

  onModuleInit() {
    setServiceDomainService(this.service);
  }
}
