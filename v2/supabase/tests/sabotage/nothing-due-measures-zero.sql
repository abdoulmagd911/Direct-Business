-- Sabotage: nothing-due-measures-zero
-- Breaks: sql:MSR-01
-- Expect: nothing due: not measured, never 0
-- An on-time ratio with nothing due answers 0 instead of "not measured" (M60).
create or replace function measure.ratio(p_items measure.item[]) returns measure.result
language sql immutable set search_path = ''
as $$
  select (coalesce(case when pg_catalog.count(*) > 0
               then pg_catalog.round(pg_catalog.count(*) filter (where i.counted)::numeric / pg_catalog.count(*), 4) end, 0),
          true, pg_catalog.count(*)::int)::measure.result
  from pg_catalog.unnest(p_items) i
$$;
