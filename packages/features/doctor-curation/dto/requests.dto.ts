/**
 * 명의 큐레이션 (doctor-curation) request DTOs — FR-004 (BBR-538).
 *
 * Request validation is zod-first via `createZodDto`, matching the repo's
 * existing feature pattern (see service-domain/dto, blog/dto). The create
 * payload is validated at the HTTP boundary before it reaches the service.
 *
 * The publish-status and collection-kind vocabularies are REUSED from the
 * schema enums (single source of truth) rather than re-declared here.
 */
import { serviceCollectionKindEnum, servicePublishStatusEnum } from "@repo/drizzle/schema";
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

const slug = z
  .string()
  .min(1, "slug를 입력해주세요.")
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug는 소문자/숫자/하이픈만 사용할 수 있습니다.");

const kindEnum = z.enum(serviceCollectionKindEnum.enumValues);
const statusEnum = z.enum(servicePublishStatusEnum.enumValues);

// ---- collection item (수록 의사) -------------------------------------------

const collectionItemSchema = z.object({
  doctorId: z.string().uuid(),
  /** Editorial ordering within the collection (lower = higher). */
  rank: z.number().int().min(0).default(0),
  /** Public per-entry blurb, e.g. 선정 이유. */
  note: z.string().max(1000).optional(),
});

// ---- create -----------------------------------------------------------------

export const createCollectionSchema = z
  .object({
    // -- public fields -------------------------------------------------------
    name: z.string().min(1, "컬렉션 이름을 입력해주세요.").max(160),
    slug,
    subtitle: z.string().max(240).optional(),
    description: z.string().optional(),
    heroImageUrl: z.string().url().optional(),
    kind: kindEnum.default("editorial"),
    specialtyId: z.string().uuid().optional(),
    regionId: z.string().uuid().optional(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    // -- admin-only fields ---------------------------------------------------
    status: statusEnum.default("draft"),
    internalNotes: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    // -- ordered 수록 의사 (optional, inserted with the collection) ----------
    items: z.array(collectionItemSchema).max(100).optional(),
  })
  // 분야별/지역별 컬렉션은 scope id가 반드시 있어야 한다 (kind ↔ scope 정합).
  .refine((v) => v.kind !== "specialty" || v.specialtyId != null, {
    message: "분야별(specialty) 컬렉션은 specialtyId가 필요합니다.",
    path: ["specialtyId"],
  })
  .refine((v) => v.kind !== "region" || v.regionId != null, {
    message: "지역별(region) 컬렉션은 regionId가 필요합니다.",
    path: ["regionId"],
  });

export class CreateCollectionDto extends createZodDto(createCollectionSchema) {}

// ---- update (admin, partial) — FR-004 (BBR-539) ----------------------------

/**
 * Partial update payload. Every field is optional and only the keys actually
 * present are written (PATCH semantics): an omitted key is left unchanged while
 * an explicit `null` clears a nullable column. `status` is intentionally NOT
 * editable here — status transitions go through the dedicated status action so
 * that only allowed transitions are applied and audited (변경 이력). The
 * kind ↔ scope (specialty/region) consistency is validated in the service
 * against the merged row, since the existing scope may already satisfy it.
 */
export const updateCollectionSchema = z
  .object({
    name: z.string().min(1, "컬렉션 이름을 입력해주세요.").max(160).optional(),
    slug: slug.optional(),
    subtitle: z.string().max(240).nullable().optional(),
    description: z.string().nullable().optional(),
    heroImageUrl: z.string().url().nullable().optional(),
    kind: kindEnum.optional(),
    specialtyId: z.string().uuid().nullable().optional(),
    regionId: z.string().uuid().nullable().optional(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    internalNotes: z.string().nullable().optional(),
    sourceUrl: z.string().url().nullable().optional(),
    /** Optional full replacement of the ordered 수록 의사 list. */
    items: z.array(collectionItemSchema).max(100).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "수정할 필드를 하나 이상 전달해주세요.",
  });

export class UpdateCollectionDto extends createZodDto(updateCollectionSchema) {}

// ---- status change action — FR-004 (BBR-539) -------------------------------

/**
 * Status transition request. The target status must be reachable from the
 * collection's current status (allowed-transition map enforced in the service);
 * an optional reason is recorded in the change history (admin_audit_log).
 */
export const changeStatusSchema = z.object({
  status: statusEnum,
  reason: z.string().max(500).optional(),
});

export class ChangeStatusDto extends createZodDto(changeStatusSchema) {}

// ---- admin list / browse query ---------------------------------------------

export const listCollectionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  kind: kindEnum.optional(),
  status: statusEnum.optional(),
});

export class ListCollectionsQueryDto extends createZodDto(listCollectionsQuerySchema) {}

// ---- public list / search query (FR-004 / BBR-536) -------------------------

/**
 * Public 명의 찾기 browse query. Only published, non-deleted collections are
 * ever returned, so this DTO has no `status`/`includeDeleted` knobs by design —
 * the public filter surface itself is role-separated from the admin one above.
 */
export const publicListCollectionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Facet: 기획(editorial) / 분야별(specialty) / 지역별(region). */
  kind: kindEnum.optional(),
  specialtyId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  /** Home-rail filter: only featured collections. */
  featured: z.coerce.boolean().optional(),
  /** Free-text search over the collection title. */
  q: z.string().trim().min(1).max(120).optional(),
});

export class PublicListCollectionsQueryDto extends createZodDto(publicListCollectionsQuerySchema) {}

// ---- collection change-history query (admin) — FR-004 (BBR-539) ------------

/** Cursor-paginated change history for one collection (admin_audit_log). */
export const collectionHistoryQuerySchema = z.object({
  /** Opaque id cursor: returns rows older than this (DESC). */
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export class CollectionHistoryQueryDto extends createZodDto(collectionHistoryQuerySchema) {}
