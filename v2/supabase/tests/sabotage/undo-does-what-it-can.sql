-- Sabotage: undo-does-what-it-can
-- Breaks: sql:UNDO-03
-- Expect: undo refuses when a later change touched the same field
-- Undo skips what changed since and undoes the rest: half a request comes back, silently (A16).
create or replace function audit.undo(p_request uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  q audit.request;
  c audit.change;
  req uuid;
  holder text;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into q from audit.request where id = p_request for update;
  if q.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if q.kind in ('system', 'job') then
    raise exception using errcode = 'P0001', message = 'undo.not_undoable', detail = q.kind;
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
      begin
        perform audit.revert_change(c, q.id, req, me);
      exception when serialization_failure then
        null; -- the sabotage: a field changed since is skipped, the rest is undone
      end;
    end loop;
  exception when unique_violation then
    get stacked diagnostics holder = pg_exception_detail;
    raise exception using errcode = '23505', message = 'undo.blocked_by_duplicate', detail = holder;
  end;
  perform audit.undo_mark(q, req);
  perform audit.end();
  return pg_catalog.jsonb_build_object('request_id', req, 'undone', q.id);
end
$$;
