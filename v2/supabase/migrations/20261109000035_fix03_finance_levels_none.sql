-- FIX-03 (F179, P2): Members and Viewers hold no level on Finance. The registry sync writes role starting levels
-- only where none exist, so changing the finance module's defaults (20261109043213, the sync this landing ran) does
-- not move the rows already seeded; this migration moves them: core.role_page_level for the finance page, member and
-- viewer, to 'none'. Person-level overrides are deliberate admin choices and are left alone. Forward-only (V103).
-- Regression test: REG-01 (the database built from zero agrees with supabase/registry.json) and FIN-01 (finance
-- tests that assert a member's finance level — see the build note).
update core.role_page_level set level = 'none'
where page_key = 'finance' and deleted_at is null
  and role_id in (select id from core.role where key in ('member', 'viewer'))
  and level <> 'none';
