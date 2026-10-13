-- Sabotage: the-money-tiles-show-zero
-- Breaks: sql:FLOW-11
-- Expect: the money tiles are not measured until Finance
-- Before Finance lands the money tiles show 0 instead of not measured (V511, M60).
create or replace function pipeline.overview_waits_for_finance() returns jsonb
language sql immutable set search_path = ''
as $$
  select pg_catalog.jsonb_build_object('value', 0, 'measured', true, 'n', 0, 'last_year', 0,
                                       'last_year_measured', true)
$$;
