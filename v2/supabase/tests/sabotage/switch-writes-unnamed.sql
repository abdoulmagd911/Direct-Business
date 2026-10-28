-- Sabotage: switch-writes-unnamed
-- Breaks: sql:SWITCH-01
-- Expect: a write while switched is logged as the TEST user with the owner named
-- A request while switched does not name who switched.
create or replace function audit.begin(p_kind text default 'ui', p_label_key text default null, p_label_args jsonb default null,
                            p_reason text default null) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  depth int := coalesce(nullif(pg_catalog.current_setting('app.request_depth', true), '')::int, 0);
  r uuid;
  actor uuid;
begin
  if depth > 0 then
    perform pg_catalog.set_config('app.request_depth', (depth + 1)::text, true);
    return nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
  end if;
  actor := case p_kind
             when 'import' then core.import_person_id()
             when 'job' then core.system_person_id()
             when 'system' then core.system_person_id()
             else authz.me()
           end;
  if actor is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person',
      detail = 'This sign-in has no active person behind it.';
  end if;
  -- V656: a write while switched to a TEST user is the TEST user's, naming who switched
  insert into audit.request (actor_id, kind, label_key, label_args, reason, switched_by)
  values (actor, p_kind, p_label_key, p_label_args, p_reason, null)
  returning id into r;
  perform pg_catalog.set_config('app.request_id', r::text, true);
  perform pg_catalog.set_config('app.request_depth', '1', true);
  return r;
end
$$;
