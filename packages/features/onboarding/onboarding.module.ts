import { Module, type OnModuleInit } from "@nestjs/common";
import { OnboardingController } from "./controller";
import { OnboardingService } from "./service";
import { setOnboardingService } from "./service-registry";

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule implements OnModuleInit {
  constructor(private readonly onboardingService: OnboardingService) {}

  onModuleInit() {
    setOnboardingService(this.onboardingService);
  }
}
