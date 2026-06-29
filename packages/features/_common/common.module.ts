import { Module } from "@nestjs/common";
import {
  AdminUsersController,
  OrganizationSettingsController,
  SettingsProjectsController,
  UserPreferenceController,
  UserProfileController,
} from "./controller";
import {
  AdminUsersService,
  OrganizationSettingsService,
  SettingsProjectsService,
  UserPreferenceService,
  UserProfileService,
} from "./service";

@Module({
  controllers: [
    AdminUsersController,
    OrganizationSettingsController,
    SettingsProjectsController,
    UserPreferenceController,
    UserProfileController,
  ],
  providers: [
    AdminUsersService,
    OrganizationSettingsService,
    SettingsProjectsService,
    UserPreferenceService,
    UserProfileService,
  ],
})
export class CommonFeatureModule {}
