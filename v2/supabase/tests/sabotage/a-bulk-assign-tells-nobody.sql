-- Sabotage: a-bulk-assign-tells-nobody
-- Breaks: sql:PIPE-05
-- Expect: one request, a notice per card
-- A bulk assign gives the cards away and tells the new owner of none of them (V456, V472).
create or replace function pipeline.bulk_assign(p_entity text, p_ids uuid[], p_owner uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  tbl text := case p_entity when 'tender' then 'pipeline.tender' when 'opportunity' then 'pipeline.opportunity' end;
  i uuid;
  req uuid;
  k int := 0;
  changed boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if tbl is null then
    raise exception using errcode = 'P0001', message = 'pipeline.unknown_board', detail = p_entity;
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if p_owner is null then
    raise exception using errcode = 'P0001', message = 'pipeline.owner_required';
  end if;
  perform authz.require_capability('pipeline.assign');
  foreach i in array p_ids loop
    if pipeline.row_level(tbl, i, me) < 'view' then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
  end loop;
  req := audit.begin('ui', case p_entity when 'tender' then 'tender.assigned' else 'opportunity.assigned' end,
                     pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  foreach i in array p_ids loop
    execute pg_catalog.format('update %s set owner_id = $1 where id = $2 and deleted_at is null and owner_id <> $1',
                              tbl::regclass) using p_owner, i;
    get diagnostics changed = row_count;
    if changed then
      k := k + 1;
    end if;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;
