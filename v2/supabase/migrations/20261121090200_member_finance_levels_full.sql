-- Landing 34b (the owner, 21 Nov: "I want everyone to see Finance and everyone to add and edit it — members,
-- Commercial, managers, Admins, the whole team. Only the view-only roles see it but cannot edit it. … The old rule
-- that hides Finance from members was wrong."). The Team member role's level on Finance, and on a partner's Finance
-- tab, goes to FULL — the level Heads, Managers and Admins already have. The Viewer role keeps View (sees, cannot
-- edit). This overrules 20261120110000 (Landing 34, item 5), which set the role to None; that file is not edited
-- (V103, forward-only). The level STAYS a setting an admin may change for the role or for one person in
-- Settings › People & access › Access. Only the role's own row is moved, and only where it still reads None or View
-- (what the earlier migrations wrote); person and team overrides are an admin's own choices and are left alone.
update core.role_page_level set level = 'full'
where page_key in ('finance', 'partner_finance') and deleted_at is null
  and role_id in (select id from core.role where key = 'member')
  and level in ('none', 'view');
