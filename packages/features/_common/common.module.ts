import { Module } from "@nestjs/common";
import {
  AdminAuditController,
  AdminUsersController,
  OrganizationSettingsController,
  SettingsProjectsController,
  UserPreferenceController,
  UserProfileController,
} from "./controller";
import {
  AdminAuditService,
  AdminRoleService,
  AdminUsersService,
  OrganizationSettingsService,
  SessionRevocationService,
  SettingsProjectsService,
  UserPreferenceService,
  UserProfileService,
} from "./service";

@Module({
  controllers: [
    AdminAuditController,
    AdminUsersController,
    OrganizationSettingsController,
    SettingsProjectsController,
    UserPreferenceController,
    UserProfileController,
  ],
  providers: [
    AdminAuditService,
    AdminRoleService,
    AdminUsersService,
    OrganizationSettingsService,
    SessionRevocationService,
    SettingsProjectsService,
    UserPreferenceService,
    UserProfileService,
  ],
})
export class CommonFeatureModule {}
