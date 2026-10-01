-- Sabotage: the-admin-account-counts-as-a-team-member
-- Breaks: sql:ACCT-01
-- Expect: the admin account is no team member
-- Team membership forgets the account (V444): the owner's admin account counts in team lists, KPIs and leaderboards.
create or replace function core.is_team_member(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from core.person p
                 where p.id = p_person and p.kind = 'staff' and p.deleted_at is null)
$$;
