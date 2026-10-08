-- Sabotage: a-later-lost-takes-the-submission-out
-- Breaks: sql:PIPE-06
-- Expect: each on the day it reached Submitted
-- A tender lost after it was submitted drops out of the tenders submitted (TECH-SPEC 3.7a).
create or replace function measure.pipeline_reached_items(p_kind text, p_meaning text, p_params jsonb, p_scope_kind text,
                                               p_scope_id uuid, p_from date, p_to date) returns setof measure.item
language sql stable security definer set search_path = ''
as $$
  select x.card_table, x.card_id, x.card_owner, x.reached, true
  from (select c.card_table, c.card_id, c.card_owner,
               measure.pipeline_reached_on(c.card_table, c.card_id, p_meaning) as reached
        from measure.pipeline_cards(p_kind, p_params, p_scope_kind, p_scope_id) c) x
  where x.reached between p_from and p_to
    and not exists (select 1 from pipeline.tender t join pipeline.stage s on s.id = t.stage_id
                    where t.id = x.card_id and s.meaning in ('lost', 'cancelled'))
  order by x.reached, x.card_id
$$;
