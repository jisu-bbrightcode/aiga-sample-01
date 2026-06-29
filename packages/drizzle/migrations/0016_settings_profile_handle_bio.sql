-- Settings redesign Phase 1: profiles.handle / profiles.bio
--
-- handle is a global-unique URL/mention identifier; nullable until the
-- user picks one. bio is freeform self-introduction.
--
-- Note: drizzle-kit's auto-diff against the stale snapshot also
-- proposed touching payment tables that were
-- already migrated in 0013/0014/0015 of the main branch. Those ALTERs
-- have been removed here — only the profiles change is in this
-- migration. The snapshot file is regenerated to match this scope.
ALTER TABLE "profiles" ADD COLUMN "handle" text;
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "bio" text;
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_handle_unique" UNIQUE("handle");
