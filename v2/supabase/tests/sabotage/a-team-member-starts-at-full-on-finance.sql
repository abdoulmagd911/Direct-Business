-- Sabotage: a-team-member-starts-at-full-on-finance
-- Breaks: sql:OWN-02
-- Expect: a team member starts at Own on Finance
-- The Team member role is back at Full on Finance, as before Landing 56: a member changes every entry.
update core.role_page_level set level = 'full'
where page_key in ('finance', 'partner_finance') and deleted_at is null
  and role_id in (select id from core.role where key = 'member');
