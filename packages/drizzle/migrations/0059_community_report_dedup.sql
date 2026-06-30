-- PB-COMM-REPORT-API-CREATE-001 (BBR-614) — duplicate report policy.
-- EXTEND of the community report capability. Enforces "one active report per
-- reporter per target" at the DB level: a reporter may hold at most one
-- pending/reviewing report for a given (community, target_type, target_id).
-- Once a report is resolved/dismissed it no longer blocks re-reporting.
-- Hand-authored + idempotent (same approach as 0056/0057) to avoid sweeping
-- unrelated base-snapshot drift; meta snapshots intentionally stop at 0043.

CREATE UNIQUE INDEX IF NOT EXISTS "uq_community_reports_active_dedup" ON "community_reports" USING btree ("reporter_id","community_id","target_type","target_id") WHERE "status" IN ('pending','reviewing');
