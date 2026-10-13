-- Sabotage: the-board-shows-other-departments
-- Breaks: sql:PIPE-04
-- Expect: another department sees none of them
-- The board shows every department's cards to everyone (V96).
create or replace function pipeline.board(p_entity text, p_filter jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  tbl text := case p_entity when 'tender' then 'pipeline.tender' when 'opportunity' then 'pipeline.opportunity' end;
  v_kind text := case p_entity when 'tender' then 'tender' else 'partnership' end;
  f jsonb := coalesce(p_filter, '{}'::jsonb);
  cards jsonb;
begin
  perform authz.require('pipeline', 'view');
  if tbl is null then
    raise exception using errcode = 'P0001', message = 'pipeline.unknown_board', detail = p_entity;
  end if;
  execute pg_catalog.format($q$
    select coalesce(pg_catalog.jsonb_agg(pipeline.card_row(%1$L, c.id, $1) order by c.number), '[]'::jsonb)
    from %2$s c
    where c.deleted_at is null
      and ($2 ->> 'owner_id' is null or c.owner_id = ($2 ->> 'owner_id')::uuid)
      and ($2 ->> 'partner_id' is null or c.partner_id = ($2 ->> 'partner_id')::uuid)
      and (not coalesce(($2 ->> 'mine')::boolean, false) or $1 in (c.owner_id, c.created_by))
      %3$s$q$, tbl, tbl::regclass,
      case when v_kind = 'partnership' then 'and ($2 ->> ''side'' is null or c.side = $2 ->> ''side'')' else '' end)
    into cards using me, f;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'stage', s.key, 'name_en', s.name_en, 'name_ar', s.name_ar, 'meaning', s.meaning, 'optional', s.optional,
      'count', (select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(cards) c where c ->> 'stage' = s.key),
      'value_sar', (select coalesce(pg_catalog.sum((c ->> 'value_sar')::numeric), 0)
                    from pg_catalog.jsonb_array_elements(cards) c where c ->> 'stage' = s.key),
      'cards', (select coalesce(pg_catalog.jsonb_agg(c), '[]'::jsonb)
                from pg_catalog.jsonb_array_elements(cards) c where c ->> 'stage' = s.key)) order by s.sort, s.key)
    from pipeline.stage s where s.kind = v_kind and s.deleted_at is null and s.active), '[]'::jsonb);
end
$$;
