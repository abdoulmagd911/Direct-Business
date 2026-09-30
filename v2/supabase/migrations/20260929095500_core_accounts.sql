-- P3-2b · the owner's admin account and the test account are never team members (V444, V445; owner, 14:25).
-- Smallest change (the oversight's ask): one column beside `kind`, so every rule that reads kind = 'staff' — sign-in,
-- the allow-list, the guards — stays true for both accounts, and no constraint is dropped on the cloud project.
-- `core.person.account` is team_member (everyone else), admin_account (the owner's, the first admin of spec §10) or
-- test_account (the oversight's, removed before go-live). Only an admin sets it, with a reason, logged. Neither
-- account is anyone's manager (so neither is in a reports-to picker), and core.is_team_member() is the one test the
-- team lists, KPIs and leaderboards use. The Organisation and the people list name each person's account.

-- ================================================================ the account
alter table core.person add column account text not null default 'team_member'
  constraint person_account_check check (account in ('team_member', 'admin_account', 'test_account'));
alter table core.person add constraint person_account_is_staff check (account = 'team_member' or kind = 'staff');
comment on column core.person.account is 'team_member, or the owner''s admin_account (V444) or the test_account (V445) — never a team member: not in team lists, KPIs, leaderboards or reports-to pickers. Set by core.person_account_set.';
-- One of each (V444: the owner's one admin account; V445: one test account).
create unique index person_one_account_of_each on core.person (account)
  where account <> 'team_member' and deleted_at is null;

-- Whether a person counts as a team member: staff, not the admin or the test account, not removed. The team lists,
-- KPIs, leaderboards and reports-to pickers ask this, never kind alone.
create function core.is_team_member(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from core.person p
                 where p.id = p_person and p.kind = 'staff' and p.account = 'team_member' and p.deleted_at is null)
$$;

-- ================================================================ nobody reports to either account
-- A manager chain never loops; a person's team is in their department; a manager is a team member (V444, V445).
create or replace function core.person_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cur uuid := new.manager_id;
  hops int := 0;
begin
  if new.team_id is not null
     and not exists (select 1 from core.team t where t.id = new.team_id and t.department_id = new.department_id) then
    raise exception using errcode = 'P0001', message = 'person.team_outside_department';
  end if;
  if new.manager_id is distinct from old.manager_id and new.manager_id is not null
     and not core.is_team_member(new.manager_id) then
    raise exception using errcode = 'P0001', message = 'person.manager_not_team_member';
  end if;
  while cur is not null and hops < 1000 loop
    if cur = new.id then
      raise exception using errcode = 'P0001', message = 'person.manager_cycle';
    end if;
    select p.manager_id into cur from core.person p where p.id = cur;
    hops := hops + 1;
  end loop;
  return new;
end
$$;

-- ================================================================ setting it: admins only, with a reason
-- Marks a person as the admin account or the test account, or back to a team member. Refused while anyone reports to
-- them (person.has_reports — move those people first), for anyone but staff, and for a second of either (23505
-- person.account_taken). One logged request, undone like any other.
create function core.person_account_set(p_id uuid, p_account text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
  req uuid;
begin
  if p_reason is null or pg_catalog.btrim(p_reason) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if p_account is null or p_account not in ('team_member', 'admin_account', 'test_account') then
    raise exception using errcode = 'P0001', message = 'person.unknown_account', detail = p_account;
  end if;
  if not exists (select 1 from core.person p where p.id = p_id and p.kind = 'staff' and p.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_account <> 'team_member'
     and exists (select 1 from core.person p where p.manager_id = p_id and p.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'person.has_reports';
  end if;
  if p_account <> 'team_member' and exists (select 1 from core.person p where p.account = p_account
                                            and p.id <> p_id and p.deleted_at is null) then
    raise exception using errcode = '23505', message = 'person.account_taken', detail = p_account;
  end if;
  req := audit.begin('ui', 'person.account_set', pg_catalog.jsonb_build_object('account', p_account), p_reason);
  update core.person set account = p_account where id = p_id and account is distinct from p_account;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'account', p_account,
                                       'version', (select p.version from core.person p where p.id = p_id),
                                       'request_id', req);
end
$$;

-- ================================================================ the organisation and the people list name it
create or replace function core.org() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  return pg_catalog.jsonb_build_object(
    'departments', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', d.id, 'code', d.code, 'name_en', d.name_en, 'name_ar', d.name_ar, 'head_person_id', d.head_person_id,
        'active', d.active, 'version', d.version) order by d.name_en)
      from core.department d where d.deleted_at is null), '[]'::jsonb),
    'teams', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', t.id, 'department_id', t.department_id, 'code', t.code, 'name_en', t.name_en, 'name_ar', t.name_ar,
        'lead_person_id', t.lead_person_id, 'active', t.active, 'retired_at', t.retired_at,
        'retired_into_team_id', t.retired_into_team_id, 'version', t.version) order by t.name_en)
      from core.team t), '[]'::jsonb),
    'roles', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', r.id, 'key', r.key, 'name_en', r.name_en, 'name_ar', r.name_ar, 'sort', r.sort, 'is_admin', r.is_admin,
        'active', r.active, 'version', r.version) order by r.sort, r.key)
      from core.role r), '[]'::jsonb),
    'people', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', p.id, 'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar,
        'nickname_en', p.nickname_en, 'nickname_ar', p.nickname_ar,
        'display_name_en', coalesce(pr.display_name_en, p.nickname_en, p.full_name_en),
        'display_name_ar', coalesce(pr.display_name_ar, p.nickname_ar, p.full_name_ar),
        'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
        'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id,
        'avatar_color', pr.avatar_color, 'avatar_file_id', pr.avatar_file_id, 'badge_kind', pr.badge_kind,
        'badge_value', pr.badge_value, 'account', p.account) order by pg_catalog.lower(p.full_name_en))
      from core.person p left join core.person_profile pr on pr.person_id = p.id
      where p.kind = 'staff' and p.active and p.deleted_at is null), '[]'::jsonb));
end
$$;

create or replace function core.people() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('settings.org', 'view');
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', p.id, 'full_name_en', p.full_name_en, 'full_name_ar', p.full_name_ar, 'nickname_en', p.nickname_en,
      'nickname_ar', p.nickname_ar, 'job_title_en', p.job_title_en, 'job_title_ar', p.job_title_ar,
      'department_id', p.department_id, 'team_id', p.team_id, 'manager_id', p.manager_id, 'joined_on', p.joined_on,
      'left_on', p.left_on, 'can_sign_in', p.can_sign_in, 'active', p.active, 'account', p.account,
      'version', p.version,
      'role', case when r.id is null then null
                   else pg_catalog.jsonb_build_object('id', r.id, 'key', r.key, 'is_admin', r.is_admin) end,
      'emails', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                  'id', e.id, 'email', e.email, 'is_primary', e.is_primary) order by e.is_primary desc, e.email)
                from core.person_email e where e.person_id = p.id and e.deleted_at is null), '[]'::jsonb),
      'last_sign_in_at', (select pg_catalog.max(l.at) from core.sign_in_log l
                          where l.person_id = p.id and l.result = 'ok'))
      order by pg_catalog.lower(p.full_name_en))
    from core.person p left join core.role r on r.id = p.role_id
    where p.kind = 'staff' and p.deleted_at is null), '[]'::jsonb);
end
$$;

-- ================================================================ the wrappers and grants (V124)
create function api.person_account_set(p_id uuid, p_account text, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select core.person_account_set(p_id, p_account, p_reason) $$;

revoke all on function core.is_team_member(uuid), core.person_account_set(uuid, text, text),
  api.person_account_set(uuid, text, text) from public;
grant execute on function core.person_account_set(uuid, text, text), api.person_account_set(uuid, text, text)
  to authenticated;
