-- Sabotage: anyone-saves-a-role
-- Breaks: sql:ROLE-01
-- Expect: a head makes no role
-- The roles door asks only that someone is signed in.
create or replace function core.role_save(p_id uuid, p_key text, p_name_en text, p_name_ar text default null, p_sort int default 0,
                               p_version int default null, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  r core.role;
  v jsonb := pg_catalog.jsonb_build_object('name_en', pg_catalog.btrim(p_name_en), 'name_ar', p_name_ar,
                                           'sort', coalesce(p_sort, 0));
  req uuid;
begin
  if coalesce(pg_catalog.btrim(p_name_en), '') = '' then
    raise exception using errcode = 'P0001', message = 'org.name_required';
  end if;
  if p_id is null then
    req := audit.begin('ui', 'role.saved', null, p_reason);
    insert into core.role (key, name_en, name_ar, sort, is_admin)
    values (p_key, pg_catalog.btrim(p_name_en), p_name_ar, coalesce(p_sort, 0), false) returning * into r;
  else
    select * into r from core.role where id = p_id;
    if r.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if p_key is distinct from r.key then
      raise exception using errcode = 'P0001', message = 'role.key_fixed';
    end if;
    if r.is_admin and not authz.is_admin() then
      raise exception using errcode = '42501', message = 'access.admins_only';
    end if;
    perform core.check_version('core.role', p_id, p_version,
      (select pg_catalog.array_agg(k) from pg_catalog.jsonb_object_keys(v) k
       where (pg_catalog.to_jsonb(r) -> k) is distinct from (v -> k)));
    req := audit.begin('ui', 'role.saved', null, p_reason);
    perform audit.write_fields('core.role', p_id, v);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', r.id, 'version', (select x.version from core.role x where x.id = r.id),
                                       'request_id', req);
exception when unique_violation then
  raise exception using errcode = '23505', message = 'org.code_taken', detail = p_key;
end
$$;
