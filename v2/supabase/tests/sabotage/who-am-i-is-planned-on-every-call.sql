-- Sabotage: who-am-i-is-planned-on-every-call
-- Breaks: sql:SPD-02
-- Expect: who is asking is answered from a kept plan: every identity function is plpgsql
-- authz.me is a SQL-language function again: with its pinned search_path Postgres plans it afresh on every call.
create or replace function authz.me() returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(authz.switch_target(x.id), x.id) from (select authz.real_me() as id) x
$$;
