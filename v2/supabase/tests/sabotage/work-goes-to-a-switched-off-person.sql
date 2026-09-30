-- Sabotage: work-goes-to-a-switched-off-person
-- Breaks: sql:AVAIL-01
-- Expect: a switched-off person is made no owner
-- Owners and mentions forget the sign-in switch (WRK-092): work lands on someone who can no longer sign in.
create or replace function core.person_available(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from core.person p
                 where p.id = p_person and p.kind = 'staff' and p.active and p.deleted_at is null
                   and (p.left_on is null or p.left_on > core.riyadh_today()))
$$;
