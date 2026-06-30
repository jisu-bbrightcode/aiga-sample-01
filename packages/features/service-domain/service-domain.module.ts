import { Module, type OnModuleInit } from "@nestjs/common";
import { AdminAuditService } from "@repo/features/_common";
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
 *
 * `AdminAuditService` is provided locally (it only depends on Drizzle) so the
 * service can append create (BBR-680) and archive/restore lifecycle (BBR-682)
 * events to the shared `admin_audit_log` — REUSED from the admin shell
 * (PB-ADMIN-001), so no new migration is required.
 */
@Module({
  controllers: [
    ServiceDomainController,
    ServiceDomainAdminController,
    ServiceDomainAdminResourcesController,
  ],
  providers: [ServiceDomainService, AdminAuditService],
  exports: [ServiceDomainService],
})
export class ServiceDomainModule implements OnModuleInit {
  constructor(private readonly service: ServiceDomainService) {}

  onModuleInit() {
    setServiceDomainService(this.service);
  }
}
