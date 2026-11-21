-- Landing 35 — who is asking is answered once and cheaply (owner's live sweep, 21 Nov 2026: reads cut at 8 s,
-- pages taking 20–60 s on a database holding a few hundred rows).
--
-- The cause this file removes: every read asks "who is this, and what may they do" — authz.me(), authz.level(),
-- authz.can(), authz.is_admin() — and those were SQL-language functions with a pinned search_path. Postgres can
-- neither inline such a function nor keep its plan: it parses and plans the whole body again on EVERY call, and
-- authz.me() nests four of them (real_me → live_device → …, then switch_target → live_device again). Measured on
-- the profiling database: authz.me() 2.3 ms a call, authz.level() 3.1 ms, authz.can() 3.4 ms, and
-- authz.is_admin() 26 ms — it compared every person row with authz.me(), so it asked "who am I" once per person.
-- A list that checks access per row paid that per row.
--
-- The move: the same queries, word for word, in plpgsql — which plans a statement once per connection and keeps
-- the plan — and "who am I" asked once per function, not once per row. No rule changes: every condition below
-- is the one it replaces (the device still has to be live, the person active, the e-mail still listed, the
-- switch to a TEST user still honoured). No signature, grant or owner changes.

-- the device this request's session belongs to, while it is live
create or replace function core.live_device() returns core.device_session
language plpgsql stable security definer set search_path = '' as $$
declare
  d core.device_session;
begin
  select s.* into d from core.device_session s
  where s.auth_session_id = core.jwt_session_id() and s.auth_user_id = auth.uid()
    and s.signed_out_at is null
    and s.last_seen_at > core.clock() - pg_catalog.make_interval(days => core.device_idle_days());
  if not found then
    return null;
  end if;
  return d;
end
$$;

create or replace function authz.real_me() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  who uuid;
begin
  select p.id into who
  from core.person_auth a
  join core.person p on p.id = a.person_id
  where a.auth_user_id = auth.uid()
    and not a.must_change_password
    and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
    and (p.left_on is null or p.left_on > core.riyadh_today())
    and exists (select 1 from core.person_email e
                where e.person_id = p.id and e.email operator(extensions.=) a.email and e.deleted_at is null)
    and (core.live_device()).id is not null;
  return who;
end
$$;

create or replace function authz.switch_target(p_real uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  target uuid;
begin
  if p_real is null then
    return null;
  end if;
  select d.as_person_id into target
  from core.device_session d
  join core.person t on t.id = d.as_person_id
  where d.id = (core.live_device()).id and d.person_id = p_real
    and t.is_test and t.active and t.deleted_at is null
    and exists (select 1 from core.test_switch_holder h join core.person o on o.id = h.person_id
                join core.role r on r.id = o.role_id
                where h.person_id = p_real and r.is_admin);
  return target;
end
$$;

create or replace function authz.me() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  real_id uuid := authz.real_me();
begin
  if real_id is null then
    return null;
  end if;
  return coalesce(authz.switch_target(real_id), real_id);
end
$$;

create or replace function authz.switched_by() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  real_id uuid := authz.real_me();
begin
  if real_id is not null and authz.switch_target(real_id) is not null then
    return real_id;
  end if;
  return null;
end
$$;

create or replace function authz.is_admin() returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  who uuid := authz.me();
begin
  return coalesce((select r.is_admin from core.person p join core.role r on r.id = p.role_id
                   where p.id = who), false);
end
$$;

create or replace function authz.level_of(p_person uuid, p_page text) returns core.level
language plpgsql stable security definer set search_path = '' as $$
begin
  return coalesce((
    select case
             when r.is_admin then (select pg_catalog.max(l) from pg_catalog.unnest(pg.levels_allowed) l)
             when authz.is_settings_page(pg.key) then 'none'::core.level
             else coalesce(
               (select l.level from core.person_page_level l
                 where l.person_id = p.id and l.page_key = pg.key and l.deleted_at is null),
               (select pg_catalog.max(l.level) from core.team_page_level l join core.team t on t.id = l.team_id
                 where l.page_key = pg.key and l.deleted_at is null and t.active
                   and (l.team_id = p.team_id
                        or exists (select 1 from core.person_team_assist a
                                   where a.person_id = p.id and a.team_id = l.team_id and a.deleted_at is null))),
               (select l.level from core.role_page_level l
                 where l.role_id = p.role_id and l.page_key = pg.key and l.deleted_at is null),
               'none'::core.level)
           end
    from core.person p
    join core.page pg on pg.key = p_page and pg.active
    left join core.role r on r.id = p.role_id
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
  ), 'none'::core.level);
end
$$;

create or replace function authz.can_of(p_person uuid, p_capability text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return coalesce((
    select case
             when r.is_admin then true
             else coalesce(
               (select x.granted from core.person_capability x
                 where x.person_id = p.id and x.capability_key = c.key and x.deleted_at is null),
               (select x.granted from core.role_capability x
                 where x.role_id = p.role_id and x.capability_key = c.key and x.deleted_at is null),
               false)
           end
    from core.person p
    join core.capability c on c.key = p_capability and c.active
    left join core.role r on r.id = p.role_id
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
  ), false);
end
$$;

create or replace function authz.level(p_page text) returns core.level
language plpgsql stable security definer set search_path = '' as $$
begin
  return authz.level_of(authz.me(), p_page);
end
$$;

create or replace function authz.can(p_capability text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return authz.can_of(authz.me(), p_capability);
end
$$;

create or replace function authz.in_my_departments(p_department uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  who uuid := authz.me();
begin
  return coalesce((
    select coalesce(r.is_admin, false) or p.department_id = p_department
           or exists (select 1 from core.person_department pd
                      where pd.person_id = p.id and pd.department_id = p_department and pd.deleted_at is null)
    from core.person p left join core.role r on r.id = p.role_id
    where p.id = who), false);
end
$$;

create or replace function authz.reports_to(p_person uuid, p_manager uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return coalesce((select p.manager_id = p_manager from core.person p where p.id = p_person), false);
end
$$;

create or replace function authz.reports_to(p_person uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return authz.reports_to(p_person, authz.me());
end
$$;

create or replace function authz.can_see(p_entity text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return authz.can_see_as(authz.me(),
                          (select e.table_name from core.entity e where e.key = p_entity and e.active), p_id);
end
$$;

create or replace function authz.can_upload_file(p_bucket text, p_path text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  who uuid := authz.me();
begin
  return exists (select 1 from core.file f
                 where f.bucket = p_bucket and f.path = p_path and f.status = 'pending' and f.deleted_at is null
                   and f.created_by = who);
end
$$;

-- the clock and the session id: one-line expressions, read on almost every row of every list
create or replace function core.clock() returns timestamptz
language plpgsql stable parallel safe set search_path = '' as $$
begin
  return coalesce(nullif(pg_catalog.current_setting('v2.test_now', true), '')::timestamptz, pg_catalog.now());
end
$$;

create or replace function core.riyadh_today() returns date
language plpgsql stable parallel safe set search_path = '' as $$
begin
  return core.riyadh_day(core.clock());
end
$$;

create or replace function core.jwt_session_id() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  return nullif(coalesce(auth.jwt() ->> 'session_id', ''), '')::uuid;
end
$$;

create or replace function core.device_idle_days() returns integer
language plpgsql stable set search_path = '' as $$
begin
  return coalesce((core.setting_at('auth.device_idle_days', null, core.riyadh_today()) #>> '{}')::int, 30);
end
$$;
