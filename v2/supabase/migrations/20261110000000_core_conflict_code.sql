-- L9 · a version conflict (common.conflict) and an undo blocked by a later change (undo.changed_since) were
-- raised as SQLSTATE 40001 — serialization_failure. PostgREST 12.2.3 retries a 40001 failure forever instead
-- of answering it: a conflicted save never got its response, so the conflict dialog never opened, and the
-- function was re-executed in a tight loop (~20–140/s on the pool backend) until the backend was killed. Both
-- refusals are application errors, so they are raised as P0001 now — the code the other application refusals
-- use — with their messages and details unchanged. The app maps them to Conflict by message
-- (src/core/db/errors.ts); the 40001 mapping stays there for a database that has not applied this yet.

-- A write names the version it read. Same version: fine. Someone saved in between: fine when none of the fields this
-- write changes was changed since (the edits merge); else refused, naming the field, who and when (P0001).
create or replace function core.check_version(p_table text, p_id uuid, p_expected int, p_fields text[]) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  cur int;
  hit record;
begin
  if p_expected is null then
    raise exception using errcode = 'P0001', message = 'common.version_required';
  end if;
  execute pg_catalog.format('select t.version from %s t where t.id = $1', pg_catalog.to_regclass(p_table))
    into cur using p_id;
  if cur is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if cur = p_expected then
    return;
  end if;
  select f.field, c.at, q.actor_id into hit
  from audit.change c
  join audit.request q on q.id = c.request_id
  cross join lateral pg_catalog.unnest(c.fields) f(field)
  where c.table_name = p_table and c.row_id = p_id and c.version_after > p_expected and f.field = any (p_fields)
  order by c.id desc
  limit 1;
  if hit.field is not null then
    raise exception using errcode = 'P0001', message = 'common.conflict',
      detail = pg_catalog.jsonb_build_object('field', hit.field, 'by', hit.actor_id, 'at', hit.at,
                                             'version', cur)::text;
  end if;
end
$$;

-- Reverts one change, or refuses — the caller's transaction then takes back everything (all or nothing).
--   update, remove, restore: the fields it changed go back, and only where they still hold what it wrote;
--   insert: the row is soft-removed, unless it changed since (outside this request and this undo);
--   a hard delete (never through the API; a stray one is still logged) is not undone.
create or replace function audit.revert_change(c audit.change, p_request uuid, p_undo uuid, me uuid) returns void
language plpgsql volatile security definer set search_path = '' set timezone = 'UTC'
as $$
declare
  cur jsonb;
  f text;
  since jsonb;
begin
  if c.action = 'delete' then
    raise exception using errcode = 'P0001', message = 'undo.cannot_undo_delete', detail = c.table_name;
  end if;
  execute pg_catalog.format('select pg_catalog.to_jsonb(t) from %s t where t.id = $1', pg_catalog.to_regclass(c.table_name))
    into cur using c.row_id;
  if cur is null then
    raise exception using errcode = 'P0001', message = 'undo.changed_since',
      detail = pg_catalog.jsonb_build_object('entity', c.table_name, 'id', c.row_id)::text;
  end if;
  if c.action in ('update', 'remove', 'restore') then
    foreach f in array c.fields loop
      if (cur -> f) is distinct from (c.after -> f) then
        since := audit.changed_since(c.table_name, c.row_id, c.id, f, array[p_request, p_undo]);
        raise exception using errcode = 'P0001', message = 'undo.changed_since',
          detail = coalesce(since, pg_catalog.jsonb_build_object('entity', c.table_name, 'id', c.row_id, 'field', f))::text;
      end if;
    end loop;
    perform audit.write_fields(c.table_name, c.row_id,
      (select coalesce(pg_catalog.jsonb_object_agg(k, c.before -> k), '{}'::jsonb) from pg_catalog.unnest(c.fields) k));
  elsif c.action = 'insert' then
    if not (cur ? 'deleted_at') then
      raise exception using errcode = 'P0001', message = 'undo.cannot_remove', detail = c.table_name;
    end if;
    since := audit.changed_since(c.table_name, c.row_id, c.id, null, array[p_request, p_undo]);
    if since is not null or cur ->> 'deleted_at' is not null then
      raise exception using errcode = 'P0001', message = 'undo.changed_since',
        detail = coalesce(since, pg_catalog.jsonb_build_object('entity', c.table_name, 'id', c.row_id))::text;
    end if;
    perform audit.write_fields(c.table_name, c.row_id,
      pg_catalog.jsonb_build_object('deleted_at', pg_catalog.now(), 'deleted_by', me, 'delete_reason', 'undo'));
  end if;
end
$$;
