-- Mutant m04-undo-system-request: undo no longer refuses a system or job request
CREATE OR REPLACE FUNCTION audit.undo(p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  q audit.request;
  c audit.change;
  req uuid;
  holder text;
  resync uuid[];
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into q from audit.request where id = p_request for update;
  if q.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if q.kind in ('system', 'job') then
    null;
  end if;
  if q.undone_by is not null then
    raise exception using errcode = 'P0001', message = 'undo.already_undone';
  end if;
  if not exists (select 1 from audit.change x where x.request_id = q.id) then
    raise exception using errcode = 'P0001', message = 'undo.nothing_to_undo';
  end if;
  if not audit.undo_allowed(q, me) then
    raise exception using errcode = '42501', message = 'undo.not_allowed';
  end if;
  req := audit.begin('undo', 'undo.done', pg_catalog.jsonb_build_object('request', q.id, 'label', q.label_key), null);
  begin
    for c in select * from audit.change x where x.request_id = q.id order by x.id desc loop
      perform audit.revert_change(c, q.id, req, me);
    end loop;
  exception when unique_violation then
    get stacked diagnostics holder = pg_exception_detail;
    raise exception using errcode = '23505', message = 'undo.blocked_by_duplicate', detail = holder;
  end;
  perform audit.undo_mark(q, req);
  -- an update logs only the fields it changed, so the person comes from the row itself
  select pg_catalog.array_agg(distinct x.pid) into resync
  from (select coalesce((c2.after ->> 'person_id')::uuid, (c2.before ->> 'person_id')::uuid,
                        (select e.person_id from core.person_email e where e.id = c2.row_id),
                        (select a.person_id from core.person_auth a where a.id = c2.row_id)) as pid
        from audit.change c2 where c2.request_id = q.id and c2.table_name in ('core.person_email', 'core.person_auth')
        union
        select c2.row_id from audit.change c2
        where c2.request_id = q.id and c2.table_name = 'core.person' and c2.fields && array['active', 'can_sign_in', 'kind']) x
  where x.pid is not null;
  perform audit.end();
  return pg_catalog.jsonb_build_object('request_id', req, 'undone', q.id,
                                       'auth_resync', coalesce(pg_catalog.to_jsonb(resync), '[]'::jsonb));
end
$function$
;
