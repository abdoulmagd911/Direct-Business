-- Sabotage: anyone-follows-anything
-- Breaks: sql:NTF-03
-- Expect: a member cannot follow a record they cannot see
-- Following forgets to ask whether the person may see the record.
create or replace function core.can_see_record(p_entity text, p_id uuid) returns core.entity
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity;
  found boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into e from core.entity where key = p_entity and active;
  if e.id is null then
    raise exception using errcode = 'P0002', message = 'history.unknown_entity', detail = p_entity;
  end if;
  execute pg_catalog.format('select exists (select 1 from %s t where t.id = $1)', pg_catalog.to_regclass(e.table_name))
    into found using p_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return e;
end
$$;
