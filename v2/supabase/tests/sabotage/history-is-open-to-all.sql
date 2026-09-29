-- Sabotage: history-is-open-to-all
-- Breaks: sql:HIST-01
-- Expect: does not see a department's history
-- Record history forgets to ask who is reading: anyone signed in reads any record's changes.
create or replace function audit.record_history(p_entity text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into e from core.entity where key = p_entity and active;
  if e.id is null then
    raise exception using errcode = 'P0002', message = 'history.unknown_entity', detail = p_entity;
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'change_id', c.id, 'request_id', q.id, 'at', c.at, 'actor_id', q.actor_id, 'kind', q.kind,
             'label_key', q.label_key, 'label_args', q.label_args, 'reason', q.reason, 'action', c.action,
             'fields', c.fields, 'before', c.before, 'after', c.after, 'undone', q.undone_by is not null,
             'undo_of', q.undo_of) order by c.id desc)
    from audit.change c join audit.request q on q.id = c.request_id
    where c.table_name = e.table_name and c.row_id = p_id), '[]'::jsonb);
end
$$;
