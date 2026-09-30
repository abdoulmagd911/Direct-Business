-- Sabotage: a-reset-logged-as-a-generate
-- Breaks: sql:SIGN-10
-- Expect: logged as the admin's Reset
-- A Reset is logged as a Generate (ACC-029, V451): the log cannot tell a replaced password from a first one.
create or replace function core.person_password_set(p_person uuid, p_reason text, p_replace boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
  users uuid[];
  req uuid;
  n int;
begin
  if p_reason is null or pg_catalog.btrim(p_reason) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if not exists (select 1 from core.person p where p.id = p_person and p.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select pg_catalog.array_agg(a.auth_user_id order by a.email) into users
  from core.person_auth a
  where a.person_id = p_person
    and exists (select 1 from core.person_email e where e.person_id = a.person_id
                and e.email operator(extensions.=) a.email and e.deleted_at is null);
  if users is null then
    raise exception using errcode = 'P0001', message = 'person_password.no_sign_in';
  end if;
  if not coalesce(p_replace, false) and core.has_password(p_person) then
    raise exception using errcode = 'P0001', message = 'person_password.has_one';
  end if;
  req := audit.begin('ui', case when false then 'person_auth.password_reset'
                               else 'person_auth.password_generated' end, null, p_reason);
  update core.person_auth set must_change_password = true, password_set_at = core.clock(), password_set_by = me
  where auth_user_id = any (users);
  n := core.end_devices(p_person, null, null, 'admin', me);
  perform audit.end();
  return pg_catalog.jsonb_build_object('person_id', p_person, 'auth_user_ids', pg_catalog.to_jsonb(users),
                                       'signed_out', n, 'request_id', req);
end
$$;
