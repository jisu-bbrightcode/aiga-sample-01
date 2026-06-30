-- PB-FEAT-FR003-API-DELETE (BBR-535) — 통합검색 삭제/archive.
-- Adds an admin-owned soft-delete to the search projection so an editor can
-- block a result from public/app/admin search (노출 차단) without hard-deleting
-- the row. Distinct from `is_published` (which mirrors source publish state and
-- is overwritten by the reindex): the reindex never writes these columns, so an
-- archive survives a re-projection and stays restorable. Connected payment/
-- history/audit data keyed off the source `entity_id` is untouched.
-- Idempotent, hand-authored (same approach as 0046/0052/0054).

ALTER TABLE "service_search_documents"
	ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "service_search_documents"
	ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Active (non-archived) public scope — the hot path after soft-delete.
CREATE INDEX IF NOT EXISTS "idx_service_search_documents_active"
	ON "service_search_documents" USING btree ("is_published","entity_type")
	WHERE "is_deleted" = false;
