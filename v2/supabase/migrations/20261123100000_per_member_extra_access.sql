-- Landing 40 — per-member settings (the owner's approved design of 22 Nov 2026).
-- Roles set the basics; a person's record carries three extras, each "As their role", "Allowed" or "View only":
--   Import files on Finance     -> capability finance.import
--   Edit someone else's work    -> capability records.edit_others (new; no role holds it by default)
--   Change credit limits        -> capability finance.credit_control
-- A choice is a row of core.person_capability (none = as their role; granted = Allowed; not granted = View only),
-- written by the access doors that already exist (reason required, logged). No data is changed here.
-- A Viewer stays view-only: core.extra_access never answers yes for one, and "Allowed" is refused on a Viewer.

-- One reading of an extra, for every rule below: the capability as the person holds it, never for a Viewer.
create function core.extra_access(p_person uuid, p_capability text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return authz.can_of(p_person, p_capability)
     and not exists (select 1 from core.person p join core.role r on r.id = p.role_id
                     where p.id = p_person and r.key = 'viewer');
end
$$;
comment on function core.extra_access(uuid, text) is 'Landing 40: whether a person holds an extra (their own setting, else their role''s) — never a Viewer.';
revoke all on function core.extra_access(uuid, text) from public;

-- ---------------------------------------------------------------- Import files on Finance
-- Until now the import ran for anyone with Finance at Full. It is a specific extra: Admin and Head by role, and
-- whoever is set to "Allowed". Finance at Full is still needed (the import functions check it themselves).
create function work.import_require() returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.require_capability('finance.import');
begin
  if not core.extra_access(me, 'finance.import') then
    raise exception using errcode = '42501', message = 'access.needs_capability',
      detail = pg_catalog.jsonb_build_object('capability', 'finance.import')::text;
  end if;
end
$$;
comment on function work.import_require() is 'Landing 40: importing needs the extra finance.import (Admin and Head by role, or a person set to Allowed).';
revoke all on function work.import_require() from public;
grant execute on function work.import_require() to authenticated;

create or replace function api.import_batch_start(p_partner uuid, p_signature text, p_file_name text,
  p_source_promo text default null) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
begin
  perform work.import_require();
  return work.import_batch_start(p_partner, p_signature, p_file_name, p_source_promo);
end
$$;
create or replace function api.import_apply(p_batch uuid, p_rows jsonb, p_held jsonb default '[]'::jsonb,
  p_decisions jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security invoker set search_path = '' as $$
begin
  perform work.import_require();
  return work.import_apply(p_batch, p_rows, p_held, p_decisions);
end
$$;

-- ---------------------------------------------------------------- Change credit limits
-- The company-wide limit of Settings -> Finance: the person's own setting on finance.credit_control decides when
-- there is one; otherwise the role rule of Landing 31 stands (a manager, a head, an admin). Never a Viewer.
create or replace function finance.credit_limit_can_change(p_person uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from core.person p join core.role r on r.id = p.role_id
    where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
      and (r.is_admin
           or (r.key <> 'viewer'
               and coalesce((select x.granted from core.person_capability x
                             where x.person_id = p.id and x.capability_key = 'finance.credit_control'
                               and x.deleted_at is null),
                            r.key in ('head', 'manager')))))
$$;
comment on function finance.credit_limit_can_change(uuid) is 'Landing 40: whether a person may change the credit limit of Settings -> Finance — their own setting on finance.credit_control when there is one, else a manager, a head or an admin; never a Viewer.';

-- ---------------------------------------------------------------- A Viewer is never set to "Allowed"
create or replace function core.access_set_person_capability(p_person uuid, p_capability text, p_granted boolean,
                                                  p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := core.access_guard(p_person);
  why text := core.access_reason(p_reason);
  req uuid;
  x core.person_capability;
begin
  if not exists (select 1 from core.capability c where c.key = p_capability and c.active) then
    raise exception using errcode = 'P0002', message = 'access.unknown_capability', detail = p_capability;
  end if;
  -- Landing 40: a Viewer stays view-only — no extra is granted to one; their role changes instead.
  if p_granted and exists (select 1 from core.person p join core.role r on r.id = p.role_id
                           where p.id = p_person and r.key = 'viewer') then
    raise exception using errcode = '42501', message = 'access.viewer_stays_view_only';
  end if;
  if p_granted then
    perform core.access_can_grant(me, p_capability);
  end if;
  req := audit.begin('ui', 'access.person_capability_set',
                     pg_catalog.jsonb_build_object('capability', p_capability, 'granted', p_granted), why);
  update core.person_capability set granted = p_granted, reason = why
  where person_id = p_person and capability_key = p_capability and deleted_at is null
  returning * into x;
  if x.id is null then
    insert into core.person_capability (person_id, capability_key, granted, reason)
    values (p_person, p_capability, p_granted, why)
    returning * into x;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', x.id, 'version', x.version, 'request_id', req);
end
$$;

-- ---------------------------------------------------------------- Edit someone else's work
-- "Allowed" lets a person write what their Own level lets them see, as Full does on that page; nothing a role gives
-- today is taken away (a manager's team work, a head's Full pages). Finance entries keep their page-level rule.
create or replace function core.may_write(p_table text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  e core.entity;
  lv core.level;
begin
  select * into e from core.entity where table_name = p_table and active;
  if me is null or e.id is null then
    return false;
  end if;
  if authz.is_admin() then
    return true;
  end if;
  -- A discount code's files are the codes page's: only a Full codes reader may change them (the upload is gated
  -- on Full in the UI). Added acceptance, not a replacement — the rule below still applies.
  if p_table = 'partner.identifier'
     and exists (select 1 from partner.identifier i where i.id = p_id and i.kind = 'discount_code')
     and authz.level_of(me, 'codes') = 'full' then
    return true;
  end if;
  lv := case when e.page_key is null and e.level is null then 'own'::core.level
             else authz.record_level(me, p_table, p_id) end;
  -- Landing 40: a person with the extra "Edit someone else's work" writes what their Own level lets them see.
  return lv = 'full' or (lv >= 'own' and (me = any (core.owners_of(p_table, p_id)) or core.extra_access(me, 'records.edit_others')));
end
$$;

create or replace function work.can_edit_task(p_person uuid, t work.task) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select case work.row_level('work.task', t.id, p_person)
               when 'full' then true
               when 'own' then p_person = t.owner_id or p_person = t.created_by
                              or core.extra_access(p_person, 'records.edit_others')
               else false end
  );
end
$fn$;

create or replace function perf.can_edit(p_person uuid, a perf.achievement) returns boolean
language sql stable security definer set search_path = ''
as $$
  select case perf.row_level('perf.achievement', a.id, p_person)
           when 'full' then true
           when 'own' then perf.is_own(p_person, a) or core.extra_access(p_person, 'records.edit_others')
           else false end
$$;

create or replace function partner.side_writable(p_partner uuid, p_side text) returns partner.partner
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  p partner.partner;
  lv core.level;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_side is not null and p_side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'partner.unknown_side', detail = p_side;
  end if;
  select * into p from partner.partner where id = p_partner and deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  lv := partner.level_of(me, p_partner, p_side);
  if not (authz.is_admin() or lv = 'full'
          or (lv >= 'own' and (me in (select partner.side_owners(p_partner, p_side))
                               or core.extra_access(me, 'records.edit_others')))) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', coalesce(partner.side_page(p_side),
                 (select partner.side_page(s.side) from partner.partner_side s where s.partner_id = p_partner
                  and s.deleted_at is null order by s.side limit 1), 'clients'), 'level', 'own')::text;
  end if;
  if p.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'partner.archived';
  end if;
  return p;
end
$$;

create or replace function pipeline.card_editable(p_table text, p_id uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  lvl core.level;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  lvl := pipeline.row_level(p_table, p_id, me);
  if lvl < 'view' or not exists (select 1 from pipeline.row_of(p_table, p_id) o where o.card_id is not null)
     or (p_table = 'pipeline.tender' and not exists (select 1 from pipeline.tender x where x.id = p_id and x.deleted_at is null))
     or (p_table = 'pipeline.opportunity'
         and not exists (select 1 from pipeline.opportunity x where x.id = p_id and x.deleted_at is null)) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not (lvl = 'full' or (lvl = 'own' and (me in (select pipeline.card_owners(p_table, p_id))
                                        or core.extra_access(me, 'records.edit_others')))) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'pipeline', 'level', 'own')::text;
  end if;
end
$$;
