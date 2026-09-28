-- v2 sign-in (P3-2, the database half): the allow-list of e-mails, the sign-in log, the checks the sign-in flow asks,
-- and the admin's allow-list functions. TECH-SPEC §4 as amended by V59 (the emailed code is the door); V2, V44, V107.
-- Forward-only: once merged this file never changes (V103).

create extension if not exists citext with schema extensions;

-- ================================================================ the allow-list (§4)
-- A person holds one or more allowed e-mails (a .com and a .net); an e-mail belongs to one live person; one of a
-- person's e-mails is primary (the display e-mail). Only staff hold them: System and Import never sign in (V44).
create table core.person_email (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references core.person (id),
  email extensions.citext not null check (email::text ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id),
  version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index person_email_live on core.person_email (email) where deleted_at is null;
create unique index person_email_one_primary on core.person_email (person_id) where is_primary and deleted_at is null;
alter table core.person_email enable row level security;
comment on table core.person_email is 'The sign-in allow-list: the e-mails of a person, one live person per e-mail (§4).';
select audit.track('core.person_email');

create function core.person_email_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from core.person p where p.id = new.person_id and p.kind = 'staff') then
    raise exception using errcode = 'P0001', message = 'person_email.not_staff';
  end if;
  return new;
end
$$;
create trigger guard before insert or update on core.person_email
  for each row execute function core.person_email_guard();

alter table core.person_auth alter column email type extensions.citext;

-- ================================================================ the sign-in log (§4 step 8)
-- Every attempt, allowed or refused, and every session the app ends. A log, not a record: never changed, so it is not
-- tracked by audit.capture (SCHEMA-01 lists it with the change log itself). Read by admins in Settings → Activity (P3-5).
create table core.sign_in_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  person_id uuid references core.person (id),       -- null when nobody was found
  auth_user_id uuid,                                  -- no foreign key: the log outlives the auth user
  session_id uuid,                                    -- the Supabase session a successful sign-in started
  email extensions.citext,
  provider text not null check (provider in ('email', 'google', 'zoom')),
  result text not null check (result in ('code_sent', 'ok', 'not_listed', 'switched_off', 'code_expired',
                                         'code_invalid', 'provider_error', 'session_ended')),
  keep_signed_in boolean,
  detail text,
  user_agent text
);
create index sign_in_log_session on core.sign_in_log (session_id) where session_id is not null;
create index sign_in_log_email on core.sign_in_log (email, at desc);
alter table core.sign_in_log enable row level security;
comment on table core.sign_in_log is 'Every sign-in attempt and its result, allowed or refused (§4).';

select core.index_foreign_keys('core');

-- ================================================================ who may sign in
-- Note: these functions pin search_path to '' (SEC-01), where citext's own case-insensitive "=" (in `extensions`) is not
-- found and Postgres would quietly compare as case-sensitive text — so every e-mail comparison names the operator.
-- An e-mail may sign in when it is a live allowed e-mail of an active staff person allowed to sign in.
create function core.sign_in_state(p_email text) returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case when p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
                then 'allowed' else 'switched_off' end
    from core.person_email e join core.person p on p.id = e.person_id
    where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null), 'not_listed')
$$;

-- The session a JWT belongs to (Supabase puts session_id in every access token).
create function core.jwt_session_id() returns uuid
language sql stable set search_path = ''
as $$
  select nullif(coalesce(auth.jwt() ->> 'session_id', ''), '')::uuid
$$;

-- How long a sign-in lasts, ticked or not (§4: 30 days; unticked it also ends with the browser session). A setting once
-- the registry exists (P3-4 moves it to auth.keep_signed_in_days).
create function core.sign_in_days() returns int
language sql immutable parallel safe set search_path = ''
as $$ select 30 $$;

-- authz.me(), stricter than P3-1's: the sign-in's own e-mail must still be allowed, and the session must have been
-- started by the sign-in flow no more than 30 days ago. Removing an e-mail or switching a person off stops them at once.
create or replace function authz.me() returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id
  from core.person_auth a
  join core.person p on p.id = a.person_id
  where a.auth_user_id = auth.uid()
    and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
    and exists (select 1 from core.person_email e
                where e.person_id = p.id and e.email operator(extensions.=) a.email and e.deleted_at is null)
    and exists (select 1 from core.sign_in_log l
                where l.session_id = core.jwt_session_id() and l.auth_user_id = auth.uid() and l.result = 'ok'
                  and l.at > core.clock() - pg_catalog.make_interval(days => core.sign_in_days()))
$$;

-- ================================================================ the flow's own calls
-- Before a code is sent (the server, with the secret key): is this e-mail allowed? A refusal is logged with its reason;
-- so is a code sent. Only the service role may call these (the browser never holds that key — §4 step 2).
create function api.sign_in_check(p_email text, p_user_agent text default null) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  st text := core.sign_in_state(p_email);
  pid uuid;
begin
  select e.person_id into pid from core.person_email e
  where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null;
  insert into core.sign_in_log (person_id, email, provider, result, user_agent)
  values (pid, lower(p_email), 'email', case st when 'allowed' then 'code_sent' else st end, p_user_agent);
  return st;
end
$$;
comment on function api.sign_in_check(text, text) is 'Service role only: allowed / not_listed / switched_off, logged.';

-- Anything the server must log without a session: a wrong or expired code, a provider error, a session it ended.
create function api.sign_in_event(p_email text, p_result text, p_detail text default null, p_user_agent text default null,
                                  p_auth_user_id uuid default null, p_session_id uuid default null,
                                  p_provider text default 'email') returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if p_result not in ('code_expired', 'code_invalid', 'provider_error', 'session_ended', 'not_listed', 'switched_off') then
    raise exception using errcode = 'P0001', message = 'sign_in.unknown_event', detail = p_result;
  end if;
  insert into core.sign_in_log (person_id, auth_user_id, session_id, email, provider, result, detail, user_agent)
  values ((select e.person_id from core.person_email e
           where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null),
          p_auth_user_id, p_session_id, lower(p_email), p_provider, p_result, p_detail, p_user_agent);
end
$$;
comment on function api.sign_in_event(text, text, text, text, uuid, uuid, text) is 'Service role only: logs an event of the sign-in flow.';

-- Right after the code is verified (the signed-in person themselves): is this sign-in allowed? Logs 'ok' with the
-- session it started and the "keep me signed in" choice, or the refusal; records the door used on the link.
create function api.sign_in_complete(p_keep boolean, p_provider text default 'email', p_user_agent text default null)
  returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid := core.jwt_session_id();
  a core.person_auth;
  st text;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'auth.not_signed_in';
  end if;
  if p_provider not in ('email', 'google', 'zoom') then
    raise exception using errcode = 'P0001', message = 'sign_in.unknown_provider', detail = p_provider;
  end if;
  select * into a from core.person_auth where auth_user_id = uid;
  st := case when a.id is null then 'not_listed' else core.sign_in_state(a.email::text) end;
  insert into core.sign_in_log (person_id, auth_user_id, session_id, email, provider, result, keep_signed_in, user_agent)
  values (a.person_id, uid, sid, a.email, p_provider, case st when 'allowed' then 'ok' else st end, p_keep, p_user_agent);
  if st = 'allowed' and not (p_provider = any (a.providers)) then
    update core.person_auth set providers = providers || p_provider where id = a.id;
  end if;
  return case st when 'allowed' then 'ok' else st end;
end
$$;
comment on function api.sign_in_complete(boolean, text, text) is 'The signed-in person, after the code: ok / not_listed / switched_off, logged.';

-- api.me() as in P3-1, answering 'session_expired' when this session was not started by the sign-in flow in the last
-- 30 days, and 'not_listed' when the sign-in's e-mail is no longer allowed; `session` tells the gate when it started.
create or replace function api.me() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  a core.person_auth;
  p core.person;
  r core.role;
  pr core.person_profile;
  s core.sign_in_log;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'auth.not_signed_in';
  end if;
  select * into a from core.person_auth where auth_user_id = uid;
  if a.id is null or not exists (select 1 from core.person_email e
                                 where e.person_id = a.person_id and e.email operator(extensions.=) a.email and e.deleted_at is null) then
    return pg_catalog.jsonb_build_object('status', 'not_listed');
  end if;
  select * into p from core.person where id = a.person_id;
  if p.kind <> 'staff' or not p.active or not p.can_sign_in or p.deleted_at is not null then
    return pg_catalog.jsonb_build_object('status', 'switched_off');
  end if;
  select * into s from core.sign_in_log l
  where l.session_id = core.jwt_session_id() and l.auth_user_id = uid and l.result = 'ok'
  order by l.at desc limit 1;
  if s.id is null or s.at <= core.clock() - pg_catalog.make_interval(days => core.sign_in_days()) then
    return pg_catalog.jsonb_build_object('status', 'session_expired');
  end if;
  select * into r from core.role where id = p.role_id;
  select * into pr from core.person_profile where person_id = p.id;
  return pg_catalog.jsonb_build_object(
    'status', 'ok',
    'session', pg_catalog.jsonb_build_object(
      'signed_in_at', s.at, 'keep_signed_in', s.keep_signed_in,
      'ends_at', s.at + pg_catalog.make_interval(days => core.sign_in_days()), 'email', a.email),
    'person', pg_catalog.jsonb_build_object(
      'id', p.id, 'kind', p.kind,
      'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
      'nickname_en', p.nickname_en, 'nickname_ar', p.nickname_ar,
      'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
      'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id,
      'role', case when r.id is null then null else pg_catalog.jsonb_build_object(
        'id', r.id, 'key', r.key, 'name_en', r.name_en, 'name_ar', r.name_ar, 'is_admin', r.is_admin) end),
    'levels', coalesce((
      select pg_catalog.jsonb_object_agg(pg.key, coalesce(
               case when r.is_admin then 'full'::core.level end,
               (select l.level from core.person_page_level l
                 where l.person_id = p.id and l.page_key = pg.key and l.deleted_at is null),
               (select l.level from core.role_page_level l
                 where l.role_id = r.id and l.page_key = pg.key and l.deleted_at is null),
               'none'::core.level))
      from core.page pg where pg.active), '{}'::jsonb),
    'capabilities', coalesce((
      select pg_catalog.jsonb_agg(c.key order by c.key)
      from core.capability c
      where c.active and coalesce(
              case when r.is_admin then true end,
              (select x.granted from core.person_capability x
                where x.person_id = p.id and x.capability_key = c.key and x.deleted_at is null),
              (select x.granted from core.role_capability x
                where x.role_id = r.id and x.capability_key = c.key and x.deleted_at is null),
              false)), '[]'::jsonb),
    'departments', (
      select pg_catalog.jsonb_agg(d order by d)
      from (select p.department_id as d
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

-- ================================================================ the admin's allow-list
-- Adding and removing allowed e-mails is Settings → Organization & access, Full for admins only (§8). The server
-- route checks api.me() first, creates or bans the auth user with the secret key, and calls these as the admin;
-- they check again (A12: the database decides). P3-4 replaces authz.is_admin() with the general authz.require().
create function authz.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select r.is_admin from core.person p join core.role r on r.id = p.role_id
                   where p.id = authz.me()), false)
$$;
grant execute on function authz.is_admin() to authenticated;

create function authz.require_admin() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null or not authz.is_admin() then
    raise exception using errcode = '42501', message = 'access.needs_admin',
      detail = 'Settings → Organization & access · Full';
  end if;
  return me;
end
$$;

-- Adds an allowed e-mail to a person (one request, logged and undoable).
create function api.person_email_add(p_person uuid, p_email text, p_primary boolean default false,
                                     p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  req uuid;
  e core.person_email;
begin
  perform authz.require_admin();
  req := audit.begin('ui', 'person_email.added', pg_catalog.jsonb_build_object('email', p_email), p_reason);
  if exists (select 1 from core.person_email x where x.email operator(extensions.=) p_email::extensions.citext and x.deleted_at is null) then
    raise exception using errcode = '23505', message = 'person_email.taken', detail = p_email;
  end if;
  if p_primary then
    update core.person_email set is_primary = false where person_id = p_person and is_primary and deleted_at is null;
  end if;
  insert into core.person_email (person_id, email, is_primary)
  values (p_person, lower(p_email),
          p_primary or not exists (select 1 from core.person_email x where x.person_id = p_person and x.deleted_at is null))
  returning * into e;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', e.id, 'version', e.version, 'request_id', req);
end
$$;

-- Links the auth user the server created (or found) for an allowed e-mail to its person.
create function api.person_auth_link(p_email text, p_auth_user_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  req uuid;
  pid uuid;
  a core.person_auth;
begin
  perform authz.require_admin();
  select e.person_id into pid from core.person_email e
  where e.email operator(extensions.=) p_email::extensions.citext and e.deleted_at is null;
  if pid is null then
    raise exception using errcode = 'P0001', message = 'person_auth.email_not_allowed', detail = p_email;
  end if;
  if not exists (select 1 from auth.users u where u.id = p_auth_user_id and lower(u.email) = lower(p_email)) then
    raise exception using errcode = 'P0001', message = 'person_auth.user_email_mismatch', detail = p_email;
  end if;
  req := audit.begin('ui', 'person_auth.linked', pg_catalog.jsonb_build_object('email', p_email));
  insert into core.person_auth (auth_user_id, person_id, email)
  values (p_auth_user_id, pid, lower(p_email))
  on conflict (auth_user_id) do update set person_id = excluded.person_id, email = excluded.email
  returning * into a;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', a.id, 'version', a.version, 'request_id', req);
end
$$;

-- Removes an allowed e-mail (soft, logged, undoable) and returns the auth users the server must ban.
create function api.person_email_remove(p_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  req uuid;
  me uuid := authz.require_admin();
  e core.person_email;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  req := audit.begin('ui', 'person_email.removed', null, p_reason);
  update core.person_email set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_reason,
    is_primary = false
  where id = p_id and deleted_at is null
  returning * into e;
  if e.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', e.id, 'version', e.version, 'request_id', req,
    'ban', coalesce((select pg_catalog.jsonb_agg(a.auth_user_id) from core.person_auth a
                     where a.person_id = e.person_id and a.email operator(extensions.=) e.email), '[]'::jsonb));
end
$$;

-- The server's reconciliation after any access change: which of a person's auth users may sign in, which are banned.
create function api.person_auth_state(p_person uuid) returns table (auth_user_id uuid, email text, allowed boolean)
language sql stable security definer set search_path = ''
as $$
  select a.auth_user_id, a.email::text, core.sign_in_state(a.email::text) = 'allowed'
         and exists (select 1 from core.person_email e
                     where e.person_id = a.person_id and e.email operator(extensions.=) a.email and e.deleted_at is null)
  from core.person_auth a where a.person_id = p_person
$$;

-- The auth user of an e-mail, when the server's create found it already there.
create function api.auth_user_of(p_email text) returns uuid
language sql stable security definer set search_path = ''
as $$ select u.id from auth.users u where lower(u.email) = lower(p_email) limit 1 $$;

-- ================================================================ grants
-- The browser's session: completing a sign-in and the admin's allow-list calls. The server's secret key (service
-- role): the pre-check, the event log, the reconciliation and the lookup. Nobody else.
grant execute on function api.sign_in_complete(boolean, text, text), api.person_email_add(uuid, text, boolean, text),
  api.person_auth_link(text, uuid), api.person_email_remove(uuid, text) to authenticated;
grant usage on schema api to service_role;
grant execute on function api.sign_in_check(text, text), api.sign_in_event(text, text, text, text, uuid, uuid, text),
  api.person_auth_state(uuid), api.auth_user_of(text) to service_role;
