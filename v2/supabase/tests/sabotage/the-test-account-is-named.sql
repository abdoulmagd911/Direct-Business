-- Sabotage: the-test-account-is-named
-- Breaks: sql:PPL-05
-- Expect: the test account owns no organisation
-- The test account is named an owner or mentioned like a team member (V445, V465).
create or replace function core.person_available(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from core.person p
                 where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
                   and (p.left_on is null or p.left_on > core.riyadh_today()))
$$;
