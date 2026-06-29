-- R2-P1 — Aggregate composite FKs for illustration row integrity.
-- These cannot be declared in drizzle schema TS without creating $inferSelect
-- cycles (TS7022/7024) between illustration ⇄ illustration_request ⇄
-- illustration_variant. Emitted as raw ALTERs and snapshot-blind.
--
-- Constraint: illustration.(id, selected_variant_id) must reference
-- (illustration_variant.illustration_id, illustration_variant.id) — i.e. the
-- selected variant must belong to *this* illustration. Same for current_request.
--
-- ON DELETE NO ACTION because the composite includes PK `id` which cannot be
-- SET NULL; the single-column FK declared in TS handles cleanup when the
-- child row is deleted.

ALTER TABLE "illustration" ADD CONSTRAINT "illustration_selected_variant_aggregate_fk" FOREIGN KEY ("id","selected_variant_id") REFERENCES "public"."illustration_variant"("illustration_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "illustration" ADD CONSTRAINT "illustration_current_request_aggregate_fk" FOREIGN KEY ("id","current_request_id") REFERENCES "public"."illustration_request"("illustration_id","id") ON DELETE no action ON UPDATE no action;
