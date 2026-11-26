-- Sabotage: a-team-member-starts-at-full-on-organisations
-- Breaks: sql:OWN-01
-- Expect: a team member starts at Own on Partners
-- The Team member role is back at Full on the two organisation pages, as before Landing 55: a member changes
-- every organisation.
update core.role_page_level set level = 'full'
where page_key in ('clients', 'suppliers_partners') and deleted_at is null
  and role_id in (select id from core.role where key = 'member');
