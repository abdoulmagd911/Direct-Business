-- FIX-18 (F202): the /activity Changes list renders bare pills because the read never carries the values. The
-- timeline's chips are built from each change's before/after, but audit.activity's changes objects hold only
-- entity, id, action and fields — no before, no after — so every pill renders its label with nothing after it,
-- while the record timelines (which read record_history, with before/after) show the values. This redefines
-- audit.activity (the 20260929062000 version, whole) to carry 'before' and 'after' on each change. No signature
-- change; the values are of a record the reader may already see (the change row passed the same can_see_as
-- check), so no visibility rule changes. The timeline also drops a pill that still has no value (D23). Forward-only
-- (V103): nothing already on v2/main is edited here. Regression test: HIST-02 (supabase/tests/undo/).
create or replace function audit.activity(p_actor uuid default null, p_entity text default null,
                                          p_since timestamptz default null, p_before timestamptz default null,
                                          p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('activity', 'view');
  tbl text;
begin
  if p_entity is not null then
    select e.table_name into tbl from core.entity e where e.key = p_entity;
    if tbl is null then
      raise exception using errcode = 'P0002', message = 'history.unknown_entity', detail = p_entity;
    end if;
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(r order by (r ->> 'at')::timestamptz desc, r ->> 'request_id')
    from (
      select pg_catalog.jsonb_build_object(
               'request_id', q.id, 'at', q.at, 'happened_on', q.happened_on, 'actor_id', q.actor_id, 'kind', q.kind,
               'label_key', q.label_key, 'label_args', q.label_args, 'reason', q.reason, 'undone_by', q.undone_by,
               'undo_of', q.undo_of,
               'changes', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                    'entity', coalesce(e.key, c.table_name), 'id', c.row_id, 'action', c.action,
                                    'fields', c.fields, 'before', c.before, 'after', c.after) order by c.id)
                           from audit.change c left join core.entity e on e.table_name = c.table_name
                           where c.request_id = q.id and authz.can_see_as(me, c.table_name, c.row_id))) as r
      from audit.request q
      where (p_actor is null or q.actor_id = p_actor)
        and (p_since is null or q.at >= p_since)
        and (p_before is null or q.at < p_before)
        and (tbl is null or exists (select 1 from audit.change c where c.request_id = q.id and c.table_name = tbl))
        and exists (select 1 from audit.change c where c.request_id = q.id
                    and authz.can_see_as(me, c.table_name, c.row_id))
      order by q.at desc, q.id
      limit greatest(1, least(coalesce(p_limit, 50), 500))
    ) page), '[]'::jsonb);
end
$$;
