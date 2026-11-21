-- Sabotage: a-member-starts-with-none-on-a-partners-finance-tab
-- Breaks: sql:FIX03-02
-- Expect: and on a partner's Finance tab
-- Only the Finance page is raised for the Team member role; a partner's Finance tab is left at None.
update core.role_page_level set level = 'none'
where page_key = 'partner_finance' and deleted_at is null
  and role_id in (select id from core.role where key = 'member');
