-- v2 sign-in by e-mail and password (the owner, 29 Sep 13:50; V166). No e-mail is sent at all:
--  · an admin gives a person's sign-in a starting password, and resets it — the server sets it in Supabase Auth with
--    the secret key (/auth/admin/password); the database decides who may, logs it with its reason, and marks the
--    sign-in "must change password";
--  · until the person changes it, the sign-in reaches nothing but the change: authz.me() is null, api.me() answers
--    must_change_password, and a reset signs every device of the person out;
--  · the person's change is recorded by the server, never by the browser (api.password_changed, service role only);
--  · the emailed code stays built, switched off by a setting (auth.code_sign_in, off): its pre-check answers code_off,
--    and a session a code opened while it is off is never a sign-in;
--  · sign-ups stay off; only allowed, switched-on people get in; the device rules are unchanged (V74).
-- The minimum length (10) is the server's rule and the Auth project's (supabase/config.toml). Forward-only (V103).

-- ================================================================ the sign-in's password state
alter table core.person_auth add column must_change_password boolean not null default false;
alter table core.person_auth add column password_set_at timestamptz;
alter table core.person_auth add column password_set_by uuid references core.person (id);
create index person_auth_password_set_by on core.person_auth (password_set_by);
comment on column core.person_auth.must_change_password is
  'An admin set this sign-in''s password: the person changes it before anything else (V166).';
comment on column core.person_auth.password_set_at is 'When the password was last set — by an admin or by the person.';
comment on column core.person_auth.password_set_by is 'Who last set the password: an admin, or the person themselves.';

-- How a sign-in was made. The log's provider stays Supabase's "email" for both doors.
alter table core.sign_in_log add column method text check (method in ('code', 'password'));
comment on column core.sign_in_log.method is 'The door: the emailed code or the password (V166); null before it existed.';

-- ================================================================ which door a session came through
-- Supabase's access token names how the session was made (amr): a password, or a one-time code (otp / magic link).
create function core.jwt_method() returns text
language sql stable set search_path = ''
as $$
  select case m ->> 'method' when 'password' then 'password' when 'otp' then 'code' when 'magiclink' then 'code' end
  from pg_catalog.jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) m
  limit 1
$$;

-- Whether the emailed code is a door today (auth.code_sign_in, off unless an admin switches it on).
create function core.code_sign_in_on() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((core.setting_at('auth.code_sign_in', null, core.riyadh_today()) #>> '{}')::boolean, false)
$$;

-- ================================================================ a request on someone's behalf
-- audit.begin as the person the server acts for, when that person cannot act yet (their own password change, while
-- authz.me() is null for them). Internal: only definer functions call it.
create function audit.begin_for(p_actor uuid, p_label_key text, p_label_args jsonb default null, p_reason text default null)
  returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r uuid;
begin
  if coalesce(nullif(pg_catalog.current_setting('app.request_depth', true), '')::int, 0) > 0 then
    raise exception using errcode = 'P0001', message = 'audit.nested_request';
  end if;
  insert into audit.request (actor_id, kind, label_key, label_args, reason)
  values (p_actor, 'ui', p_label_key, p_label_args, p_reason)
  returning id into r;
  perform pg_catalog.set_config('app.request_id', r::text, true);
  perform pg_catalog.set_config('app.request_depth', '1', true);
  return r;
end
$$;
revoke all on function audit.begin_for(uuid, text, jsonb, text) from public;

-- ================================================================ nothing before the change
-- authz.me() as P3-2 wrote it, and null while the sign-in must change its password.
create or replace function authz.me() returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id
  from core.person_auth a
  join core.person p on p.id = a.person_id
  where a.auth_user_id = auth.uid()
    and not a.must_change_password
    and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
    and exists (select 1 from core.person_email e
                where e.person_id = p.id and e.email operator(extensions.=) a.email and e.deleted_at is null)
    and (core.live_device()).id is not null
$$;

-- api.me() as P3-6c wrote it, answering must_change_password (with this device and e-mail) before anything else.
create or replace function core.me() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  a core.person_auth;
  p core.person;
  r core.role;
  pr core.person_profile;
  d core.device_session;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'auth.not_signed_in';
  end if;
  select * into a from core.person_auth where auth_user_id = uid;
  if a.id is null or not exists (select 1 from core.person_email e
                                 where e.person_id = a.person_id and e.email operator(extensions.=) a.email
                                   and e.deleted_at is null) then
    return pg_catalog.jsonb_build_object('status', 'not_listed');
  end if;
  select * into p from core.person where id = a.person_id;
  if p.kind <> 'staff' or not p.active or not p.can_sign_in or p.deleted_at is not null then
    return pg_catalog.jsonb_build_object('status', 'switched_off');
  end if;
  select * into d from core.device_session s where s.auth_session_id = core.jwt_session_id() and s.auth_user_id = uid;
  if d.id is null then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', 'unknown');
  end if;
  if d.signed_out_at is not null then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', d.sign_out_reason);
  end if;
  if d.last_seen_at <= core.clock() - pg_catalog.make_interval(days => core.device_idle_days()) then
    return pg_catalog.jsonb_build_object('status', 'signed_out', 'reason', 'inactive');
  end if;
  if a.must_change_password then
    return pg_catalog.jsonb_build_object('status', 'must_change_password',
      'session', pg_catalog.jsonb_build_object('device_id', d.id, 'email', a.email));
  end if;
  select * into r from core.role where id = p.role_id;
  select * into pr from core.person_profile where person_id = p.id;
  return pg_catalog.jsonb_build_object(
    'status', 'ok',
    'session', pg_catalog.jsonb_build_object(
      'device_id', d.id, 'signed_in_at', d.signed_in_at, 'last_seen_at', d.last_seen_at, 'email', a.email),
    'person', pg_catalog.jsonb_build_object(
      'id', p.id, 'kind', p.kind, 'version', p.version,
      'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
      'nickname_en', p.nickname_en, 'nickname_ar', p.nickname_ar,
      'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
      'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id,
      'role', case when r.id is null then null else pg_catalog.jsonb_build_object(
        'id', r.id, 'key', r.key, 'name_en', r.name_en, 'name_ar', r.name_ar, 'is_admin', r.is_admin) end),
    'levels', coalesce((
      select pg_catalog.jsonb_object_agg(pg.key, authz.level_of(p.id, pg.key))
      from core.page pg where pg.active), '{}'::jsonb),
    'capabilities', coalesce((
      select pg_catalog.jsonb_agg(c.key order by c.key)
      from core.capability c where c.active and authz.can_of(p.id, c.key)), '[]'::jsonb),
    'departments', (
      select pg_catalog.jsonb_agg(ds.dep order by ds.dep)
      from (select p.department_id as dep
            union
            select pd.department_id from core.person_department pd
            where pd.person_id = p.id and pd.deleted_at is null) ds),
    'profile', case when pr.id is null then null else pg_catalog.jsonb_build_object(
      'display_name_en', pr.display_name_en, 'display_name_ar', pr.display_name_ar,
      'avatar_file_id', pr.avatar_file_id, 'avatar_color', pr.avatar_color,
      'badge_kind', pr.badge_kind, 'badge_value', pr.badge_value,
      'theme', pr.theme, 'density', pr.density, 'locale', pr.locale, 'start_page', pr.start_page,
      'drawer_pinned', pr.drawer_pinned, 'notify', pr.notify, 'version', pr.version) end
  );
end
$$;

-- ================================================================ the doors
-- Which doors the sign-in page offers (the server reads it before drawing the page).
create function core.sign_in_methods() returns jsonb
language sql stable security definer set search_path = ''
as $$ select pg_catalog.jsonb_build_object('password', true, 'code', core.code_sign_in_on()) $$;

-- The code door's pre-check as P3-2 wrote it — answering code_off, and logging nothing, while the door is off.
create or replace function core.sign_in_check(p_email text, p_user_agent text default null) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  st text;
begin
  if not core.code_sign_in_on() then
    return 'code_off';
  end if;
  st := core.sign_in_state(p_email);
  insert into core.sign_in_log (person_id, email, provider, result, user_agent, method)
  values ((select e.person_id from core.person_email e
           where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null),
          lower(p_email), 'email', case st when 'allowed' then 'code_sent' else st end, p_user_agent, 'code');
  return st;
end
$$;

-- The password door's pre-check (the server, with the secret key): is this e-mail allowed? A refusal is logged; an
-- allowed e-mail logs nothing yet — the sign-in itself is logged when it completes, a wrong password when Auth refuses.
create function core.sign_in_password_check(p_email text, p_user_agent text default null) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  st text := core.sign_in_state(p_email);
begin
  if st <> 'allowed' then
    insert into core.sign_in_log (person_id, email, provider, result, user_agent, method)
    values ((select e.person_id from core.person_email e
             where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null),
            lower(p_email), 'email', st, p_user_agent, 'password');
  end if;
  return st;
end
$$;

-- Auth refused the password (or the service failed): logged with Supabase's own reason.
create function core.sign_in_password_refused(p_email text, p_detail text, p_user_agent text default null) returns void
language sql volatile security definer set search_path = ''
as $$
  insert into core.sign_in_log (person_id, email, provider, result, detail, user_agent, method)
  values ((select e.person_id from core.person_email e
           where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null),
          lower(p_email), 'email', 'provider_error', pg_catalog.left(p_detail, 200), p_user_agent, 'password')
$$;

-- api.sign_in_complete as P3-2 wrote it, now knowing its door: a session a code opened while the code door is off is
-- refused (code_off) and registers no device; a sign-in that must change its password registers its device and
-- answers must_change_password.
create or replace function core.sign_in_complete(p_provider text default 'email', p_device_label text default null,
                                                 p_user_agent text default null) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := core.jwt_session_id();
  m text := core.jwt_method();
  a core.person_auth;
  st text;
begin
  if uid is null or sid is null then
    raise exception using errcode = '42501', message = 'auth.not_signed_in';
  end if;
  if p_provider is distinct from 'email' then
    raise exception using errcode = 'P0001', message = 'sign_in.unknown_provider', detail = p_provider;
  end if;
  select * into a from core.person_auth where auth_user_id = uid;
  if m = 'code' and not core.code_sign_in_on() then
    insert into core.sign_in_log (person_id, auth_user_id, auth_session_id, email, provider, result, detail, user_agent,
                                  method)
    values (a.person_id, uid, sid, a.email, p_provider, 'provider_error', 'code_sign_in_off', p_user_agent, m);
    return 'code_off';
  end if;
  st := case when a.id is null then 'not_listed' else core.sign_in_state(a.email::text) end;
  insert into core.sign_in_log (person_id, auth_user_id, auth_session_id, email, provider, result, user_agent, method)
  values (a.person_id, uid, sid, a.email, p_provider, case st when 'allowed' then 'ok' else st end, p_user_agent, m);
  if st <> 'allowed' then
    return st;
  end if;
  insert into core.device_session (person_id, auth_user_id, auth_session_id, device_label, user_agent,
                                   signed_in_at, last_seen_at)
  values (a.person_id, uid, sid, p_device_label, p_user_agent, core.clock(), core.clock())
  on conflict (auth_session_id) do nothing;
  if not (p_provider = any (a.providers)) then
    update core.person_auth set providers = providers || p_provider where id = a.id;
  end if;
  return case when a.must_change_password then 'must_change_password' else 'ok' end;
end
$$;

-- ================================================================ the password, set by an admin
-- An admin gives an allowed e-mail's sign-in a starting password, or resets it (Settings → Organization & access). The
-- database decides and logs (with the reason); the server then sets the password in Auth. The sign-in must change it
-- at the next sign-in, and every device of the person is signed out (a reset may be for a lost device).
-- `p_email`: the person_email id. Answers the auth user the server sets the password on.
create function core.person_password_set(p_email uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
  e core.person_email;
  a core.person_auth;
  req uuid;
  n int;
begin
  if p_reason is null or pg_catalog.btrim(p_reason) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  select * into e from core.person_email where id = p_email and deleted_at is null;
  if e.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into a from core.person_auth x where x.email operator(extensions.=) e.email::extensions.citext;
  if a.id is null then
    raise exception using errcode = 'P0001', message = 'person_password.no_sign_in', detail = e.email::text;
  end if;
  req := audit.begin('ui', 'person_auth.password_set', pg_catalog.jsonb_build_object('email', e.email), p_reason);
  update core.person_auth set must_change_password = true, password_set_at = core.clock(), password_set_by = me
  where id = a.id;
  n := core.end_devices(a.person_id, null, null, 'admin', me);
  perform audit.end();
  return pg_catalog.jsonb_build_object('auth_user_id', a.auth_user_id, 'email', e.email, 'person_id', a.person_id,
                                       'signed_out', n, 'request_id', req);
end
$$;

-- ================================================================ the password, changed by the person
-- The server records a person's own change after Auth took the new password (service role only — the browser can
-- never clear its own flag). Logged as the person's request.
create function core.password_changed(p_auth_user uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  a core.person_auth;
  req uuid;
begin
  select * into a from core.person_auth where auth_user_id = p_auth_user;
  if a.id is null or core.sign_in_state(a.email::text) <> 'allowed' then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  req := audit.begin_for(a.person_id, 'person_auth.password_changed', pg_catalog.jsonb_build_object('email', a.email));
  update core.person_auth set must_change_password = false, password_set_at = core.clock(), password_set_by = a.person_id
  where id = a.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('person_id', a.person_id, 'request_id', req);
end
$$;

-- ================================================================ the wrappers and grants (V124)
create function api.sign_in_methods() returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.sign_in_methods() $$;
create function api.sign_in_password_check(p_email text, p_user_agent text default null) returns text
language sql volatile security invoker set search_path = '' as $$ select core.sign_in_password_check(p_email, p_user_agent) $$;
create function api.sign_in_password_refused(p_email text, p_detail text, p_user_agent text default null) returns void
language sql volatile security invoker set search_path = ''
as $$ select core.sign_in_password_refused(p_email, p_detail, p_user_agent) $$;
create function api.person_password_set(p_email uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.person_password_set(p_email, p_reason) $$;
create function api.password_changed(p_auth_user uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.password_changed(p_auth_user) $$;
comment on function api.sign_in_complete(text, text, text) is
  'The signed-in person, after the password or the code: ok / must_change_password (device registered) / not_listed / switched_off / code_off.';
comment on function api.sign_in_check(text, text) is 'Service role only: the code door''s pre-check — allowed / not_listed / switched_off, logged; code_off while the door is off.';

revoke all on function core.jwt_method(), core.code_sign_in_on(), core.sign_in_methods(),
  core.sign_in_password_check(text, text), core.sign_in_password_refused(text, text, text),
  core.person_password_set(uuid, text), core.password_changed(uuid), api.sign_in_methods(),
  api.sign_in_password_check(text, text), api.sign_in_password_refused(text, text, text),
  api.person_password_set(uuid, text), api.password_changed(uuid) from public;
grant execute on function core.person_password_set(uuid, text), api.person_password_set(uuid, text) to authenticated;
grant execute on function core.sign_in_methods(), core.sign_in_password_check(text, text),
  core.sign_in_password_refused(text, text, text), core.password_changed(uuid), api.sign_in_methods(),
  api.sign_in_password_check(text, text), api.sign_in_password_refused(text, text, text), api.password_changed(uuid)
  to service_role;
