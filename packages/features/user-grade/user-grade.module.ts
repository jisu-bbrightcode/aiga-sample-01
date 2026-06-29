import { Module, type OnModuleInit } from "@nestjs/common";
import { UserGradeAdminController } from "./controller";
import { UserGradeService } from "./service";
import { setUserGradeService } from "./service-registry";

/**
 * FR-001 사용자 — user-grade REST API (PB-FEAT-FR001-API-CREATE / BBR-528).
 *
 * Capability: `domain.feature.fr-001.api.create`. Admin-gated grade assignment
 * (POST) + read-back (GET detail/list) over the FR-001 DATA model. Identity
 * creation (social login) is REUSED from core better-auth and is not owned here.
 */
@Module({
  controllers: [UserGradeAdminController],
  providers: [UserGradeService],
  exports: [UserGradeService],
})
export class UserGradeModule implements OnModuleInit {
  constructor(private readonly service: UserGradeService) {}

  onModuleInit() {
    setUserGradeService(this.service);
  }
}
