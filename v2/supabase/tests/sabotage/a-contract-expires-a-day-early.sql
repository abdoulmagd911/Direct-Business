-- Sabotage: a-contract-expires-a-day-early
-- Breaks: sql:CTR-01
-- Expect: its last day: Expires in 0 days
-- A contract counts as expired on its own last day.
create or replace function partner.contract_state(p_start date, p_end date, p_on date default null) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'status', case when p_start > x.d then 'not_started'
                   when p_end <= x.d then 'expired'
                   when p_end - x.d <= coalesce((core.setting_at('partner.contract_expiring_from_days', null, x.d) #>> '{}')::int, 30)
                     then 'expiring'
                   else 'active' end,
    'days_left', p_end - x.d)
  from (select coalesce(p_on, core.riyadh_today()) as d) x
$$;
