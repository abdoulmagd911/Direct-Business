-- Sabotage: submitted-counts-only-the-stage-entered
-- Breaks: sql:PIPE-06
-- Expect: four tenders reached Submitted in the period
-- A tender that jumped past Submitted is not counted as submitted (V99: a passed stage is reached).
create or replace function measure.pipeline_reached_on(p_table text, p_id uuid, p_meaning text) returns date
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.min(c.happened_on)
  from pipeline.stage_change c join pipeline.stage s on s.id = c.to_stage_id
  where c.entity_table = p_table and c.entity_id = p_id and c.deleted_at is null and s.meaning = p_meaning and not c.passed
$$;
