-- Landing 34 (the owner's test round of 19 Nov, item 5: "Member AND Commercial can see Finance … Members must NOT see
-- Finance"). The Team member role's level on Finance, and on a partner's Finance tab, goes to NONE.
-- History: FIX-03 (20261109000035) refused Finance to members in code; Landing 7 (20261109000044, owner decision of
-- 10 Nov) made the level a setting and started members at View. The level STAYS a setting — an admin may still raise
-- it for the role or for one person in Settings › People & access › Access — only the role's level changes, to what
-- the owner now asks for. The registry sync writes starting levels only where none exist (20261120105626 changed the
-- defaults for a database built from zero), so the rows already there are moved here. Person and team overrides are
-- an admin's own deliberate choices and are left alone (none exists on live today). The Viewer role is not named in
-- the test round and keeps View. Forward-only (V103).
update core.role_page_level set level = 'none'
where page_key in ('finance', 'partner_finance') and deleted_at is null
  and role_id in (select id from core.role where key = 'member')
  and level <> 'none';
