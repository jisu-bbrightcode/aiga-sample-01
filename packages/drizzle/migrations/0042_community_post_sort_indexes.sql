CREATE INDEX "idx_posts_status_created_id" ON "community_posts" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_posts_community_status_created_id" ON "community_posts" USING btree ("community_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_posts_community_status_hot_activity_id" ON "community_posts" USING btree ("community_id","status","hot_score","last_activity_at","id");--> statement-breakpoint
CREATE INDEX "idx_posts_community_status_vote_created_id" ON "community_posts" USING btree ("community_id","status","vote_score","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_posts_community_status_activity_comments_id" ON "community_posts" USING btree ("community_id","status","last_activity_at","comment_count","id");--> statement-breakpoint
CREATE INDEX "idx_posts_community_status_controversial_id" ON "community_posts" USING btree ("community_id","status",(LEAST("upvote_count","downvote_count")),"comment_count","id");
