/**
 * Admin domain resource list DTOs (PB-ADMIN-DOMAIN-API-001 / BBR-761).
 *
 * Mirrors the committed contract
 * `doc/contract/PB-ADMIN-DOMAIN-LIST-001-admin-domain-list-api.md`. The query is
 * zod-validated at the boundary; the response schema is the admin-only list
 * projection — sensitive columns (licenseNumber, internalNotes, sourceUrl,
 * businessRegistrationNo) are intentionally absent.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { ADMIN_DOMAIN_RESOURCE_TYPES, ADMIN_DOMAIN_SORT_KEYS } from "../admin-resources";
import { SERVICE_PUBLISH_STATUSES } from "../status";

// ---- query ------------------------------------------------------------------

export const adminDomainResourceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(ADMIN_DOMAIN_RESOURCE_TYPES).optional(),
  status: z.enum(SERVICE_PUBLISH_STATUSES).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(ADMIN_DOMAIN_SORT_KEYS).default("updatedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
export class AdminDomainResourceQueryDto extends createZodDto(adminDomainResourceQuerySchema) {}

// ---- response ---------------------------------------------------------------

export const adminDomainResourceSchema = z.object({
  id: z.string(),
  type: z.enum(ADMIN_DOMAIN_RESOURCE_TYPES),
  name: z.string(),
  slug: z.string(),
  status: z.enum(SERVICE_PUBLISH_STATUSES),
  regionName: z.string().nullable(),
  specialtyName: z.string().nullable(),
  isFeatured: z.boolean(),
  updatedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export class AdminDomainResourceDto extends createZodDto(adminDomainResourceSchema) {}

export const adminDomainResourceListSchema = z.object({
  items: z.array(adminDomainResourceSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});
export class AdminDomainResourceListDto extends createZodDto(adminDomainResourceListSchema) {}
