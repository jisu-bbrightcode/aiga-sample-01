import { Module, type OnModuleInit } from "@nestjs/common";
import { LocalizationController } from "./controller";
import { LocalizationService } from "./service";
import { setLocalizationService } from "./service-registry";

@Module({
  controllers: [LocalizationController],
  providers: [LocalizationService],
  exports: [LocalizationService],
})
export class LocalizationModule implements OnModuleInit {
  constructor(private readonly localizationService: LocalizationService) {}

  onModuleInit() {
    setLocalizationService(this.localizationService);
  }
}
