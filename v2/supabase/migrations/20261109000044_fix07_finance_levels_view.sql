-- Landing 7 (F179 overturn, owner decision 10 Nov 2026: "everyone can see what they have access to, and it can
-- be edited in the Settings of the Commercial Workspace"). Finance visibility follows the access each person has —
-- the level on Finance is a setting in Settings › People & access › Access, not a hard-coded refusal. The registry
-- sync writes role starting levels only where none exist, so changing the finance module's defaults (20261109000043,
-- the sync this landing ran) does not move the rows already seeded; this migration moves them: core.role_page_level
-- for the finance page, member and viewer, to 'view' (read-only). Person-level overrides are deliberate admin choices
-- and are left alone — an admin can still set any role or person to 'none' (or 'full') in Settings, and the page,
-- the menu and the figures follow that level. The old F179 refusal set these rows to 'none' (20261109000035); this
-- is its reversal. Forward-only (V103).
-- Regression test: REG-01 (the database built from zero agrees with supabase/registry.json) and FIX03-02 (finance
-- tests that assert a member's and a viewer's finance level — see the build note).
update core.role_page_level set level = 'view'
where page_key = 'finance' and deleted_at is null
  and role_id in (select id from core.role where key in ('member', 'viewer'))
  and level <> 'view';
