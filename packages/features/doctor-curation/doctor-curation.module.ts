import { Module, type OnModuleInit } from "@nestjs/common";
import { AdminAuditService } from "@repo/features/_common";
import { DoctorCurationAdminController, DoctorCurationController } from "./controller";
import { DoctorCurationService } from "./service";
import { setDoctorCurationService } from "./service-registry";

/**
 * 명의 큐레이션 REST API (FR-004).
 *
 * Capability: `domain.feature.fr-004.api.create` (BBR-538) — editorial 명의 컬렉션
 * create + admin read-back; `domain.feature.fr-004.api.list` (BBR-536) — the
 * public 명의 찾기 browse/search/detail surface; `domain.feature.fr-004.api.update`
 * (BBR-539) — admin 수정/상태 변경 + 변경 이력; and `domain.feature.fr-004.api.delete`
 * (BBR-540) — admin archive / soft-delete / restore lifecycle. All sit on top of the
 * PB-FEAT-004 curation data model. Raw 명의 search/filter/sort is REUSED from the PB-DATA-001 hub.
 *
 * `AdminAuditService` is provided locally (it only depends on Drizzle) to write
 * the change history to the shared `admin_audit_log` table — REUSED from the
 * admin shell (PB-ADMIN-001), so no new migration is needed.
 */
@Module({
  controllers: [DoctorCurationController, DoctorCurationAdminController],
  providers: [DoctorCurationService, AdminAuditService],
  exports: [DoctorCurationService],
})
export class DoctorCurationModule implements OnModuleInit {
  constructor(private readonly service: DoctorCurationService) {}

  onModuleInit() {
    setDoctorCurationService(this.service);
  }
}
