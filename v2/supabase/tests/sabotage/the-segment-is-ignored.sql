-- Sabotage: the-segment-is-ignored
-- Breaks: sql:PIPE-06
-- Expect: the government segment
-- The tender measures count every segment whichever one is asked for (V64).
create or replace function measure.pipeline_cards(p_kind text, p_params jsonb, p_scope_kind text, p_scope_id uuid)
  returns table (card_table text, card_id uuid, card_owner uuid, card_value numeric, card_awarded numeric,
                 card_awarded_on date)
language plpgsql stable security definer set search_path = ''
as $$
declare
  seg uuid := measure.segment_id(p_params);
begin
  perform measure.check_scope(p_scope_kind);
  if p_kind = 'tender' then
    return query
    select 'pipeline.tender'::text, t.id, t.owner_id, t.value_sar::numeric, t.awarded_value_sar::numeric, t.awarded_on
    from pipeline.tender t
    join core.person p on p.id = t.owner_id
    left join work.project pr on pr.id = t.project_id
    where t.deleted_at is null
      and measure.in_scope(p_scope_kind, p_scope_id, t.owner_id, p.team_id, t.department_id, t.partner_id);
  elsif p_kind = 'partnership' then
    return query
    select 'pipeline.opportunity'::text, o.id, o.owner_id, o.expected_value_sar::numeric, null::numeric, null::date
    from pipeline.opportunity o
    join core.person p on p.id = o.owner_id
    where o.deleted_at is null
      and measure.in_scope(p_scope_kind, p_scope_id, o.owner_id, p.team_id, o.department_id, o.partner_id)
      and (seg is null or case when o.side = 'client' then o.type_id
                               else measure.client_segment(o.partner_id) end = seg);
  else
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = p_kind;
  end if;
end
$$;
