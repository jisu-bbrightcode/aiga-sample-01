import { z } from "zod";

export const resolveReportSchema = z.object({
  reportId: z.string().uuid().describe("신고 ID"),
  action: z.enum(["removed", "banned", "warned", "dismissed"]).describe("처리 조치"),
  reason: z.string().max(1000).optional().describe("처리 사유"),
});

export type ResolveReportDto = z.infer<typeof resolveReportSchema>;

export const banUserSchema = z.object({
  communityId: z.string().uuid().describe("커뮤니티 ID"),
  userId: z.string().uuid().describe("사용자 ID"),
  reason: z.string().min(1).max(1000).describe("밴 사유"),
  note: z.string().max(1000).optional().describe("모더레이터 메모"),
  isPermanent: z.boolean().default(true).describe("영구 밴 여부"),
  durationDays: z.number().int().min(1).optional().describe("밴 기간 (일)"),
});

export type BanUserDto = z.infer<typeof banUserSchema>;

export const createRuleSchema = z.object({
  communityId: z.string().uuid().describe("커뮤니티 ID"),
  title: z.string().min(1).max(100).describe("규칙 제목"),
  description: z.string().min(1).max(500).describe("규칙 설명"),
  appliesTo: z.enum(["posts", "comments", "both"]).default("both").describe("적용 대상"),
  violationAction: z.enum(["flag", "remove", "warn"]).optional().describe("위반 시 자동 조치"),
});

export type CreateRuleDto = z.infer<typeof createRuleSchema>;

// 규칙 수정(PB-COMM-RULES-FLAIR-API-001 / AC#2): 모든 필드 선택적(부분 수정).
export const updateRuleSchema = z.object({
  title: z.string().min(1).max(100).optional().describe("규칙 제목"),
  description: z.string().min(1).max(500).optional().describe("규칙 설명"),
  appliesTo: z.enum(["posts", "comments", "both"]).optional().describe("적용 대상"),
  violationAction: z.enum(["flag", "remove", "warn"]).optional().describe("위반 시 자동 조치"),
  displayOrder: z.number().int().min(0).optional().describe("표시 순서"),
});

export type UpdateRuleDto = z.infer<typeof updateRuleSchema>;

export const createFlairSchema = z.object({
  communityId: z.string().uuid().describe("커뮤니티 ID"),
  type: z.enum(["post", "user"]).describe("플레어 유형"),
  text: z.string().min(1).max(50).describe("플레어 텍스트"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#ffffff")
    .describe("텍스트 색상"),
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default("#0079d3")
    .describe("배경 색상"),
  modOnly: z.boolean().default(false).describe("모더레이터 전용"),
});

export type CreateFlairDto = z.infer<typeof createFlairSchema>;

// 플레어 수정(PB-COMM-RULES-FLAIR-API-001 / AC#2): 모든 필드 선택적.
export const updateFlairSchema = z.object({
  text: z.string().min(1).max(50).optional().describe("플레어 텍스트"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .describe("텍스트 색상"),
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .describe("배경 색상"),
  modOnly: z.boolean().optional().describe("모더레이터 전용"),
  displayOrder: z.number().int().min(0).optional().describe("표시 순서"),
});

export type UpdateFlairDto = z.infer<typeof updateFlairSchema>;

// 금칙어 목록 설정(PB-COMM-RULES-FLAIR-API-001 / AC#2).
export const setBannedWordsSchema = z.object({
  words: z.array(z.string().max(100)).max(500).describe("금칙어 목록"),
});

export type SetBannedWordsDto = z.infer<typeof setBannedWordsSchema>;

export const inviteModeratorSchema = z.object({
  communityId: z.string().uuid().describe("커뮤니티 ID"),
  userId: z.string().uuid().describe("사용자 ID"),
  permissions: z
    .object({
      managePosts: z.boolean().default(true),
      manageComments: z.boolean().default(true),
      manageUsers: z.boolean().default(true),
      manageFlairs: z.boolean().default(false),
      manageRules: z.boolean().default(false),
      manageSettings: z.boolean().default(false),
      manageModerators: z.boolean().default(false),
      viewModLog: z.boolean().default(true),
      viewReports: z.boolean().default(true),
    })
    .describe("모더레이터 권한"),
});

export type InviteModeratorDto = z.infer<typeof inviteModeratorSchema>;

export const respondModeratorInviteSchema = z.object({
  communityId: z.string().uuid().describe("커뮤니티 ID"),
  accept: z.boolean().describe("초대 수락 여부 (true=수락, false=거절)"),
});

export type RespondModeratorInviteDto = z.infer<typeof respondModeratorInviteSchema>;

const moderatorPermissionsPatchSchema = z
  .object({
    managePosts: z.boolean(),
    manageComments: z.boolean(),
    manageUsers: z.boolean(),
    manageFlairs: z.boolean(),
    manageRules: z.boolean(),
    manageSettings: z.boolean(),
    manageModerators: z.boolean(),
    viewModLog: z.boolean(),
    viewReports: z.boolean(),
  })
  .partial();

export const updateModeratorPermissionsSchema = z.object({
  communityId: z.string().uuid().describe("커뮤니티 ID"),
  userId: z.string().uuid().describe("대상 모더레이터 사용자 ID"),
  permissions: moderatorPermissionsPatchSchema.describe("변경할 권한 (부분 지정 가능)"),
});

export type UpdateModeratorPermissionsDto = z.infer<typeof updateModeratorPermissionsSchema>;

export const transferOwnershipSchema = z.object({
  communityId: z.string().uuid().describe("커뮤니티 ID"),
  newOwnerId: z.string().uuid().describe("새 소유자 사용자 ID"),
});

export type TransferOwnershipDto = z.infer<typeof transferOwnershipSchema>;
