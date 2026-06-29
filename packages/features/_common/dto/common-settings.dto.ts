import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const successResponseSchema = z.object({
  success: z.boolean(),
});

export class CommonSuccessResponseDto extends createZodDto(successResponseSchema) {}

export const userPreferenceSetSchema = z.object({
  value: z.string(),
});

export class SetUserPreferenceDto extends createZodDto(userPreferenceSetSchema) {}

export const userProfileSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  handle: z.string().nullable(),
  bio: z.string().nullable(),
  avatar: z.string().nullable(),
});

export class UserProfileResponseDto extends createZodDto(userProfileSchema) {}

export const updateNameSchema = z.object({
  name: z.string().min(1).max(100),
});

export class UpdateProfileNameDto extends createZodDto(updateNameSchema) {}

export const uploadUrlRequestSchema = z.object({
  contentType: z.string(),
  fileName: z.string(),
});

export class UploadUrlRequestDto extends createZodDto(uploadUrlRequestSchema) {}

export const uploadUrlResponseSchema = z.object({
  uploadUrl: z.string(),
  publicUrl: z.string(),
});

export class UploadUrlResponseDto extends createZodDto(uploadUrlResponseSchema) {}

export const confirmUploadSchema = z.object({
  publicUrl: z.string().url(),
});

export class ConfirmUploadDto extends createZodDto(confirmUploadSchema) {}

export const handleSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/,
    "lowercase, digits, hyphen; must start/end with alphanumeric",
  )
  .refine(
    (value) =>
      !new Set([
        "admin",
        "api",
        "app",
        "billing",
        "dashboard",
        "help",
        "settings",
        "signin",
        "signup",
        "support",
        "www",
      ]).has(value),
    "reserved",
  );

export const updateHandleSchema = z.object({
  handle: handleSchema,
});

export class UpdateHandleDto extends createZodDto(updateHandleSchema) {}

export const handleAvailabilitySchema = z.object({
  available: z.boolean(),
});

export class HandleAvailabilityResponseDto extends createZodDto(handleAvailabilitySchema) {}

export const updateBioSchema = z.object({
  bio: z.string().max(500),
});

export class UpdateBioDto extends createZodDto(updateBioSchema) {}

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
});

export class UpdateOrganizationSettingsDto extends createZodDto(updateOrganizationSchema) {}

export const organizationMetadataSchema = z.object({
  billingEmail: z.string().nullable(),
});

export class OrganizationMetadataResponseDto extends createZodDto(organizationMetadataSchema) {}

export const updateBillingEmailSchema = z.object({
  billingEmail: z.string().email().nullable(),
});

export class UpdateBillingEmailDto extends createZodDto(updateBillingEmailSchema) {}

export const organizationMembershipSchema = z.object({
  role: z.string(),
});

export class OrganizationMembershipResponseDto extends createZodDto(organizationMembershipSchema) {}

export const organizationMemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  role: z.string(),
  createdAt: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  handle: z.string().nullable(),
  avatar: z.string().nullable(),
});

export class OrganizationMemberDto extends createZodDto(organizationMemberSchema) {}

export const pendingInvitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.string().nullable(),
  status: z.string(),
  expiresAt: z.string(),
  inviterId: z.string(),
  inviterName: z.string().nullable(),
  inviterEmail: z.string().nullable(),
});

export class PendingInvitationDto extends createZodDto(pendingInvitationSchema) {}

export const organizationMembersSchema = z.object({
  members: z.array(organizationMemberSchema),
  pending: z.array(pendingInvitationSchema),
});

export class OrganizationMembersResponseDto extends createZodDto(organizationMembersSchema) {}

export const settingsProjectListFilterSchema = z.enum(["active", "starred", "archived"]);

export const settingsProjectListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  handle: z.string().nullable(),
  description: z.string().nullable(),
  visibility: z.enum(["private", "org", "public"]),
  status: z.enum(["active", "archived", "completed"]),
  archivedAt: z.string().nullable(),
  ownerId: z.string(),
  updatedAt: z.string(),
  lastOpenedAt: z.string().nullable(),
  starred: z.boolean(),
  viewerRole: z.string(),
  memberCount: z.number(),
  storyCount: z.number(),
  languageCount: z.number(),
});

export class SettingsProjectListItemDto extends createZodDto(settingsProjectListItemSchema) {}

export const settingsProjectMemberSchema = z.object({
  userId: z.string(),
  role: z.string(),
  createdAt: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  handle: z.string().nullable(),
  avatar: z.string().nullable(),
});

export class SettingsProjectMemberDto extends createZodDto(settingsProjectMemberSchema) {}

export const settingsProjectTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
});

export class SettingsProjectTagDto extends createZodDto(settingsProjectTagSchema) {}

export const settingsProjectLanguageSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  isSource: z.boolean(),
  progress: z.number(),
});

export class SettingsProjectLanguageDto extends createZodDto(settingsProjectLanguageSchema) {}

export const settingsProjectDetailSchema = settingsProjectListItemSchema.extend({
  template: z.string().nullable(),
  organizationId: z.string().nullable(),
  genre: z.string().nullable(),
  aiMode: z.enum(["ai_powered", "ai_safety"]),
  coverImage: z.string().nullable(),
  createdAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
  members: z.array(settingsProjectMemberSchema),
  tags: z.array(settingsProjectTagSchema),
  languages: z.array(settingsProjectLanguageSchema),
});

export class SettingsProjectDetailDto extends createZodDto(settingsProjectDetailSchema) {}
