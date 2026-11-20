-- Sabotage: a-member-starts-with-view-on-finance
-- Breaks: sql:FIX03-02
-- Expect: a member starts with no access to Finance
-- The Team member role is left at View on Finance (the level before Landing 34).
update core.role_page_level set level = 'view'
where page_key in ('finance', 'partner_finance') and deleted_at is null
  and role_id in (select id from core.role where key = 'member');
