import { Module } from "@nestjs/common";
import {
  AdminAuditController,
  AdminUserInviteController,
  AdminUsersController,
  OrganizationSettingsController,
  SettingsProjectsController,
  UserPreferenceController,
  UserProfileController,
} from "./controller";
import {
  AdminAuditService,
  AdminRoleService,
  AdminUserInviteService,
  AdminUsersService,
  OrganizationSettingsService,
  SettingsProjectsService,
  UserPreferenceService,
  UserProfileService,
} from "./service";

@Module({
  controllers: [
    AdminAuditController,
    AdminUserInviteController,
    AdminUsersController,
    OrganizationSettingsController,
    SettingsProjectsController,
    UserPreferenceController,
    UserProfileController,
  ],
  providers: [
    AdminAuditService,
    AdminRoleService,
    AdminUserInviteService,
    AdminUsersService,
    OrganizationSettingsService,
    SettingsProjectsService,
    UserPreferenceService,
    UserProfileService,
  ],
})
export class CommonFeatureModule {}
