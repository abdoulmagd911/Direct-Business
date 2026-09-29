-- v2 organisations, part 2a (P3-8b): P3-8a's roles become the two sides of V98 — Client, and Supplier & partner — before
-- anything else lands on them. One organisation record keeps what both sides share (names, logo, identifiers, contacts,
-- merge); each side has its own type (on the Client side the type is the segment — V64), tier, fields, status with
-- history and owner (the account manager on the Client side, the relationship owner on the other). Client IDs, codes
-- and credit belong to the Client side. The pages Clients and Suppliers & partners, each with its own access and
-- capabilities, replace Partners. The data moves (role client → the Client side; supplier and strategic partner → the
-- Supplier & partner side with that type; role fields → side fields; statuses and account managers → the Client side,
-- or the other side when only it is on), then the role tables are dropped. TECH-SPEC §3.4, §8; plan P3-8b; V98, V401,
-- V404, V409; V146–V149. Forward-only (V103).

-- ================================================================ the two sides, fixed in code
create function partner.side_page(p_side text) returns text
language sql immutable parallel safe set search_path = ''
as $$ select case p_side when 'client' then 'clients' when 'supplier_partner' then 'suppliers_partners' end $$;

-- The pages and capabilities the sides are reached by (the registry sync that follows writes the same rows).
insert into core.page (key, module, route, nav_group, nav_order, levels_allowed, active) values
  ('clients', 'partners', '/partners?view=clients', 'main', 30, '{none,view,own,full}', true),
  ('suppliers_partners', 'partners', '/partners?view=suppliers', 'main', 31, '{none,view,own,full}', true)
on conflict (key) do nothing;
insert into core.capability (key, page_key, active) values
  ('clients.identify', 'clients', true), ('clients.merge', 'clients', true), ('clients.assign', 'clients', true),
  ('suppliers_partners.identify', 'suppliers_partners', true), ('suppliers_partners.merge', 'suppliers_partners', true),
  ('suppliers_partners.assign', 'suppliers_partners', true)
on conflict (key) do nothing;

-- ================================================================ the sides' lists (§3.0 LIST, V98)
create table partner.side_type (
  id uuid primary key default gen_random_uuid(),
  side text not null check (side in ('client', 'supplier_partner')),
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index side_type_key on partner.side_type (side, key);
comment on table partner.side_type is 'A side''s types (V98): on the Client side the segments (V64), on the Supplier & partner side supplier, strategic partner, sales channel …';

create table partner.side_tier (like partner.side_type including all);
alter table partner.side_tier add foreign key (created_by) references core.person (id),
  add foreign key (updated_by) references core.person (id), add foreign key (deleted_by) references core.person (id);
comment on table partner.side_tier is 'A side''s tiers (V98).';

create table partner.contact_role (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
comment on table partner.contact_role is 'A contact''s role at the organisation (V401): decision maker, travel manager, booker, finance …';

alter table partner.status_reason rename to side_status_reason;
comment on table partner.side_status_reason is 'Why a side is at risk or lost (V62, V98) — a setting, per status.';

-- A side list's entry keeps its side: it is chosen on that side's records only.
create function partner.side_fixed() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.side is distinct from old.side then
    raise exception using errcode = 'P0001', message = 'partner.side_fixed';
  end if;
  return new;
end
$$;
create trigger side_fixed before update on partner.side_type for each row execute function partner.side_fixed();
create trigger side_fixed before update on partner.side_tier for each row execute function partner.side_fixed();

-- Each side's own fields (V62, V98): shown in the record's details rail; a field named like a password or a secret is
-- refused — a card holds references to Direct's systems, never passwords.
create table partner.side_field (
  id uuid primary key default gen_random_uuid(),
  side text not null check (side in ('client', 'supplier_partner')),
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label_en text not null check (pg_catalog.btrim(label_en) <> ''), label_ar text not null check (pg_catalog.btrim(label_ar) <> ''),
  type text not null check (type in ('text', 'number', 'date', 'select', 'boolean')),
  required boolean not null default false,
  options jsonb check (options is null or pg_catalog.jsonb_typeof(options) = 'array'),   -- select: [{key, en, ar}]
  sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (type <> 'select' or pg_catalog.jsonb_array_length(options) > 0),
  constraint side_field_no_secrets check (
    (key || ' ' || label_en) !~* '(^|[^a-z])(password|passcode|passwd|secret|pwd|token|pin|credentials?)([^a-z]|$)'
    and label_ar !~ '(كلمة\s*(ال)?(مرور|سر)|الرقم\s*السري)')
);
create unique index side_field_one_key on partner.side_field (side, key) where deleted_at is null;
create trigger side_fixed before update on partner.side_field for each row execute function partner.side_fixed();

-- ================================================================ an organisation's sides (V98)
-- A live row is the side switch: on from `since`, off from `until` (switching off keeps everything).
create table partner.partner_side (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner.partner (id),
  side text not null check (side in ('client', 'supplier_partner')),
  type_id uuid not null references partner.side_type (id),
  tier_id uuid references partner.side_tier (id),
  field_values jsonb not null default '{}' check (pg_catalog.jsonb_typeof(field_values) = 'object'),
  since date, until date,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (until is null or since is null or until >= since)
);
create unique index partner_side_live on partner.partner_side (partner_id, side) where deleted_at is null;
comment on table partner.partner_side is 'An organisation''s side (V98): Client, or Supplier & partner — its type, tier and fields; on from since, off from until.';

-- A side's type and tier come from that side's lists.
create function partner.side_lists_match() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.side is distinct from old.side then
    raise exception using errcode = 'P0001', message = 'partner.side_fixed';
  end if;
  if not exists (select 1 from partner.side_type t where t.id = new.type_id and t.side = new.side)
     or (new.tier_id is not null and not exists (select 1 from partner.side_tier t where t.id = new.tier_id and t.side = new.side)) then
    raise exception using errcode = 'P0001', message = 'partner.list_of_other_side', detail = new.side;
  end if;
  return new;
end
$$;
create trigger lists_match before insert or update on partner.partner_side for each row
  execute function partner.side_lists_match();

-- Whether a side is on for an organisation on a day (today by default).
create function partner.side_on(p_partner uuid, p_side text, p_on date default null) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from partner.partner_side s
                 where s.partner_id = p_partner and s.side = p_side and s.deleted_at is null
                   and (s.since is null or s.since <= coalesce(p_on, core.riyadh_today()))
                   and (s.until is null or s.until > coalesce(p_on, core.riyadh_today())))
$$;

-- A side's status with history (V62 per side): never updated — the status on a day is the latest change on or before it.
create table partner.side_status_change (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner.partner (id),
  side text not null check (side in ('client', 'supplier_partner')),
  status text not null check (status in ('prospect', 'active', 'at_risk', 'lost')),
  effective_on date not null,
  reason_id uuid references partner.side_status_reason (id),
  note text,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (status not in ('at_risk', 'lost') or reason_id is not null)
);
create index side_status_change_latest on partner.side_status_change (partner_id, side, effective_on desc, created_at desc)
  where deleted_at is null;

create function partner.side_status_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.partner_id, new.side, new.status, new.effective_on, new.reason_id, new.note)
     is distinct from (old.partner_id, old.side, old.status, old.effective_on, old.reason_id, old.note) then
    raise exception using errcode = 'P0001', message = 'partner.status_never_rewritten',
      detail = 'Add a new change with its own date instead.';
  end if;
  if tg_op = 'INSERT' and not exists (select 1 from partner.partner_side s where s.partner_id = new.partner_id
                                      and s.side = new.side and s.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'partner.side_not_on', detail = new.side;
  end if;
  if new.reason_id is not null
     and not exists (select 1 from partner.side_status_reason r where r.id = new.reason_id and r.status = new.status) then
    raise exception using errcode = 'P0001', message = 'partner.reason_not_for_status';
  end if;
  return new;
end
$$;
create trigger guard before insert or update on partner.side_status_change for each row
  execute function partner.side_status_guard();

-- A side's status on a day; null when it never had one.
create function partner.status_of(p_partner uuid, p_side text, p_on date default null) returns text
language sql stable security definer set search_path = ''
as $$
  select s.status from partner.side_status_change s
  where s.partner_id = p_partner and s.side = p_side and s.deleted_at is null
    and s.effective_on <= coalesce(p_on, core.riyadh_today())
  order by s.effective_on desc, s.created_at desc limit 1
$$;

-- A side's owner from a date (V26, V98): the account manager on the Client side, the relationship owner on the other.
create table partner.side_owner (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner.partner (id),
  side text not null check (side in ('client', 'supplier_partner')),
  person_id uuid not null references core.person (id),
  effective_from date not null,
  effective_to date,
  reason text,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (effective_to is null or effective_to > effective_from)
);
alter table partner.side_owner add constraint side_owner_one_at_a_time exclude using gist
  (partner_id with =, side with =, pg_catalog.daterange(effective_from, effective_to, '[)') with &&) where (deleted_at is null);
create trigger side_fixed before update on partner.side_owner for each row execute function partner.side_fixed();

-- ================================================================ client side only (V98)
-- Client IDs and discount codes, and credit limits, belong to the Client side: added only while it is on.
create function partner.client_side_only() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  what text := tg_table_name;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.deleted_at is null then
      return new;
    end if;
  end if;
  if tg_table_name = 'identifier' then
    what := pg_catalog.to_jsonb(new) ->> 'kind';
    if what not in ('payments_client_id', 'discount_code') then
      return new;
    end if;
  end if;
  if not partner.side_on(new.partner_id, 'client') then
    raise exception using errcode = 'P0001', message = 'partner.client_side_only', detail = what;
  end if;
  return new;
end
$$;
create trigger client_side_only before insert or update on partner.identifier for each row
  execute function partner.client_side_only();
create trigger client_side_only before insert or update on partner.credit_limit for each row
  execute function partner.client_side_only();

-- ================================================================ contacts: a role, and the sides they belong to (V401, V98)
alter table partner.contact add column role_id uuid references partner.contact_role (id),
  add column sides text[] not null default '{client,supplier_partner}'
    check (pg_catalog.cardinality(sides) > 0 and sides <@ '{client,supplier_partner}'::text[]);

-- ================================================================ every new table: guarded, watched, indexed
do $$
declare
  t text;
begin
  foreach t in array array['partner.side_type', 'partner.side_tier', 'partner.contact_role', 'partner.side_field',
                           'partner.partner_side', 'partner.side_status_change', 'partner.side_owner']
  loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;
select core.index_foreign_keys('partner');

-- ================================================================ the starting lists (V64 as amended by V404, V98, V401)
select audit.begin('system', 'partner.side_lists_seeded');
insert into partner.side_type (side, key, name_en, name_ar, sort) values
  ('client', 'government', 'Government', 'حكومي', 10), ('client', 'corporate', 'Corporate', 'الشركات', 20),
  ('client', 'agencies', 'Agencies', 'الوكالات', 30), ('client', 'individuals', 'Individuals', 'الأفراد', 40),
  ('supplier_partner', 'supplier', 'Supplier', 'مورد', 10),
  ('supplier_partner', 'strategic_partner', 'Strategic partner', 'شريك استراتيجي', 20),
  ('supplier_partner', 'sales_channel', 'Sales channel', 'قناة مبيعات', 30),
  ('supplier_partner', 'integration', 'Integration', 'تكامل تقني', 40),
  ('supplier_partner', 'payment_solution', 'Payment solution', 'حل دفع', 50);
insert into partner.contact_role (key, name_en, name_ar, sort) values
  ('decision_maker', 'Decision maker', 'صاحب القرار', 10), ('travel_manager', 'Travel manager', 'مدير السفر', 20),
  ('booker', 'Booker', 'منسق الحجوزات', 30), ('finance', 'Finance', 'المالية', 40),
  ('operations', 'Operations', 'العمليات', 50), ('technical', 'Technical', 'الدعم الفني', 60);
select audit.end();

-- ================================================================ the data moves (plan P3-8b)
select audit.begin('system', 'partner.sides_converted', null, 'V98: roles become the two sides');

-- The old lists' own entries follow: a segment the Client side had is its type; a tier becomes a Client tier.
insert into partner.side_type (side, key, name_en, name_ar, sort, active)
select 'client', s.key, s.name_en, s.name_ar, s.sort, s.active from partner.segment s
where not exists (select 1 from partner.side_type t where t.side = 'client' and t.key = s.key);
insert into partner.side_tier (side, key, name_en, name_ar, sort, active)
select 'client', t.key, t.name_en, t.name_ar, t.sort, t.active from partner.tier t;

-- The Client side: every organisation with the client role, and every one with no role at all (P3-8a let a partner be
-- made without one) — so no organisation, status or owner is left without a side. Its type is the old segment, else
-- Corporate.
insert into partner.partner_side (partner_id, side, type_id, tier_id, field_values, since, until)
select p.id, 'client',
       coalesce((select t.id from partner.segment s join partner.side_type t on t.side = 'client' and t.key = s.key
                 where s.id = p.segment_id),
                (select t.id from partner.side_type t where t.side = 'client' and t.key = 'corporate')),
       (select t.id from partner.tier o join partner.side_tier t on t.side = 'client' and t.key = o.key where o.id = p.tier_id),
       coalesce(r.field_values, '{}'), r.since, r.until
from partner.partner p
left join lateral (select x.field_values, x.since, x.until from partner.partner_role x join partner.role ro on ro.id = x.role_id
                   where x.partner_id = p.id and x.deleted_at is null and ro.key = 'client' limit 1) r on true
where p.deleted_at is null
  and (r.field_values is not null
       or not exists (select 1 from partner.partner_role x join partner.role ro on ro.id = x.role_id
                      where x.partner_id = p.id and x.deleted_at is null
                        and ro.key in ('client', 'supplier', 'strategic_partner')));

-- The Supplier & partner side: the supplier and strategic partner roles, one side — strategic partner wins the type.
insert into partner.partner_side (partner_id, side, type_id, field_values, since, until)
select x.partner_id, 'supplier_partner',
       (select t.id from partner.side_type t where t.side = 'supplier_partner'
          and t.key = case when bool_or(ro.key = 'strategic_partner') then 'strategic_partner' else 'supplier' end),
       coalesce(pg_catalog.jsonb_object_agg(k.key, k.value) filter (where k.key is not null), '{}'),
       min(x.since), case when bool_and(x.until is not null) then max(x.until) end
from partner.partner_role x
join partner.role ro on ro.id = x.role_id and ro.key in ('supplier', 'strategic_partner')
left join lateral pg_catalog.jsonb_each(x.field_values) k on true
where x.deleted_at is null
group by x.partner_id;

-- Role fields become the fields of the side their role moved to.
insert into partner.side_field (side, key, label_en, label_ar, type, required, options, sort)
select distinct on (side, f.key) case ro.key when 'client' then 'client' else 'supplier_partner' end as side,
       f.key, f.label_en, f.label_ar, f.type, f.required, f.options, f.sort
from partner.role_field f join partner.role ro on ro.id = f.role_id
where f.deleted_at is null and ro.key in ('client', 'supplier', 'strategic_partner')
order by side, f.key, ro.sort;

-- Statuses and account managers go to the Client side, or to the other side when only it is on.
insert into partner.side_status_change (partner_id, side, status, effective_on, reason_id, note)
select s.partner_id,
       case when exists (select 1 from partner.partner_side x where x.partner_id = s.partner_id and x.side = 'client'
                         and x.deleted_at is null) then 'client' else 'supplier_partner' end,
       s.status, s.effective_on, s.reason_id, s.note
from partner.status_change s
where s.deleted_at is null and exists (select 1 from partner.partner_side x where x.partner_id = s.partner_id and x.deleted_at is null);
insert into partner.side_owner (partner_id, side, person_id, effective_from, effective_to, reason)
select m.partner_id,
       case when exists (select 1 from partner.partner_side x where x.partner_id = m.partner_id and x.side = 'client'
                         and x.deleted_at is null) then 'client' else 'supplier_partner' end,
       m.person_id, m.effective_from, m.effective_to, m.reason
from partner.account_manager m
where m.deleted_at is null and exists (select 1 from partner.partner_side x where x.partner_id = m.partner_id and x.deleted_at is null);

-- Who could reach Partners reaches both pages; who held a Partners capability holds it on both sides.
insert into core.role_page_level (role_id, page_key, level)
select l.role_id, pg.key, l.level from core.role_page_level l cross join (values ('clients'), ('suppliers_partners')) pg(key)
where l.page_key = 'partners' and l.deleted_at is null
  and not exists (select 1 from core.role_page_level x where x.role_id = l.role_id and x.page_key = pg.key and x.deleted_at is null);
insert into core.person_page_level (person_id, page_key, level, reason)
select l.person_id, pg.key, l.level, l.reason from core.person_page_level l cross join (values ('clients'), ('suppliers_partners')) pg(key)
where l.page_key = 'partners' and l.deleted_at is null
  and not exists (select 1 from core.person_page_level x where x.person_id = l.person_id and x.page_key = pg.key and x.deleted_at is null);
insert into core.role_capability (role_id, capability_key, granted)
select c.role_id, s.page || '.' || pg_catalog.split_part(c.capability_key, '.', 2), c.granted
from core.role_capability c cross join (values ('clients'), ('suppliers_partners')) s(page)
where c.capability_key in ('partners.identify', 'partners.merge', 'partners.assign') and c.deleted_at is null
  and not exists (select 1 from core.role_capability x where x.role_id = c.role_id and x.deleted_at is null
                  and x.capability_key = s.page || '.' || pg_catalog.split_part(c.capability_key, '.', 2));
insert into core.person_capability (person_id, capability_key, granted, reason)
select c.person_id, s.page || '.' || pg_catalog.split_part(c.capability_key, '.', 2), c.granted, c.reason
from core.person_capability c cross join (values ('clients'), ('suppliers_partners')) s(page)
where c.capability_key in ('partners.identify', 'partners.merge', 'partners.assign') and c.deleted_at is null
  and not exists (select 1 from core.person_capability x where x.person_id = c.person_id and x.deleted_at is null
                  and x.capability_key = s.page || '.' || pg_catalog.split_part(c.capability_key, '.', 2));
-- Saved views, default views and "since your last visit" on Partners belong to the Clients list now.
update core.saved_view set page_key = 'clients' where page_key = 'partners';
update core.person_default_view d set page_key = 'clients'
where d.page_key = 'partners'
  and not exists (select 1 from core.person_default_view x where x.person_id = d.person_id and x.page_key = 'clients');
update core.person_last_seen l set page_key = 'clients'
where l.page_key = 'partners'
  and not exists (select 1 from core.person_last_seen x where x.person_id = l.person_id and x.page_key = 'clients');
select audit.end();

-- ================================================================ the role tables go
-- Their record types retire first (a retired type may name a table that is gone), then the functions that read them.
update core.entity set active = false
where table_name in ('partner.role', 'partner.role_field', 'partner.partner_role', 'partner.category', 'partner.tier',
                     'partner.segment', 'partner.status_change', 'partner.account_manager');
drop function api.partner_roles_set(uuid, jsonb, text), api.partner_status_set(uuid, text, date, uuid, text),
  api.partner_manager_set(uuid, uuid, date, text), api.partner_bulk_assign(uuid[], uuid, uuid, text);
drop function partner.roles_set(uuid, jsonb, text), partner.role_fields_check(uuid, jsonb),
  partner.status_set(uuid, text, date, uuid, text), partner.manager_set(uuid, uuid, date, text),
  partner.manager_set_inner(uuid, uuid, date, text), partner.bulk_assign(uuid[], uuid, uuid, text),
  partner.status_of(uuid, date), partner.partner_role_owners(uuid), partner.status_change_owners(uuid),
  partner.account_manager_owners(uuid);
alter table partner.partner drop column category_id, drop column tier_id, drop column segment_id;
drop table partner.partner_role, partner.role_field, partner.role, partner.status_change, partner.account_manager,
  partner.category, partner.tier, partner.segment;
drop function partner.status_guard();

-- ================================================================ owners and levels, per side
-- An organisation's owners are its sides' owners today; a side's own records are owned by that side's owner.
create function partner.side_owners(p_partner uuid, p_side text) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.person_id from partner.side_owner m
  where m.partner_id = p_partner and m.deleted_at is null and (p_side is null or m.side = p_side)
    and m.effective_from <= core.riyadh_today() and (m.effective_to is null or m.effective_to > core.riyadh_today())
$$;

create or replace function partner.owners(p_partner uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select distinct x from partner.side_owners(p_partner, null) x $$;

-- A record of an organisation: its side (a side's own row, a credit limit, a client ID or code) and its organisation.
create function partner.row_of(p_table text, p_id uuid, out partner_id uuid, out side text) returns record
language plpgsql stable security definer set search_path = ''
as $$
declare
  r jsonb;
begin
  execute pg_catalog.format('select pg_catalog.to_jsonb(t) from %s t where t.id = $1', pg_catalog.to_regclass(p_table))
    into r using p_id;
  if r is null then
    return;
  end if;
  partner_id := case p_table when 'partner.partner' then (r ->> 'id')::uuid when 'partner.merge' then (r ->> 'kept_id')::uuid
                             else (r ->> 'partner_id')::uuid end;
  side := case when p_table = 'partner.credit_limit' then 'client'
               when p_table = 'partner.identifier' and r ->> 'kind' in ('payments_client_id', 'discount_code') then 'client'
               else r ->> 'side' end;
end
$$;

create or replace function partner.owners_via(p_table text, p_id uuid) returns setof uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  o record;
begin
  o := partner.row_of(p_table, p_id);
  return query select distinct x from partner.side_owners(o.partner_id, o.side) x;
end
$$;
create or replace function partner.credit_limit_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select partner.owners_via('partner.credit_limit', p_id) $$;
create function partner.partner_side_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select partner.owners_via('partner.partner_side', p_id) $$;
create function partner.side_status_change_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select partner.owners_via('partner.side_status_change', p_id) $$;
create function partner.side_owner_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select partner.owners_via('partner.side_owner', p_id) union select m.person_id from partner.side_owner m where m.id = p_id $$;

-- A person's level on an organisation (V98): on one side, that side's page; on the organisation as a whole, the best of
-- the pages of the sides it has on — or of both pages while none is on.
create function partner.level_of(p_person uuid, p_partner uuid, p_side text default null) returns core.level
language sql stable security definer set search_path = ''
as $$
  select case
           when p_side is not null then authz.level_of(p_person, partner.side_page(p_side))
           else coalesce(
             (select pg_catalog.max(authz.level_of(p_person, partner.side_page(s.side))) from partner.partner_side s
              where s.partner_id = p_partner and s.deleted_at is null and partner.side_on(p_partner, s.side)),
             greatest(authz.level_of(p_person, 'clients'), authz.level_of(p_person, 'suppliers_partners')))
         end
$$;

-- The record types' level function (core.entity.level): an organisation's record, as its side or the whole allows.
create function partner.row_level(p_table text, p_id uuid, p_person uuid) returns core.level
language plpgsql stable security definer set search_path = ''
as $$
declare
  o record;
begin
  o := partner.row_of(p_table, p_id);
  if o.partner_id is null then
    return 'none';
  end if;
  return partner.level_of(p_person, o.partner_id, o.side);
end
$$;

-- The caller at `p_level` on an organisation (or one side of it), else refused naming the page it takes.
create function partner.require_level(p_partner uuid, p_side text, p_level core.level) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if partner.level_of(me, p_partner, p_side) < p_level then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', coalesce(partner.side_page(p_side),
                 (select partner.side_page(s.side) from partner.partner_side s where s.partner_id = p_partner
                  and s.deleted_at is null order by s.side limit 1), 'clients'), 'level', p_level)::text;
  end if;
  return me;
end
$$;

-- The caller holding a side's capability (`clients.assign` …); for the whole organisation, that of any side it has on.
create function partner.require_cap(p_partner uuid, p_side text, p_action text) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_side is not null then
    return authz.require_capability(partner.side_page(p_side) || '.' || p_action);
  end if;
  if exists (select 1 from partner.partner_side s where s.partner_id = p_partner and s.deleted_at is null
             and authz.can_of(me, partner.side_page(s.side) || '.' || p_action))
     or (not exists (select 1 from partner.partner_side s where s.partner_id = p_partner and s.deleted_at is null)
         and (authz.can_of(me, 'clients.' || p_action) or authz.can_of(me, 'suppliers_partners.' || p_action))) then
    return me;
  end if;
  raise exception using errcode = '42501', message = 'access.needs_capability',
    detail = pg_catalog.jsonb_build_object('capability', coalesce(
      (select partner.side_page(s.side) from partner.partner_side s where s.partner_id = p_partner
       and s.deleted_at is null order by s.side limit 1), 'clients') || '.' || p_action)::text;
end
$$;

-- A live organisation the caller may change as a whole (Full on the page of a side it has on — D7, helpers not locks);
-- archived and merged ones are read-only.
create or replace function partner.writable(p_id uuid) returns partner.partner
language plpgsql stable security definer set search_path = ''
as $$
declare
  p partner.partner;
begin
  if authz.me() is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into p from partner.partner where id = p_id and deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.require_level(p_id, null, 'full');
  if p.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'partner.archived';
  end if;
  return p;
end
$$;

create or replace function partner.fields(p_changes jsonb) returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare
  k text;
begin
  if p_changes is null or pg_catalog.jsonb_typeof(p_changes) <> 'object' then
    raise exception using errcode = 'P0001', message = 'partner.nothing_to_change';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_changes) loop
    if k not in ('trade_name_en', 'trade_name_ar', 'official_name_en', 'official_name_ar', 'priority_id', 'key_partner',
                 'website', 'city', 'country', 'address', 'notes', 'client_since') then
      raise exception using errcode = 'P0001', message = 'partner.unknown_field', detail = k;
    end if;
  end loop;
  if p_changes ? 'trade_name_en' and coalesce(pg_catalog.btrim(p_changes ->> 'trade_name_en'), '') = '' then
    raise exception using errcode = 'P0001', message = 'partner.trade_name_required';
  end if;
  return p_changes;
end
$$;

-- ================================================================ a side's fields, type, tier; on and off (V98)
-- A side's fields are checked against its definitions: required ones present, each of its type.
create function partner.side_fields_check(p_side text, p_values jsonb) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  f partner.side_field;
  k text;
  v jsonb;
begin
  for k in select pg_catalog.jsonb_object_keys(coalesce(p_values, '{}')) loop
    if not exists (select 1 from partner.side_field x where x.side = p_side and x.key = k and x.deleted_at is null) then
      raise exception using errcode = 'P0001', message = 'partner.unknown_side_field', detail = k;
    end if;
  end loop;
  for f in select * from partner.side_field x where x.side = p_side and x.deleted_at is null loop
    v := p_values -> f.key;
    if v is null or v = 'null'::jsonb then
      if f.required then
        raise exception using errcode = 'P0001', message = 'partner.side_field_required', detail = f.key;
      end if;
      continue;
    end if;
    if not (case f.type
              when 'text' then pg_catalog.jsonb_typeof(v) = 'string'
              when 'number' then pg_catalog.jsonb_typeof(v) = 'number'
              when 'boolean' then pg_catalog.jsonb_typeof(v) = 'boolean'
              when 'date' then pg_catalog.jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\d{4}-\d{2}-\d{2}$'
              when 'select' then exists (select 1 from pg_catalog.jsonb_array_elements(f.options) o where o -> 'key' = v)
            end) then
      raise exception using errcode = 'P0001', message = 'partner.side_field_invalid', detail = f.key;
    end if;
  end loop;
end
$$;

-- A side list's entry by id or key, active, of that side.
create function partner.side_entry(p_table text, p_side text, p_ref text) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  rid uuid;
begin
  if p_ref is null then
    return null;
  end if;
  execute pg_catalog.format('select t.id from %s t where t.side = $1 and t.active and t.deleted_at is null'
                            || ' and (t.key = $2 or t.id::text = $2)', pg_catalog.to_regclass(p_table))
    into rid using p_side, p_ref;
  if rid is null then
    raise exception using errcode = 'P0002', message = 'partner.unknown_side_entry', detail = p_ref;
  end if;
  return rid;
end
$$;

-- The side's owner from a date (V26): the one before ends that day. The revenue rule of V26/V27 (changing the Client
-- side's owner where revenue exists stays with heads and admins) joins when revenue exists (P4-2).
create function partner.side_owner_set_inner(p_id uuid, p_side text, p_person uuid, p_from date, p_reason text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  cur partner.side_owner;
begin
  if p_person is not null and not exists (select 1 from core.person x where x.id = p_person and x.kind = 'staff'
                                          and x.active and x.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into cur from partner.side_owner m
  where m.partner_id = p_id and m.side = p_side and m.deleted_at is null and m.effective_from <= p_from
    and (m.effective_to is null or m.effective_to > p_from);
  if cur.id is not null and cur.person_id is not distinct from p_person then
    return;
  end if;
  if cur.id is not null then
    if cur.effective_from = p_from then
      update partner.side_owner set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'replaced'
      where id = cur.id;
    else
      update partner.side_owner set effective_to = p_from where id = cur.id;
    end if;
  end if;
  if p_person is not null then
    begin
      insert into partner.side_owner (partner_id, side, person_id, effective_from, reason)
      values (p_id, p_side, p_person, p_from, p_reason);
    exception when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'partner.owner_later_change';
    end;
  end if;
end
$$;

-- Switch a side on, or change its type, tier, fields or start (no request of its own: the caller's). Switching on needs
-- a type and an owner (the caller unless named — naming another needs the side's assign capability).
create function partner.side_put(p_id uuid, p_side text, p_values jsonb, p_reason text) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  v jsonb := coalesce(p_values, '{}');
  cur partner.partner_side;
  k text;
  v_type uuid;
  v_tier uuid;
  v_owner uuid;
  sid uuid;
begin
  if p_side is null or p_side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'partner.unknown_side', detail = p_side;
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('type', 'type_id', 'tier', 'tier_id', 'fields', 'since', 'owner_id') then
      raise exception using errcode = 'P0001', message = 'partner.unknown_field', detail = k;
    end if;
  end loop;
  v_type := partner.side_entry('partner.side_type', p_side, coalesce(v ->> 'type_id', v ->> 'type'));
  v_tier := partner.side_entry('partner.side_tier', p_side, coalesce(v ->> 'tier_id', v ->> 'tier'));
  if v ? 'fields' then
    perform partner.side_fields_check(p_side, v -> 'fields');
  end if;
  select * into cur from partner.partner_side s where s.partner_id = p_id and s.side = p_side and s.deleted_at is null;
  if cur.id is null or not partner.side_on(p_id, p_side) then
    -- switching on
    if v_type is null and cur.id is null then
      raise exception using errcode = 'P0001', message = 'partner.side_type_required', detail = p_side;
    end if;
    if not (v ? 'fields') then
      perform partner.side_fields_check(p_side, coalesce(cur.field_values, '{}'));
    end if;
    v_owner := coalesce((v ->> 'owner_id')::uuid,
                      (select x from partner.side_owners(p_id, p_side) x limit 1), me);
    if v_owner <> me and not exists (select 1 from partner.side_owners(p_id, p_side) x where x = v_owner) then
      perform authz.require_capability(partner.side_page(p_side) || '.assign');
    end if;
  elsif v ? 'owner_id' then
    raise exception using errcode = 'P0001', message = 'partner.owner_has_its_own_door';
  end if;
  if cur.id is null then
    insert into partner.partner_side (partner_id, side, type_id, tier_id, field_values, since)
    values (p_id, p_side, v_type, v_tier, coalesce(v -> 'fields', '{}'),
            coalesce((v ->> 'since')::date, core.riyadh_today()))
    returning id into sid;
  else
    sid := cur.id;
    perform audit.write_fields('partner.partner_side', cur.id, pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'type_id', v_type, 'tier_id', v_tier, 'field_values', v -> 'fields', 'since', v -> 'since'))
      || case when partner.side_on(p_id, p_side) then '{}'::jsonb else '{"until": null}'::jsonb end);
  end if;
  if v_owner is not null then
    perform partner.side_owner_set_inner(p_id, p_side, v_owner, core.riyadh_today(), p_reason);
  end if;
  return sid;
end
$$;

create function partner.side_set(p_id uuid, p_side text, p_values jsonb, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_id);
  req uuid;
  sid uuid;
begin
  perform partner.require_level(p_id, p_side, 'full');
  req := audit.begin('ui', 'partner.side_set', pg_catalog.jsonb_build_object('side', p_side), p_reason);
  sid := partner.side_put(p_id, p_side, p_values, p_reason);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', sid, 'version', (select x.version from partner.partner_side x where x.id = sid),
                                       'request_id', req);
end
$$;

-- Switch a side off from a day (today by default): the row ends, nothing is removed. The last side stays on.
create function partner.side_off(p_id uuid, p_side text, p_until date default null, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_id);
  cur partner.partner_side;
  day date := coalesce(p_until, core.riyadh_today());
  req uuid;
begin
  perform partner.require_level(p_id, p_side, 'full');
  select * into cur from partner.partner_side s where s.partner_id = p_id and s.side = p_side and s.deleted_at is null;
  if cur.id is null or not partner.side_on(p_id, p_side) then
    raise exception using errcode = 'P0001', message = 'partner.side_not_on', detail = p_side;
  end if;
  if not exists (select 1 from partner.partner_side s where s.partner_id = p_id and s.side <> p_side
                 and s.deleted_at is null and partner.side_on(p_id, s.side)) then
    raise exception using errcode = 'P0001', message = 'partner.last_side';
  end if;
  if cur.since is not null and day < cur.since then
    raise exception using errcode = 'P0001', message = 'partner.side_off_before_on';
  end if;
  req := audit.begin('ui', 'partner.side_off', pg_catalog.jsonb_build_object('side', p_side), p_reason);
  perform audit.write_fields('partner.partner_side', cur.id, pg_catalog.jsonb_build_object('until', day));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cur.id, 'request_id', req);
end
$$;

-- A side's own fields (Settings → Clients and Suppliers & partners, admins — V97). A key and a side never change.
create function partner.side_field_save(p_id uuid, p_values jsonb, p_version int default null, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.partners', 'full');
  cur partner.side_field;
  k text;
  req uuid;
  fid uuid;
  what text;
begin
  if p_values is null or pg_catalog.jsonb_typeof(p_values) <> 'object' then
    raise exception using errcode = 'P0001', message = 'list.nothing_to_change';
  end if;
  for k in select pg_catalog.jsonb_object_keys(p_values) loop
    if k not in ('side', 'key', 'label_en', 'label_ar', 'type', 'required', 'options', 'sort') then
      raise exception using errcode = 'P0001', message = 'list.unknown_field', detail = k;
    end if;
  end loop;
  begin
    if p_id is null then
      req := audit.begin('ui', 'partner.side_field_saved', null, p_reason);
      insert into partner.side_field (side, key, label_en, label_ar, type, required, options, sort)
      select x.side, x.key, x.label_en, x.label_ar, x.type, coalesce(x.required, false), x.options, coalesce(x.sort, 0)
      from pg_catalog.jsonb_populate_record(null::partner.side_field, p_values) x
      returning id into fid;
    else
      select * into cur from partner.side_field where id = p_id and deleted_at is null;
      if cur.id is null then
        raise exception using errcode = 'P0002', message = 'common.not_found';
      end if;
      if (p_values ? 'key' and p_values ->> 'key' is distinct from cur.key)
         or (p_values ? 'side' and p_values ->> 'side' is distinct from cur.side) then
        raise exception using errcode = 'P0001', message = 'list.key_fixed';
      end if;
      perform core.check_version('partner.side_field', p_id, p_version,
        (select pg_catalog.array_agg(c) from pg_catalog.jsonb_object_keys(p_values) c
         where (pg_catalog.to_jsonb(cur) -> c) is distinct from (p_values -> c)));
      req := audit.begin('ui', 'partner.side_field_saved', null, p_reason);
      perform audit.write_fields('partner.side_field', p_id, p_values);
      fid := p_id;
    end if;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'list.key_taken', detail = p_values ->> 'key';
    when check_violation then
      get stacked diagnostics what = constraint_name;
      if what = 'side_field_no_secrets' then
        raise exception using errcode = 'P0001', message = 'partner.no_secrets',
          detail = 'Cards hold references to Direct''s systems, never passwords.';
      end if;
      raise exception using errcode = 'P0001', message = 'list.invalid', detail = coalesce(nullif(what, ''), sqlerrm);
    when not_null_violation then
      get stacked diagnostics what = column_name;
      raise exception using errcode = 'P0001', message = 'list.invalid', detail = coalesce(nullif(what, ''), sqlerrm);
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', fid, 'version', (select x.version from partner.side_field x where x.id = fid),
                                       'request_id', req);
end
$$;

-- ================================================================ status and owner, per side (V62, V26, V98)
-- The side's owner and anyone holding the side's assign capability set its status; at risk and lost need a reason.
create function partner.side_status_set(p_id uuid, p_side text, p_status text, p_effective_on date default null,
                                        p_reason_id uuid default null, p_note text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_id);
  me uuid := authz.me();
  req uuid;
  sid uuid;
begin
  if not (me in (select partner.side_owners(p_id, p_side))) then
    perform authz.require_capability(partner.side_page(p_side) || '.assign');
  end if;
  if p_status in ('at_risk', 'lost') and p_reason_id is null then
    raise exception using errcode = 'P0001', message = 'partner.status_reason_required';
  end if;
  req := audit.begin('ui', 'partner.status_set', pg_catalog.jsonb_build_object('side', p_side, 'status', p_status), p_note);
  insert into partner.side_status_change (partner_id, side, status, effective_on, reason_id, note)
  values (p_id, p_side, p_status, coalesce(p_effective_on, core.riyadh_today()), p_reason_id, p_note)
  returning id into sid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', sid, 'status', partner.status_of(p_id, p_side), 'request_id', req);
end
$$;

create function partner.side_owner_set(p_id uuid, p_side text, p_person uuid, p_from date default null,
                                       p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_id);
  req uuid;
begin
  perform authz.require_capability(partner.side_page(p_side) || '.assign');
  if not exists (select 1 from partner.partner_side s where s.partner_id = p_id and s.side = p_side and s.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'partner.side_not_on', detail = p_side;
  end if;
  req := audit.begin('ui', 'partner.owner_set', pg_catalog.jsonb_build_object('side', p_side), p_reason);
  perform partner.side_owner_set_inner(p_id, p_side, p_person, coalesce(p_from, core.riyadh_today()), p_reason);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- Assign one side's owner and the priority to many organisations in one action (V63): one request, one Undo; a side
-- with no status becomes a Prospect.
create function partner.bulk_assign(p_ids uuid[], p_side text, p_owner uuid, p_priority uuid, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require(partner.side_page(p_side), 'full');
  pid uuid;
  req uuid;
  n int := 0;
begin
  perform authz.require_capability(partner.side_page(p_side) || '.assign');
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if p_priority is not null and not exists (select 1 from work.priority x where x.id = p_priority and x.active) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'partner.bulk_assigned',
                     pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids), 'side', p_side), p_reason);
  foreach pid in array p_ids loop
    perform partner.writable(pid);
    if not partner.side_on(pid, p_side) then
      raise exception using errcode = 'P0001', message = 'partner.side_not_on',
        detail = (select x.number from partner.partner x where x.id = pid);
    end if;
    if p_owner is not null then
      perform partner.side_owner_set_inner(pid, p_side, p_owner, core.riyadh_today(), p_reason);
    end if;
    if p_priority is not null then
      update partner.partner set priority_id = p_priority where id = pid;
    end if;
    if partner.status_of(pid, p_side) is null then
      insert into partner.side_status_change (partner_id, side, status, effective_on)
      values (pid, p_side, 'prospect', core.riyadh_today());
    end if;
    n := n + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', n, 'request_id', req);
end
$$;

-- ================================================================ create, change (V134 as reshaped)
-- An organisation is created with at least one side on, each with its type and owner.
create or replace function partner.partner_create(p_partner jsonb, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  pv jsonb;
  fmt jsonb := core.setting_at('partner.id_format', null, core.riyadh_today());
  pid uuid;
  num text;
  req uuid;
  s jsonb;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if pg_catalog.jsonb_typeof(p_partner -> 'sides') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_partner -> 'sides') = 0 then
    raise exception using errcode = 'P0001', message = 'partner.side_required';
  end if;
  for s in select * from pg_catalog.jsonb_array_elements(p_partner -> 'sides') loop
    if s ->> 'side' is null or s ->> 'side' not in ('client', 'supplier_partner') then
      raise exception using errcode = 'P0001', message = 'partner.unknown_side', detail = s ->> 'side';
    end if;
    perform authz.require(partner.side_page(s ->> 'side'), 'full');
  end loop;
  pv := partner.fields(p_partner - 'sides');
  if not (pv ? 'trade_name_en') then
    raise exception using errcode = 'P0001', message = 'partner.trade_name_required';
  end if;
  req := audit.begin('ui', 'partner.created', null, p_reason);
  -- organisation numbers never restart: the counter's year 2000 row is their all-time row
  num := (fmt ->> 'prefix') || '-' || pg_catalog.lpad(core.next_number('partner', 2000)::text, coalesce((fmt ->> 'width')::int, 4), '0');
  insert into partner.partner (number, trade_name_en, trade_name_ar, official_name_en, official_name_ar, priority_id,
                               key_partner, website, city, country, address, notes, client_since)
  select num, pg_catalog.btrim(x.trade_name_en), x.trade_name_ar, x.official_name_en, x.official_name_ar, x.priority_id,
         coalesce(x.key_partner, false), x.website, x.city, x.country, x.address, x.notes, x.client_since
  from pg_catalog.jsonb_populate_record(null::partner.partner, pv) x
  returning id into pid;
  perform partner.names_sync(pid, p_reason);
  for s in select * from pg_catalog.jsonb_array_elements(p_partner -> 'sides') loop
    perform partner.side_put(pid, s ->> 'side', s - 'side', p_reason);
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'number', num, 'version', 1, 'request_id', req);
end
$$;

-- ================================================================ identifiers and codes, per side (V133, V98)
-- Client IDs and codes are the Client side's: `clients.identify`. The rest are shared: the identify capability of a
-- side the organisation has on.
create or replace function partner.identifier_add(p_partner uuid, p_kind text, p_value text, p_reason text,
                                                  p_subkind text default null, p_valid_from date default null,
                                                  p_valid_to date default null, p_note text default null,
                                                  p_second_code boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_partner);
  client_only boolean := p_kind in ('payments_client_id', 'discount_code');
  why text;
  req uuid;
  iid uuid;
begin
  perform partner.require_cap(p_partner, case when client_only then 'client' end, 'identify');
  why := core.access_reason(p_reason);
  if p_kind = 'name' and p_subkind is distinct from 'alias' then
    raise exception using errcode = 'P0001', message = 'identifier.name_follows_partner';
  end if;
  if p_kind = 'discount_code'
     and coalesce((core.setting_at('partner.one_code_per_partner', null, core.riyadh_today()) #>> '{}')::boolean, true)
     and exists (select 1 from partner.identifier i where i.partner_id = p_partner and i.kind = 'discount_code'
                 and i.deleted_at is null
                 and pg_catalog.daterange(i.valid_from, i.valid_to, '[]') && pg_catalog.daterange(p_valid_from, p_valid_to, '[]')) then
    if not p_second_code then
      raise exception using errcode = 'P0001', message = 'identifier.one_code_per_partner';
    end if;
    perform authz.require_capability('clients.assign');
  end if;
  req := audit.begin('ui', 'identifier.added', pg_catalog.jsonb_build_object('kind', p_kind), why);
  iid := partner.identifier_insert(p_partner, p_kind, p_value, p_subkind, why, 'person', p_valid_from, p_valid_to, p_note);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', iid, 'request_id', req);
end
$$;

create or replace function partner.identifier_remove(p_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  i partner.identifier;
  why text;
  req uuid;
begin
  select * into i from partner.identifier where id = p_id and deleted_at is null;
  if i.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.writable(i.partner_id);
  perform partner.require_cap(i.partner_id, case when i.kind in ('payments_client_id', 'discount_code') then 'client' end,
                              'identify');
  why := core.access_reason(p_reason);
  if i.kind = 'name' and i.subkind <> 'alias' then
    raise exception using errcode = 'P0001', message = 'identifier.name_follows_partner';
  end if;
  req := audit.begin('ui', 'identifier.removed', pg_catalog.jsonb_build_object('kind', i.kind), why);
  update partner.identifier set deleted_at = pg_catalog.now(), deleted_by = authz.me(), delete_reason = why where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

-- "Individual (not an organisation)" (D25) and campaign codes and code terms (V65) are Client-side matters.
create or replace function partner.individual_add(p_name text, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('clients', 'full');
  k text := norm.name_key(p_name, partner.stop_words());
  req uuid;
  iid uuid;
begin
  perform authz.require_capability('clients.identify');
  if k is null then
    raise exception using errcode = 'P0001', message = 'identifier.empty_key', detail = 'name';
  end if;
  if exists (select 1 from partner.identifier i where i.kind = 'name' and i.value_key = k and i.deleted_at is null) then
    raise exception using errcode = '23505', message = 'identifier.held', detail = partner.holder('name', k);
  end if;
  req := audit.begin('ui', 'individual.added', null, p_reason);
  begin
    insert into partner.individual_name (name_raw, name_key, reason) values (pg_catalog.btrim(p_name), k, p_reason)
    returning id into iid;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'individual.already_listed', detail = p_name;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', iid, 'request_id', req);
end
$$;

create or replace function partner.campaign_code_add(p_code text, p_name text, p_valid_from date, p_valid_to date,
                                                     p_owner uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('clients', 'full');
  why text;
  k text := norm.code_key(p_code);
  req uuid;
  cid uuid;
begin
  perform authz.require_capability('clients.identify');
  why := core.access_reason(p_reason);
  if k is null then
    raise exception using errcode = 'P0001', message = 'identifier.empty_key', detail = 'discount_code';
  end if;
  req := audit.begin('ui', 'campaign_code.added', null, why);
  begin
    insert into partner.campaign_code (code_raw, code_key, name, valid_from, valid_to, owner_id, reason)
    values (pg_catalog.btrim(p_code), k, p_name, p_valid_from, p_valid_to, p_owner, why) returning id into cid;
  exception when exclusion_violation then
    raise exception using errcode = '23505', message = 'identifier.held', detail = p_code;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'request_id', req);
end
$$;

create or replace function partner.code_terms_add(p_identifier uuid, p_campaign uuid, p_fee_percent numeric,
                                                  p_approved_by uuid, p_approved_on date, p_effective_from date,
                                                  p_services uuid[] default '{}', p_countries text[] default '{}',
                                                  p_tiers jsonb default '[]', p_review_on date default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('clients', 'full');
  req uuid;
  tid uuid;
begin
  perform authz.require_capability('clients.identify');
  if p_identifier is not null and not exists (select 1 from partner.identifier i where i.id = p_identifier
                                              and i.kind = 'discount_code' and i.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'code_terms.added', null, null);
  insert into partner.code_terms (identifier_id, campaign_code_id, fee_percent, services, countries, tiers, review_on,
                                  approved_by, approved_on, effective_from)
  values (p_identifier, p_campaign, p_fee_percent, coalesce(p_services, '{}'), coalesce(p_countries, '{}'),
          coalesce(p_tiers, '[]'), p_review_on, p_approved_by, p_approved_on, p_effective_from)
  returning id into tid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', tid, 'request_id', req);
end
$$;

-- ================================================================ contacts (V401, V98), credit (V70)
create or replace function partner.contact_save(p_partner uuid, p_id uuid, p_values jsonb, p_version int default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_partner);
  c partner.contact;
  k text;
  req uuid;
  cid uuid;
begin
  for k in select pg_catalog.jsonb_object_keys(coalesce(p_values, '{}')) loop
    if k not in ('name_en', 'name_ar', 'job_title', 'email', 'phone', 'notes', 'is_primary', 'role_id', 'sides') then
      raise exception using errcode = 'P0001', message = 'contact.unknown_field', detail = k;
    end if;
  end loop;
  if p_values ? 'role_id' and p_values ->> 'role_id' is not null
     and not exists (select 1 from partner.contact_role r where r.id = (p_values ->> 'role_id')::uuid and r.active
                     and r.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'contact.unknown_role';
  end if;
  begin
    if p_id is null then
      req := audit.begin('ui', 'contact.saved', null, null);
      insert into partner.contact (partner_id, name_en, name_ar, job_title, email, phone, notes, is_primary, role_id, sides)
      select p_partner, x.name_en, x.name_ar, x.job_title, x.email, x.phone, x.notes, coalesce(x.is_primary, false),
             x.role_id, coalesce(x.sides, '{client,supplier_partner}')
      from pg_catalog.jsonb_populate_record(null::partner.contact, p_values) x
      returning id into cid;
    else
      select * into c from partner.contact where id = p_id and partner_id = p_partner and deleted_at is null;
      if c.id is null then
        raise exception using errcode = 'P0002', message = 'common.not_found';
      end if;
      perform core.check_version('partner.contact', p_id, p_version,
        (select pg_catalog.array_agg(k2) from pg_catalog.jsonb_object_keys(p_values) k2 where (pg_catalog.to_jsonb(c) -> k2) is distinct from (p_values -> k2)));
      req := audit.begin('ui', 'contact.saved', null, null);
      perform audit.write_fields('partner.contact', p_id, p_values);
      cid := p_id;
    end if;
  exception
    when not_null_violation or check_violation then
      raise exception using errcode = 'P0001', message = 'contact.name_required';
    when unique_violation then
      raise exception using errcode = '23505', message = 'contact.one_primary';
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'version', (select x.version from partner.contact x where x.id = cid),
                                       'request_id', req);
end
$$;

create or replace function partner.contacts_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  pid uuid;
  req uuid;
  n int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if exists (select 1 from pg_catalog.unnest(p_ids) i(id) where not exists (
               select 1 from partner.contact c join partner.partner p on p.id = c.partner_id
               where c.id = i.id and c.deleted_at is null and p.archived_at is null)) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  for pid in select distinct c.partner_id from partner.contact c where c.id = any (p_ids) loop
    perform partner.writable(pid);
  end loop;
  req := audit.begin('ui', 'contact.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update partner.contact set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics n = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', n, 'request_id', req);
end
$$;

-- The credit limit from a date (finance.credit_control — V70), on the Client side (Full on Clients; the side on).
create or replace function partner.credit_limit_set(p_partner uuid, p_amount numeric, p_effective_from date,
                                                    p_approved_by uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_partner);
  me uuid := authz.require_capability('finance.credit_control');
  why text := core.access_reason(p_reason);
  req uuid;
  cid uuid;
begin
  perform partner.require_level(p_partner, 'client', 'full');
  if p_approved_by is null or not exists (select 1 from core.person x where x.id = p_approved_by and x.kind = 'staff') then
    raise exception using errcode = 'P0001', message = 'credit.approver_required';
  end if;
  req := audit.begin('ui', 'credit_limit.set', null, why);
  update partner.credit_limit set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'replaced'
  where partner_id = p_partner and effective_from = coalesce(p_effective_from, core.riyadh_today()) and deleted_at is null;
  insert into partner.credit_limit (partner_id, amount_sar, effective_from, approved_by, reason)
  values (p_partner, p_amount, coalesce(p_effective_from, core.riyadh_today()), p_approved_by, why)
  returning id into cid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'request_id', req);
exception when check_violation then
  raise exception using errcode = 'P0001', message = 'credit.amount_invalid';
end
$$;

-- ================================================================ merge (V136 as reshaped)
-- The merge capability of a side the kept organisation has on. The merged one's identifiers move (its names as
-- aliases), its contacts move, and each side the kept one lacks is switched on with the merged side's type, tier,
-- fields, current owner and current status. The merged organisation keeps its history, is archived and points at the
-- kept one. One request, one Undo.
create or replace function partner.partner_merge(p_kept uuid, p_merged uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  kept partner.partner := partner.writable(p_kept);
  gone partner.partner := partner.writable(p_merged);
  me uuid := partner.require_cap(p_kept, null, 'merge');
  why text := core.access_reason(p_reason);
  i partner.identifier;
  s partner.partner_side;
  st text;
  req uuid;
begin
  if p_kept = p_merged then
    raise exception using errcode = 'P0001', message = 'partner.merge_itself';
  end if;
  req := audit.begin('ui', 'partner.merged', pg_catalog.jsonb_build_object('kept', kept.number, 'merged', gone.number), why);
  insert into partner.merge (kept_id, merged_id, reason, request_id) values (p_kept, p_merged, why, req);
  for s in select * from partner.partner_side x where x.partner_id = p_merged and x.deleted_at is null loop
    continue when exists (select 1 from partner.partner_side y where y.partner_id = p_kept and y.side = s.side
                          and y.deleted_at is null);
    insert into partner.partner_side (partner_id, side, type_id, tier_id, field_values, since, until)
    values (p_kept, s.side, s.type_id, s.tier_id, s.field_values, s.since, s.until);
    perform partner.side_owner_set_inner(p_kept, s.side, (select x from partner.side_owners(p_merged, s.side) x limit 1),
                                         core.riyadh_today(), why);
    st := partner.status_of(p_merged, s.side);
    if st is not null then
      insert into partner.side_status_change (partner_id, side, status, effective_on, reason_id, note)
      select p_kept, s.side, c.status, core.riyadh_today(), c.reason_id, 'merged from ' || gone.number
      from partner.side_status_change c where c.partner_id = p_merged and c.side = s.side and c.deleted_at is null
        and c.effective_on <= core.riyadh_today()
      order by c.effective_on desc, c.created_at desc limit 1;
    end if;
  end loop;
  for i in select * from partner.identifier x where x.partner_id = p_merged and x.deleted_at is null order by x.created_at loop
    update partner.identifier set deleted_at = pg_catalog.now(), deleted_by = me,
                                  delete_reason = 'merged into ' || kept.number
    where id = i.id;
    if not exists (select 1 from partner.identifier x where x.partner_id = p_kept and x.kind = i.kind
                   and x.value_key = i.value_key and x.deleted_at is null) then
      insert into partner.identifier (partner_id, kind, subkind, value_raw, value_key, norm_version, reason, source,
                                      valid_from, valid_to, note)
      values (p_kept, i.kind, case when i.kind = 'name' then 'alias' else i.subkind end, i.value_raw, i.value_key,
              i.norm_version, why, 'merge', i.valid_from, i.valid_to, i.note);
    end if;
  end loop;
  update partner.contact set partner_id = p_kept, is_primary = false where partner_id = p_merged and deleted_at is null;
  update partner.partner set archived_at = pg_catalog.now(), merged_into_id = p_kept where id = p_merged;
  perform audit.end();
  return pg_catalog.jsonb_build_object('kept', p_kept, 'merged', p_merged, 'request_id', req);
end
$$;

-- ================================================================ reading (V78, V98)
-- One side as the list, the card and the hover card show it.
create function partner.side_json(p_partner uuid, p_side text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
           'id', s.id, 'side', s.side, 'on', partner.side_on(p_partner, s.side), 'type_id', s.type_id, 'type', t.key,
           'tier_id', s.tier_id, 'fields', s.field_values, 'since', s.since, 'until', s.until, 'version', s.version,
           'status', partner.status_of(p_partner, s.side),
           'owner_id', (select x from partner.side_owners(p_partner, s.side) x limit 1))
  from partner.partner_side s join partner.side_type t on t.id = s.type_id
  where s.partner_id = p_partner and s.side = p_side and s.deleted_at is null
$$;

-- The Clients or the Suppliers & partners list (View on that side's page): the organisations with the side on, filtered
-- by type, tier, owner, status (the side's), priority, text, key partners, archived. Without a side: every organisation
-- the reader may see, whichever sides it has.
create or replace function partner.partners_list(p_filters jsonb default '{}', p_limit int default 100, p_offset int default 0)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  f jsonb := coalesce(p_filters, '{}');
  v_side text := f ->> 'side';
  me uuid;
  q text := norm.fold(f ->> 'q');
begin
  if v_side is not null and v_side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'partner.unknown_side', detail = v_side;
  end if;
  if v_side is not null then
    me := authz.require(partner.side_page(v_side), 'view');
  else
    me := authz.me();
    if me is null then
      raise exception using errcode = '42501', message = 'auth.no_active_person';
    end if;
  end if;
  return (
    with base as (
      select p.*, sd.type_key, sd.tier_id as side_tier_id, sd.status, sd.owner_id
      from partner.partner p
      left join lateral (select t.key as type_key, s.tier_id, partner.status_of(p.id, s.side) as status,
                                (select x from partner.side_owners(p.id, s.side) x limit 1) as owner_id
                         from partner.partner_side s join partner.side_type t on t.id = s.type_id
                         where s.partner_id = p.id and s.side = v_side and s.deleted_at is null) sd on v_side is not null
      where p.deleted_at is null and (coalesce((f ->> 'include_archived')::boolean, false) or p.archived_at is null)
        and case when v_side is not null then partner.side_on(p.id, v_side)
                 else partner.level_of(me, p.id) >= 'view' end
    ), hit as (
      select b.* from base b
      where (q is null or norm.fold(b.trade_name_en) like '%' || q || '%' or norm.fold(b.trade_name_ar) like '%' || q || '%'
             or norm.fold(b.number) like '%' || q || '%')
        and (f -> 'types' is null or b.type_key in (select x from pg_catalog.jsonb_array_elements_text(f -> 'types') x))
        and (f -> 'tiers' is null or b.side_tier_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'tiers') x))
        and (f -> 'owners' is null or b.owner_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'owners') x))
        and (f -> 'statuses' is null or coalesce(b.status, 'none') in (select x from pg_catalog.jsonb_array_elements_text(f -> 'statuses') x))
        and (f -> 'priorities' is null or b.priority_id::text in (select x from pg_catalog.jsonb_array_elements_text(f -> 'priorities') x))
        and (f ->> 'key_partner' is null or b.key_partner = (f ->> 'key_partner')::boolean)
    )
    select pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*) from hit),
      'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', h.id, 'number', h.number, 'trade_name_en', h.trade_name_en, 'trade_name_ar', h.trade_name_ar,
          'type', h.type_key, 'status', h.status, 'owner_id', h.owner_id,
          'sides', coalesce((select pg_catalog.jsonb_agg(partner.side_json(h.id, s.side) order by s.side)
                             from partner.partner_side s where s.partner_id = h.id and s.deleted_at is null
                               and partner.side_on(h.id, s.side)
                               and authz.level_of(me, partner.side_page(s.side)) >= 'view'), '[]'::jsonb),
          'priority_id', h.priority_id, 'key_partner', h.key_partner, 'logo_file_id', h.logo_file_id,
          'archived', h.archived_at is not null, 'version', h.version)
          order by pg_catalog.lower(h.trade_name_en), h.id)
        from (select * from hit order by pg_catalog.lower(hit.trade_name_en), hit.id
              limit greatest(1, least(coalesce(p_limit, 100), 500)) offset greatest(coalesce(p_offset, 0), 0)) h), '[]'::jsonb)));
end
$$;

-- One organisation, as the record page needs it (View on a side it has on): each side the reader may see with its
-- status history and owners; Client-side identifiers and credit limits only with View on Clients (credit also Finance ·
-- View — V70).
create or replace function partner.partner_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  p partner.partner;
  sees_client boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into p from partner.partner where id = p_id and deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.require_level(p_id, null, 'view');
  sees_client := authz.level_of(me, 'clients') >= 'view';
  return pg_catalog.to_jsonb(p) - array['deleted_at', 'deleted_by', 'delete_reason'] || pg_catalog.jsonb_build_object(
    'sides', coalesce((select pg_catalog.jsonb_agg(partner.side_json(p.id, s.side) || pg_catalog.jsonb_build_object(
        'status_history', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', c.id, 'status', c.status, 'effective_on', c.effective_on, 'reason_id', c.reason_id, 'note', c.note,
            'set_by', c.created_by, 'set_at', c.created_at) order by c.effective_on desc, c.created_at desc)
          from partner.side_status_change c where c.partner_id = p.id and c.side = s.side and c.deleted_at is null), '[]'::jsonb),
        'owners', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', m.id, 'person_id', m.person_id, 'from', m.effective_from, 'to', m.effective_to, 'reason', m.reason)
            order by m.effective_from desc)
          from partner.side_owner m where m.partner_id = p.id and m.side = s.side and m.deleted_at is null), '[]'::jsonb))
        order by s.side)
      from partner.partner_side s where s.partner_id = p.id and s.deleted_at is null
        and authz.level_of(me, partner.side_page(s.side)) >= 'view'), '[]'::jsonb),
    'identifiers', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'subkind', i.subkind, 'value', i.value_raw, 'valid_from', i.valid_from,
        'valid_to', i.valid_to, 'source', i.source, 'reason', i.reason, 'added_by', i.created_by, 'added_at', i.created_at)
        order by i.kind, i.created_at)
      from partner.identifier i where i.partner_id = p.id and i.deleted_at is null
        and (sees_client or i.kind not in ('payments_client_id', 'discount_code'))), '[]'::jsonb),
    'owner_id', (select x from partner.owners(p.id) x limit 1),
    'contacts', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) - array['deleted_at', 'deleted_by',
        'delete_reason', 'created_by', 'updated_by'] order by c.is_primary desc, c.name_en)
      from partner.contact c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb),
    'credit_limits', case when sees_client and authz.level_of(me, 'finance') >= 'view' then coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', c.id, 'amount_sar', c.amount_sar, 'prepaid_only', c.amount_sar = 0, 'effective_from', c.effective_from,
          'approved_by', c.approved_by, 'reason', c.reason) order by c.effective_from desc)
        from partner.credit_limit c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb) end);
end
$$;

-- Hover cards (V53): the sides as chips, each with its type and status.
create or replace function partner.hover(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if not exists (select 1 from partner.partner p where p.id = p_id and p.deleted_at is null) then
    return null;
  end if;
  perform partner.require_level(p_id, null, 'view');
  return (select pg_catalog.jsonb_build_object(
      'id', p.id, 'number', p.number, 'trade_name_en', p.trade_name_en, 'trade_name_ar', p.trade_name_ar,
      'logo_file_id', p.logo_file_id, 'key_partner', p.key_partner,
      'owner_id', (select x from partner.owners(p.id) x limit 1),
      'sides', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                  'side', s.side, 'type', t.key, 'status', partner.status_of(p.id, s.side)) order by s.side)
                from partner.partner_side s join partner.side_type t on t.id = s.type_id
                where s.partner_id = p.id and s.deleted_at is null and partner.side_on(p.id, s.side)
                  and authz.level_of(me, partner.side_page(s.side)) >= 'view'), '[]'::jsonb))
    from partner.partner p where p.id = p_id);
end
$$;

-- Ctrl K (§6): organisations by any identifier (folded — every Arabic spelling, V77), by trade name or number — those
-- the reader may see; people by name.
create or replace function core.search(p_q text, p_limit int default 10) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  q text := norm.fold(p_q);
  lim int := greatest(1, least(coalesce(p_limit, 10), 50));
  stop text[] := partner.stop_words();
  sees_client boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if q is null or pg_catalog.length(q) < 2 then
    return pg_catalog.jsonb_build_object('partners', '[]'::jsonb, 'people', '[]'::jsonb);
  end if;
  sees_client := authz.level_of(me, 'clients') >= 'view';
  return pg_catalog.jsonb_build_object(
    'partners', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', y.id, 'number', y.number,
               'trade_name_en', y.trade_name_en, 'trade_name_ar', y.trade_name_ar, 'matched_by', y.matched_by)
               order by y.rank, pg_catalog.lower(y.trade_name_en))
      from (select * from (select distinct on (p.id) p.id, p.number, p.trade_name_en, p.trade_name_ar, m.matched_by, m.rank
            from partner.partner p
            join (select i.partner_id, i.kind as matched_by, 0 as rank from partner.identifier i
                  where i.deleted_at is null and (sees_client or i.kind not in ('payments_client_id', 'discount_code'))
                    and i.value_key in (norm.key('payments_client_id', p_q), norm.key('vat', p_q), norm.key('email', p_q),
                                        norm.key('phone', p_q), norm.key('discount_code', p_q), norm.key('name', p_q, stop))
                  union all
                  select p2.id, 'name', 1 from partner.partner p2
                  where norm.fold(p2.trade_name_en) like '%' || q || '%' or norm.fold(p2.trade_name_ar) like '%' || q || '%'
                     or norm.fold(p2.official_name_en) like '%' || q || '%' or norm.fold(p2.official_name_ar) like '%' || q || '%'
                  union all
                  select p3.id, 'number', 0 from partner.partner p3 where norm.fold(p3.number) = q) m on m.partner_id = p.id
            where p.deleted_at is null and p.archived_at is null and partner.level_of(me, p.id) >= 'view'
            order by p.id, m.rank) x
            order by x.rank, pg_catalog.lower(x.trade_name_en) limit lim) y), '[]'::jsonb),
    'people', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', p.id, 'full_name_en', p.full_name_en,
               'full_name_ar', p.full_name_ar, 'job_title_en', p.job_title_en) order by pg_catalog.lower(p.full_name_en))
      from (select * from core.person p0
            where p0.kind = 'staff' and p0.active and p0.deleted_at is null
              and (norm.fold(p0.full_name_en) like '%' || q || '%' or norm.fold(p0.full_name_ar) like '%' || q || '%'
                   or norm.fold(p0.nickname_en) like '%' || q || '%' or norm.fold(p0.nickname_ar) like '%' || q || '%')
            order by pg_catalog.lower(p0.full_name_en) limit lim) p), '[]'::jsonb));
end
$$;

-- ================================================================ grants and the door (V124)
grant execute on function partner.side_set(uuid, text, jsonb, text), partner.side_off(uuid, text, date, text),
  partner.side_field_save(uuid, jsonb, int, text), partner.side_status_set(uuid, text, text, date, uuid, text),
  partner.side_owner_set(uuid, text, uuid, date, text), partner.bulk_assign(uuid[], text, uuid, uuid, text)
  to authenticated;

create function api.partner_side_set(p_id uuid, p_side text, p_values jsonb, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.side_set(p_id, p_side, p_values, p_reason) $$;
create function api.partner_side_off(p_id uuid, p_side text, p_until date default null, p_reason text default null)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.side_off(p_id, p_side, p_until, p_reason) $$;
create function api.side_field_save(p_id uuid, p_values jsonb, p_version int default null, p_reason text default null)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.side_field_save(p_id, p_values, p_version, p_reason) $$;
create function api.partner_status_set(p_id uuid, p_side text, p_status text, p_effective_on date default null,
                                       p_reason_id uuid default null, p_note text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.side_status_set(p_id, p_side, p_status, p_effective_on, p_reason_id, p_note) $$;
create function api.partner_owner_set(p_id uuid, p_side text, p_person uuid, p_from date default null,
                                      p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.side_owner_set(p_id, p_side, p_person, p_from, p_reason) $$;
create function api.partner_bulk_assign(p_ids uuid[], p_side text, p_owner uuid, p_priority uuid,
                                        p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select partner.bulk_assign(p_ids, p_side, p_owner, p_priority, p_reason) $$;
grant execute on function api.partner_side_set(uuid, text, jsonb, text), api.partner_side_off(uuid, text, date, text),
  api.side_field_save(uuid, jsonb, int, text), api.partner_status_set(uuid, text, text, date, uuid, text),
  api.partner_owner_set(uuid, text, uuid, date, text), api.partner_bulk_assign(uuid[], text, uuid, uuid, text)
  to authenticated;
