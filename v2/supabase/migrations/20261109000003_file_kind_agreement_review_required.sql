-- FIX-15 (F162): Kind "Agreement" requires a review date at upload. The prompt exists in FilesSection but is
-- gated on reviewRequired, and no caller passes it — the seed is the root: the Agreement kind's seed row sets
-- review_required = false (only travel_policy is true). This migration flips the flag for Agreement; the frontend
-- (CompanyTabs) reads the live file_kind list so the prompt follows the setting. Forward-only (V103): the seed
-- row itself is not edited. Regression test: FILE-06 (supabase/tests/files/).
update core.file_kind set review_required = true where key = 'agreement';
