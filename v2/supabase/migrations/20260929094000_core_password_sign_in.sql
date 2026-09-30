-- v2 sign-in by e-mail and password (the owner, 29 Sep 13:50 and 14:10 — V431, V441; V166). No e-mail is sent at all:
--  · an admin generates a person's temporary password (never typed — the server makes it, shows it once and sets it in
--    Supabase Auth with the secret key, /auth/admin/password); a reset is a new generate; the database decides who may,
--    logs it with its reason, and marks every sign-in of the person "must change password"; it also answers who has
--    no password yet, for "Generate for everyone without a password";
--  · until the person changes it, the sign-in reaches nothing but the change: authz.me() is null, api.me() answers
--    must_change_password, and a reset signs every device of the person out;
--  · the person's change is recorded by the server, never by the browser (api.password_changed, service role only);
--  · the emailed code stays built, switched off by a setting (auth.code_door_enabled, off): its pre-check answers code_off,
--    and a session a code opened while it is off is never a sign-in;
--  · sign-ups stay off; only allowed, switched-on people get in; the device rules are unchanged (V74);
--  · too many tries lock the e-mail (V172): five wrong passwords within fifteen minutes lock it for fifteen minutes, and
--    no e-mail is checked more than twenty times in fifteen minutes — counted here, per e-mail, because Supabase's own
--    limits see the app server's address, not the person's.
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
-- The password door's own results (V172): a wrong password, a refusal while the e-mail is locked, and too many tries.
alter table core.sign_in_log drop constraint sign_in_log_result_check;
alter table core.sign_in_log add constraint sign_in_log_result_check check (result in (
  'code_sent', 'ok', 'not_listed', 'switched_off', 'code_expired', 'code_invalid', 'provider_error', 'signed_out',
  'wrong_password', 'locked', 'rate_limited'));

-- ================================================================ which door a session came through
-- Supabase's access token names how the session was made (amr): a password, or a one-time code (otp / magic link).
create function core.jwt_method() returns text
language sql stable set search_path = ''
as $$
  select case m ->> 'method' when 'password' then 'password' when 'otp' then 'code' when 'magiclink' then 'code' end
  from pg_catalog.jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) m
  limit 1
$$;

-- Whether the emailed code is a door today (auth.code_door_enabled, off unless an admin switches it on).
create function core.code_door_on() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((core.setting_at('auth.code_door_enabled', null, core.riyadh_today()) #>> '{}')::boolean, false)
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

-- ================================================================ too many tries (V172)
-- Whether an e-mail may try now: 'locked' fifteen minutes from its fifth wrong password within fifteen minutes — the
-- right password included —, 'rate_limited' once it was tried twenty times in fifteen minutes (any door, any result
-- but a sign-in), else null. A successful sign-in, or a password an admin sets or the person changes, starts the count
-- again ("Try again in 15 minutes or ask your admin"); a refusal while locked is logged, and is not a wrong password.
-- Fixed here, as the sign-in page says it. Supabase's own limits see the app server's address, not the person's.
create function core.sign_in_limited(p_email text) returns text
language sql stable security definer set search_path = ''
as $$
  with since as (
    select greatest(
      core.clock() - interval '30 minutes',
      (select pg_catalog.max(a.password_set_at) from core.person_auth a
       where a.email operator(extensions.=) p_email::extensions.citext),
      (select pg_catalog.max(o.at) from core.sign_in_log o
       where o.email operator(extensions.=) p_email::extensions.citext and o.result = 'ok'
         and o.at > core.clock() - interval '30 minutes')) as t),
  recent as (
    select l.at, l.result
    from core.sign_in_log l, since s
    where l.email operator(extensions.=) p_email::extensions.citext and l.at > s.t
      and l.result not in ('ok', 'signed_out')),
  tries as (select r.at from recent r where r.result = 'wrong_password' order by r.at desc limit 5)
  select case
    when (select pg_catalog.count(*) from tries) = 5
         and (select pg_catalog.max(t.at) - pg_catalog.min(t.at) from tries t) <= interval '15 minutes'
         and core.clock() < (select pg_catalog.max(t.at) from tries t) + interval '15 minutes' then 'locked'
    when (select pg_catalog.count(*) from recent r where r.at > core.clock() - interval '15 minutes') >= 20
      then 'rate_limited'
  end
$$;

-- ================================================================ the doors
-- Which doors the sign-in page offers (the server reads it before drawing the page).
create function core.sign_in_methods() returns jsonb
language sql stable security definer set search_path = ''
as $$ select pg_catalog.jsonb_build_object('password', true, 'code', core.code_door_on()) $$;

-- The code door's pre-check as P3-2 wrote it — answering code_off, and logging nothing, while the door is off; a locked
-- or too-often-tried e-mail is refused and logged (V172).
create or replace function core.sign_in_check(p_email text, p_user_agent text default null) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  st text;
begin
  if not core.code_door_on() then
    return 'code_off';
  end if;
  st := coalesce(core.sign_in_limited(p_email), core.sign_in_state(p_email));
  insert into core.sign_in_log (person_id, email, provider, result, user_agent, method)
  values ((select e.person_id from core.person_email e
           where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null),
          lower(p_email), 'email', case st when 'allowed' then 'code_sent' else st end, p_user_agent, 'code');
  return st;
end
$$;

-- The password door's pre-check (the server, with the secret key): is this e-mail allowed, and may it try now (V172)?
-- A refusal is logged; an allowed e-mail logs nothing yet — the sign-in itself is logged when it completes, a wrong
-- password when Auth refuses.
create function core.sign_in_password_check(p_email text, p_user_agent text default null) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  st text := coalesce(core.sign_in_limited(p_email), core.sign_in_state(p_email));
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

-- Auth refused the password (or the service failed): logged with Supabase's own reason — a wrong password as one
-- (V172). The answer: 'locked' when this wrong password was the fifth, else 'wrong_password' or 'provider_error'.
create function core.sign_in_password_refused(p_email text, p_detail text, p_user_agent text default null) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  wrong boolean := coalesce(p_detail in ('invalid_credentials', 'invalid_grant', 'Invalid login credentials'), false);
begin
  insert into core.sign_in_log (person_id, email, provider, result, detail, user_agent, method)
  values ((select e.person_id from core.person_email e
           where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null),
          lower(p_email), 'email', case when wrong then 'wrong_password' else 'provider_error' end,
          pg_catalog.left(p_detail, 200), p_user_agent, 'password');
  if not wrong then
    return 'provider_error';
  end if;
  return case when core.sign_in_limited(p_email) = 'locked' then 'locked' else 'wrong_password' end;
end
$$;

-- api.sign_in_complete as P3-2 wrote it, now knowing its door: a session a code opened while the code door is off is
-- refused (code_off) and registers no device; so is a session made while its e-mail is locked (V172) — straight
-- through Supabase, say, past the server's check; a sign-in that must change its password registers its device and
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
  if m = 'code' and not core.code_door_on() then
    insert into core.sign_in_log (person_id, auth_user_id, auth_session_id, email, provider, result, detail, user_agent,
                                  method)
    values (a.person_id, uid, sid, a.email, p_provider, 'provider_error', 'code_door_off', p_user_agent, m);
    return 'code_off';
  end if;
  if a.id is not null and core.sign_in_limited(a.email::text) = 'locked' then
    insert into core.sign_in_log (person_id, auth_user_id, auth_session_id, email, provider, result, user_agent, method)
    values (a.person_id, uid, sid, a.email, p_provider, 'locked', p_user_agent, m);
    return 'locked';
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

-- ================================================================ who has a password
-- Whether any live sign-in of a person holds a password — one generated here, one the person chose, or one the sign-in
-- brought with it: an auth user the app found already there (made in the dashboard by the owner, who typed its password
-- himself — V166) is marked when it is linked (core.person_auth_found). The app's own record: Auth keeps a hash even
-- for a user made without a password, so it cannot tell.
create function core.has_password(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from core.person_auth a
    where a.person_id = p_person and a.password_set_at is not null
      and exists (select 1 from core.person_email e where e.person_id = a.person_id
                  and e.email operator(extensions.=) a.email and e.deleted_at is null))
$$;

-- The server linked an auth user it found already there, not one it made: it brings its own password (V166) — marked
-- as set, by nobody in the app, so no generate replaces it unless an admin asks. Admins only; logged.
create function core.person_auth_found(p_auth_user uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
  req uuid;
  n int;
begin
  req := audit.begin('ui', 'person_auth.found_existing', null, null);
  update core.person_auth set password_set_at = core.clock()
  where auth_user_id = p_auth_user and password_set_at is null;
  get diagnostics n = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('marked', n, 'request_id', req);
end
$$;

-- A person's allowed e-mails with no sign-in linked yet — the server links each to its auth user (the existing one,
-- found by e-mail, never a second) before a password is generated. Admins only.
create function core.person_emails_unlinked(p_person uuid) returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.array_agg(e.email::text order by e.email), '{}')
  from core.person_email e
  where authz.require_admin() is not null and e.person_id = p_person and e.deleted_at is null
    and not exists (select 1 from core.person_auth a where a.email operator(extensions.=) e.email)
$$;

-- ================================================================ the temporary password, generated for an admin
-- An admin generates a person's temporary password (V441; Settings → the person → Generate temporary password; a reset
-- is a new generate). The database decides and logs (with the reason); the server makes the password, sets it on every
-- sign-in the answer names and shows it once. Every sign-in of the person (each allowed e-mail's auth user) must change
-- it at the next sign-in, and every device of the person is signed out (a reset may be for a lost device).
-- A password someone already has — one the owner typed for himself in the dashboard (V166), or one already generated —
-- is replaced only when the admin says so (`p_replace`, the screen's Reset): otherwise refused as person_password.has_one.
create function core.person_password_set(p_person uuid, p_reason text, p_replace boolean default false) returns jsonb
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
  req := audit.begin('ui', 'person_auth.password_generated', null, p_reason);
  update core.person_auth set must_change_password = true, password_set_at = core.clock(), password_set_by = me
  where auth_user_id = any (users);
  n := core.end_devices(p_person, null, null, 'admin', me);
  perform audit.end();
  return pg_catalog.jsonb_build_object('person_id', p_person, 'auth_user_ids', pg_catalog.to_jsonb(users),
                                       'signed_out', n, 'request_id', req);
end
$$;

-- Who has no password yet (V441 — "Generate for everyone without a password"): each allowed, switched-on person with a
-- live allowed e-mail none of whose sign-ins holds a password in Auth — so an account whose password the owner typed
-- himself is never in it (V166) — the admin asking aside (a generate signs its person out everywhere, so an admin
-- generates their own on its own). Admins only.
create function core.people_without_password() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('person_id', p.id, 'full_name_en', p.full_name_en,
                                                                     'full_name_ar', p.full_name_ar)
                                       order by p.full_name_en), '[]'::jsonb)
  from core.person p
  where p.id is distinct from authz.require_admin()
    and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
    and exists (select 1 from core.person_email e where e.person_id = p.id and e.deleted_at is null)
    and not core.has_password(p.id)
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
create function api.sign_in_password_refused(p_email text, p_detail text, p_user_agent text default null) returns text
language sql volatile security invoker set search_path = ''
as $$ select core.sign_in_password_refused(p_email, p_detail, p_user_agent) $$;
create function api.sign_in_limited(p_email text) returns text
language sql stable security invoker set search_path = '' as $$ select core.sign_in_limited(p_email) $$;
create function api.person_password_set(p_person uuid, p_reason text, p_replace boolean default false) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.person_password_set(p_person, p_reason, p_replace) $$;
create function api.people_without_password() returns jsonb
language sql stable security invoker set search_path = '' as $$ select core.people_without_password() $$;
create function api.person_emails_unlinked(p_person uuid) returns text[]
language sql stable security invoker set search_path = '' as $$ select core.person_emails_unlinked(p_person) $$;
create function api.person_auth_found(p_auth_user uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.person_auth_found(p_auth_user) $$;
create function api.password_changed(p_auth_user uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select core.password_changed(p_auth_user) $$;
comment on function api.sign_in_complete(text, text, text) is
  'The signed-in person, after the password or the code: ok / must_change_password (device registered) / not_listed / switched_off / code_off / locked.';
comment on function api.sign_in_check(text, text) is 'Service role only: the code door''s pre-check — allowed / not_listed / switched_off / locked / rate_limited, logged; code_off while the door is off.';
comment on function api.sign_in_limited(text) is 'Service role only: locked / rate_limited, or null when the e-mail may try now (V172).';

revoke all on function core.jwt_method(), core.code_door_on(), core.sign_in_methods(),
  core.sign_in_password_check(text, text), core.sign_in_password_refused(text, text, text),
  core.person_password_set(uuid, text, boolean), core.password_changed(uuid), api.sign_in_methods(),
  api.sign_in_password_check(text, text), api.sign_in_password_refused(text, text, text),
  api.person_password_set(uuid, text, boolean), api.password_changed(uuid), core.people_without_password(),
  api.people_without_password(), core.has_password(uuid), core.person_emails_unlinked(uuid),
  api.person_emails_unlinked(uuid), core.person_auth_found(uuid), api.person_auth_found(uuid),
  core.sign_in_limited(text), api.sign_in_limited(text) from public;
grant execute on function core.person_password_set(uuid, text, boolean), api.person_password_set(uuid, text, boolean),
  core.people_without_password(), api.people_without_password(), core.person_emails_unlinked(uuid),
  api.person_emails_unlinked(uuid), core.person_auth_found(uuid), api.person_auth_found(uuid) to authenticated;
grant execute on function core.sign_in_methods(), core.sign_in_password_check(text, text),
  core.sign_in_password_refused(text, text, text), core.password_changed(uuid), api.sign_in_methods(),
  api.sign_in_password_check(text, text), api.sign_in_password_refused(text, text, text), api.password_changed(uuid),
  core.sign_in_limited(text), api.sign_in_limited(text)
  to service_role;
