import { Injectable } from "@nestjs/common";
import { createLogger } from "@repo/core/logger";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { onboardingUserOnboarding } from "@repo/drizzle/schema";
import { eq } from "drizzle-orm";
import type { UpdateStepDto } from "../dto";

const logger = createLogger("onboarding");

@Injectable()
export class OnboardingService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async getStatus(userId: string) {
    const [record] = await this.db
      .select()
      .from(onboardingUserOnboarding)
      .where(eq(onboardingUserOnboarding.userId, userId))
      .limit(1);

    return record ?? null;
  }

  async updateStep(userId: string, data: UpdateStepDto) {
    const existing = await this.getStatus(userId);

    if (existing) {
      const [updated] = await this.db
        .update(onboardingUserOnboarding)
        .set({ currentStep: data.currentStep })
        .where(eq(onboardingUserOnboarding.userId, userId))
        .returning();

      logger.info("Onboarding step updated", {
        "onboarding.user_id": userId,
        "onboarding.current_step": data.currentStep,
      });

      return updated;
    }

    // Upsert: create if not exists
    const [created] = await this.db
      .insert(onboardingUserOnboarding)
      .values({
        userId,
        currentStep: data.currentStep,
      })
      .returning();

    logger.info("Onboarding record created", {
      "onboarding.user_id": userId,
      "onboarding.current_step": data.currentStep,
    });

    return created;
  }

  async complete(userId: string) {
    const existing = await this.getStatus(userId);

    if (!existing) {
      // Auto-create and complete
      const [created] = await this.db
        .insert(onboardingUserOnboarding)
        .values({
          userId,
          currentStep: 4,
          completedAt: new Date(),
        })
        .returning();

      logger.info("Onboarding completed (auto-created)", {
        "onboarding.user_id": userId,
      });

      return created;
    }

    const [updated] = await this.db
      .update(onboardingUserOnboarding)
      .set({ completedAt: new Date(), currentStep: 4 })
      .where(eq(onboardingUserOnboarding.userId, userId))
      .returning();

    logger.info("Onboarding completed", {
      "onboarding.user_id": userId,
    });

    return updated;
  }
}
