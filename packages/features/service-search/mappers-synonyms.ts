import type { ServiceSearchSynonym } from "@repo/drizzle/schema";

/**
 * Synonyms are admin-only resources (every column lives behind the admin gate),
 * so there is a single mapper. Timestamps are serialized to ISO strings to
 * match the rest of the REST contract.
 */
export function toSynonym(row: ServiceSearchSynonym) {
  return {
    id: row.id,
    term: row.term,
    expansions: row.expansions,
    specialtyId: row.specialtyId ?? null,
    isActive: row.isActive,
    notes: row.notes ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export type SynonymView = ReturnType<typeof toSynonym>;
