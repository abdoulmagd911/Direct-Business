-- Sabotage: a-viewer-starts-at-full-on-finance
-- Breaks: sql:FIX03-02
-- Expect: a viewer is refused a change on Finance
-- The Viewer role is raised to Full on Finance with everyone else: the view-only role edits.
update core.role_page_level set level = 'full'
where page_key in ('finance', 'partner_finance') and deleted_at is null
  and role_id in (select id from core.role where key = 'viewer');
