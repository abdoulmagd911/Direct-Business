-- P3-2g · sign-in gaps from the oversight's scenario catalogue (15:55): ACC-021, ACC-029, ACC-093.

-- ================================================================ a person's own new password (ACC-021)
-- When a person sets their own password — the first one after a generate, or My profile → Change password — the
-- server records it (service role only; the browser never clears its own flag) and, in the same logged request, signs
-- every other device of theirs out, as their own sign-out (those devices read "signed out elsewhere"): the device that
-- changed it stays signed in. `p_keep_session` is that device's Supabase session (the access token's session_id);
-- with none found, every device is signed out.
create function core.own_password_set(p_auth_user uuid, p_keep_session uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  a core.person_auth;
  keep uuid;
  req uuid;
  n int;
begin
  select * into a from core.person_auth where auth_user_id = p_auth_user;
  if a.id is null or core.sign_in_state(a.email::text) <> 'allowed' then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select d.id into keep from core.device_session d
  where d.auth_session_id = p_keep_session and d.person_id = a.person_id and d.signed_out_at is null;
  req := audit.begin_for(a.person_id, 'person_auth.password_changed', pg_catalog.jsonb_build_object('email', a.email));
  update core.person_auth set must_change_password = false, password_set_at = core.clock(), password_set_by = a.person_id
  where id = a.id;
  n := core.end_devices(a.person_id, null, keep, 'person', a.person_id);
  perform audit.end();
  return pg_catalog.jsonb_build_object('person_id', a.person_id, 'signed_out', n, 'request_id', req);
end
$$;

-- ================================================================ Generate and Reset, logged apart (ACC-029, V451)
-- Generate gives a password to someone who holds none; Reset — the admin's explicit, confirmed action — replaces one.
-- Each is its own entry in the log.
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
  req := audit.begin('ui', case when coalesce(p_replace, false) then 'person_auth.password_reset'
                               else 'person_auth.password_generated' end, null, p_reason);
  update core.person_auth set must_change_password = true, password_set_at = core.clock(), password_set_by = me
  where auth_user_id = any (users);
  n := core.end_devices(p_person, null, null, 'admin', me);
  perform audit.end();
  return pg_catalog.jsonb_build_object('person_id', p_person, 'auth_user_ids', pg_catalog.to_jsonb(users),
                                       'signed_out', n, 'request_id', req);
end
$$;

-- ================================================================ a person and their e-mail, one request (ACC-093)
-- Settings → People → Add: the person, their allowed e-mail (`email`), role and sign-in switch are one request — one
-- entry in the log, one Undo. The server then links the e-mail's auth user (/auth/admin/people).
create or replace function core.person_create(p_person jsonb, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.org', 'full');
  pv jsonb;
  pid uuid;
  req uuid;
begin
  pv := core.person_fields(p_person - array['role_id', 'can_sign_in', 'email']);
  if not (pv ? 'full_name_en') then
    raise exception using errcode = 'P0001', message = 'person.full_name_required';
  end if;
  if not (pv ? 'department_id') then
    raise exception using errcode = 'P0001', message = 'person.department_required';
  end if;
  req := audit.begin('ui', 'person.created', null, p_reason);
  insert into core.person (full_name_en, full_name_ar, nickname_en, nickname_ar, job_title_en, job_title_ar,
                           department_id, team_id, manager_id, joined_on, left_on)
  select pg_catalog.btrim(x.full_name_en), x.full_name_ar, x.nickname_en, x.nickname_ar, x.job_title_en,
         x.job_title_ar, x.department_id, x.team_id, x.manager_id, x.joined_on, x.left_on
  from pg_catalog.jsonb_populate_record(null::core.person, pv) x
  returning id into pid;
  -- the allowed e-mail in the same request (ACC-093): one entry in the log, one Undo
  if coalesce(pg_catalog.btrim(p_person ->> 'email'), '') <> '' then
    perform core.person_email_add(pid, pg_catalog.btrim(p_person ->> 'email'), true, p_reason);
  end if;
  if p_person ->> 'role_id' is not null then
    perform core.access_set_person_role(pid, (p_person ->> 'role_id')::uuid, coalesce(p_reason, 'new person'));
  end if;
  if coalesce((p_person ->> 'can_sign_in')::boolean, false) then
    perform core.person_switch(pid, true, coalesce(p_reason, 'new person'));
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'version', (select p.version from core.person p where p.id = pid),
                                       'email_id', (select e.id from core.person_email e
                                                    where e.person_id = pid and e.deleted_at is null limit 1),
                                       'request_id', req);
end
$$;

-- ================================================================ the wrappers and grants (V124)
create function api.own_password_set(p_auth_user uuid, p_keep_session uuid) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.own_password_set(p_auth_user, p_keep_session) $$;

revoke all on function core.own_password_set(uuid, uuid), api.own_password_set(uuid, uuid) from public;
grant execute on function core.own_password_set(uuid, uuid), api.own_password_set(uuid, uuid) to service_role;
