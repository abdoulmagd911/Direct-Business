-- Sabotage: a-sign-in-never-clears-the-count
-- Breaks: sql:LOCK-01
-- Expect: a wrong password after a sign-in is the first of a new count
-- A successful sign-in does not start the count again: old wrong passwords lock a person who got in.
create or replace function core.sign_in_limited(p_email text) returns text
language sql stable security definer set search_path = ''
as $$
  with since as (
    select greatest(
      core.clock() - interval '30 minutes',
      (select pg_catalog.max(a.password_set_at) from core.person_auth a
       where a.email operator(extensions.=) p_email::extensions.citext),
      (select pg_catalog.max(o.at) from core.sign_in_log o
       where o.email operator(extensions.=) p_email::extensions.citext and o.result = 'never'
         and o.at > core.clock() - interval '30 minutes')) as t),
  recent as (
    select l.at, l.result
    from core.sign_in_log l, since s
    where l.email operator(extensions.=) p_email::extensions.citext and l.at > s.t
      and l.result not in ('ok', 'signed_out')),
  tries as (select r.at from recent r where r.result = 'wrong_password' order by r.at desc limit 5)
  select case
    when (select pg_catalog.count(*) from tries) = 5
         and (select pg_catalog.max(t.at) - pg_catalog.min(t.at) from tries t) <= interval '15 minutes'
         and core.clock() < (select pg_catalog.max(t.at) from tries t) + interval '15 minutes' then 'locked'
    when (select pg_catalog.count(*) from recent r where r.at > core.clock() - interval '15 minutes') >= 20
      then 'rate_limited'
  end
$$;
