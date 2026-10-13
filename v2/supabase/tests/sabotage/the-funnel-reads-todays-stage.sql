-- Sabotage: the-funnel-reads-todays-stage
-- Breaks: sql:PIPE-06
-- Expect: as of D-26: T2 not yet submitted, T1 and T3 were
-- The funnel shows where the cards stand today whatever day it is asked for (TECH-SPEC 3.7a: as of a date).
create or replace function measure.pipeline_by_stage(p_kind text, p_params jsonb, p_scope_kind text, p_scope_id uuid, p_day date)
  returns table (stage_id uuid, stage_key text, meaning text, name_en text, name_ar text, optional boolean, sort int,
                 n int, value numeric)
language sql stable security definer set search_path = ''
as $$
  with standing as (
    select c.card_id, c.card_value, c.card_awarded, st.stage_id
    from measure.pipeline_cards(p_kind, p_params, p_scope_kind, p_scope_id) c
    cross join lateral measure.pipeline_stage_on(c.card_table, c.card_id, core.riyadh_today()) st)
  select s.id, s.key, s.meaning, s.name_en, s.name_ar, s.optional, s.sort, pg_catalog.count(a.card_id)::int,
         coalesce(pg_catalog.sum(case when s.meaning in ('awarded', 'signed') then coalesce(a.card_awarded, a.card_value)
                                      else a.card_value end), 0)
  from pipeline.stage s left join standing a on a.stage_id = s.id
  where s.kind = p_kind and s.deleted_at is null
  group by s.id
  having s.active or pg_catalog.count(a.card_id) > 0
  order by s.sort, s.key
$$;
