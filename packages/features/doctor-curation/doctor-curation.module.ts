import { Module, type OnModuleInit } from "@nestjs/common";
import { DoctorCurationAdminController } from "./controller";
import { DoctorCurationService } from "./service";
import { setDoctorCurationService } from "./service-registry";

/**
 * 명의 큐레이션 REST API (FR-004 / BBR-538).
 *
 * Capability: `domain.feature.fr-004.api.create` — the editorial 명의 컬렉션
 * create + admin read-back API on top of the PB-FEAT-004 curation data model.
 * The public 명의 browse/filter/sort is REUSED from the PB-DATA-001 hub.
 */
@Module({
  controllers: [DoctorCurationAdminController],
  providers: [DoctorCurationService],
  exports: [DoctorCurationService],
})
export class DoctorCurationModule implements OnModuleInit {
  constructor(private readonly service: DoctorCurationService) {}

  onModuleInit() {
    setDoctorCurationService(this.service);
  }
}
