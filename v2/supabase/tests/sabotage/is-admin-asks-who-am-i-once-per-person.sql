-- Sabotage: is-admin-asks-who-am-i-once-per-person
-- Breaks: sql:SPD-02
-- Expect: a hundred rounds of "who is asking, and may they" take under 0.7 s with 300 people on the list
-- authz.is_admin compares every person row with authz.me() again, so it asks "who am I" once per person on the list.
create or replace function authz.is_admin() returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return coalesce((select r.is_admin from core.person p join core.role r on r.id = p.role_id
                   where p.id::text || '' = authz.me()::text), false);
end
$$;
