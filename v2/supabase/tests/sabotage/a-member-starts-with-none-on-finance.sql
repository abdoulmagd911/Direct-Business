-- Sabotage: a-member-starts-with-none-on-finance
-- Breaks: sql:FIX03-02
-- Expect: a member starts at Own on Finance
-- The Team member role is put back to None on Finance (the Landing 34 level the owner overruled on 21 Nov 2026).
update core.role_page_level set level = 'none'
where page_key in ('finance', 'partner_finance') and deleted_at is null
  and role_id in (select id from core.role where key = 'member');
