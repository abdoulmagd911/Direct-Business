-- Landing 15, Group C (F-B4-04, F-B1-07): the /activity read gains what its label and its What filter need.
--  1. A true total: audit.activity_total counts the requests the reader may see under the same filters as
--     audit.activity (actor, record type(s), since) — no limit, no cursor — so "Show all" names the whole log,
--     not the grouped rows of the page just read (F-B4-04: "Show all (484)" hid the 7 Nov entries).
--  2. Cursor paging that cannot skip a row: audit.activity gains p_before_id, so a page boundary is (at, id) —
--     audit.request.at defaults to now(), so requests written in one transaction share it, and p_before alone
--     would drop the ones standing on the boundary timestamp.
--  3. One What-filter word can cover several record types: audit.activity gains p_entities (several keys at
--     once) — "Achievement" is three entity keys, "Comment" two, "Targets" three (F-B1-07) — so the deduped
--     filter still shows every row the word stands for. p_entity keeps working for a single key.
-- The signatures change (trailing defaults), so the old ones are dropped first: create-or-replace with new
-- parameters would leave the old signature standing as a second overload (precedent: 20261022100000). The
-- function bodies are otherwise as 20261109000004 left them (changes carry before/after). Forward-only (V103).
-- No later migration redefines audit.activity (checked in-tree); the timestamp 20261112000003 is Group C's
-- reserved number. Regression: HIST-01/HIST-03 still call api.activity() positionally and by name.

drop function if exists api.activity(uuid, text, timestamptz, timestamptz, int);
drop function if exists audit.activity(uuid, text, timestamptz, timestamptz, int);

create function audit.activity(p_actor uuid default null, p_entity text default null,
                               p_since timestamptz default null, p_before timestamptz default null,
                               p_limit int default 50, p_entities text[] default null,
                               p_before_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('activity', 'view');
  tbls text[];
begin
  if p_entities is not null and coalesce(array_length(p_entities, 1), 0) > 0 then
    select array_agg(e.table_name order by e.key) into tbls from core.entity e where e.key = any(p_entities);
    if coalesce(array_length(tbls, 1), 0) <> (select count(*)::int from (select distinct k from pg_catalog.unnest(p_entities) k) d) then
      raise exception using errcode = 'P0002', message = 'history.unknown_entity',
        detail = (select k from pg_catalog.unnest(p_entities) k
                  where k not in (select e2.key from core.entity e2) limit 1);
    end if;
  elsif p_entity is not null then
    select array[e.table_name] into tbls from core.entity e where e.key = p_entity;
    if tbls is null then
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
        and (p_before is null or q.at < p_before
             or (p_before_id is not null and q.at = p_before and q.id > p_before_id))
        and (tbls is null or exists (select 1 from audit.change c where c.request_id = q.id
                                     and c.table_name = any(tbls)))
        and exists (select 1 from audit.change c where c.request_id = q.id
                    and authz.can_see_as(me, c.table_name, c.row_id))
      order by q.at desc, q.id
      limit greatest(1, least(coalesce(p_limit, 50), 500))
    ) page), '[]'::jsonb);
end
$$;

-- The whole log's count under the same filters as audit.activity, so the page can say how many requests match
-- before any page is cut: the number "Show all" names (F-B4-04). No cursor and no limit: the total is of every
-- matching request, not of the page just read. A count, never a list: nothing new is disclosed.
create function audit.activity_total(p_actor uuid default null, p_entity text default null,
                                     p_since timestamptz default null, p_entities text[] default null)
returns int
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('activity', 'view');
  tbls text[];
begin
  if p_entities is not null and coalesce(array_length(p_entities, 1), 0) > 0 then
    select array_agg(e.table_name order by e.key) into tbls from core.entity e where e.key = any(p_entities);
    if coalesce(array_length(tbls, 1), 0) <> (select count(*)::int from (select distinct k from pg_catalog.unnest(p_entities) k) d) then
      raise exception using errcode = 'P0002', message = 'history.unknown_entity',
        detail = (select k from pg_catalog.unnest(p_entities) k
                  where k not in (select e2.key from core.entity e2) limit 1);
    end if;
  elsif p_entity is not null then
    select array[e.table_name] into tbls from core.entity e where e.key = p_entity;
    if tbls is null then
      raise exception using errcode = 'P0002', message = 'history.unknown_entity', detail = p_entity;
    end if;
  end if;
  return (select count(*)::int
          from audit.request q
          where (p_actor is null or q.actor_id = p_actor)
            and (p_since is null or q.at >= p_since)
            and (tbls is null or exists (select 1 from audit.change c where c.request_id = q.id
                                         and c.table_name = any(tbls)))
            and exists (select 1 from audit.change c where c.request_id = q.id
                        and authz.can_see_as(me, c.table_name, c.row_id)));
end
$$;

grant execute on function audit.activity(uuid, text, timestamptz, timestamptz, int, text[], uuid),
  audit.activity_total(uuid, text, timestamptz, text[]) to authenticated;

-- The door (V124): the same trailing defaults, so every existing call keeps working.
create function api.activity(p_actor uuid default null, p_entity text default null,
                             p_since timestamptz default null, p_before timestamptz default null,
                             p_limit int default 50, p_entities text[] default null,
                             p_before_id uuid default null) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select audit.activity(p_actor, p_entity, p_since, p_before, p_limit, p_entities, p_before_id) $$;

create function api.activity_total(p_actor uuid default null, p_entity text default null,
                                    p_since timestamptz default null, p_entities text[] default null)
returns int
language sql stable security invoker set search_path = ''
as $$ select audit.activity_total(p_actor, p_entity, p_since, p_entities) $$;

grant execute on function api.activity(uuid, text, timestamptz, timestamptz, int, text[], uuid),
  api.activity_total(uuid, text, timestamptz, text[]) to authenticated;
