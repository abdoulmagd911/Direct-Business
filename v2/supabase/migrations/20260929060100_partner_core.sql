-- v2 partners, part 1 (P3-8a): one record per organisation with its roles, status history, account managers,
-- identifiers (the matching engine's clues — the engine itself is P4-3), codes, contacts and credit limits; the setting
-- lists they use; merge, bulk assign, search and hover cards. TECH-SPEC §3.0 (LIST), §3.4, §3.5; V26, V52, V62–V65,
-- V70, V72, V77, V78, V92; V133–V136. Every function the Data API reaches is a security-invoker wrapper (V124).
-- Forward-only (V103).

create schema partner;   -- organisations: clients, suppliers, strategic partners (V52)
create schema work;      -- projects and tasks (P5-1); its priority list comes first, for partners (V63)
revoke all on schema partner, work from public;
create extension if not exists btree_gist with schema extensions;

-- ================================================================ setting lists (§3.0 LIST, V76, V133)
-- A record type is a setting list only when its module says so (V133): the list door serves those alone.
alter table core.entity add column is_list boolean not null default false;

-- A list: key (stable code), name_en, name_ar (both required — V76), sort, active (retired, never deleted — M40);
-- some lists carry a few more columns of their own. Each is a record type (V127) whose page is the settings page that
-- edits it; core.list_items and core.list_save serve them all.
create function core.list_columns() returns text[]
language sql immutable parallel safe set search_path = ''
as $$ select array['key', 'name_en', 'name_ar', 'sort', 'active'] $$;

create table partner.role (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  short_name_en text, short_name_ar text,                    -- the list chip: "Strategic"
  card_sections text[] not null default '{}',                -- the partner card's sections for this role
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1
);
comment on table partner.role is 'A partner role (V52, V62): client, supplier, strategic partner — a partner holds any number.';

create table partner.category (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1
);

create table partner.tier (like partner.category including all);
create table partner.segment (like partner.category including all);
comment on table partner.segment is 'Segments (V64): Government (B2G) · Corporate · Agencies · Individuals — a setting.';

create table partner.status_reason (
  like partner.category including all,
  status text not null check (status in ('at_risk', 'lost'))
);
comment on table partner.status_reason is 'Why a partner is at risk or lost (V62) — a setting, per status.';

create table partner.call_outcome (
  like partner.category including all,
  counts_as_demo boolean not null default false
);
comment on table partner.call_outcome is 'Call outcomes (V63, V88); demo set and demo held count as demos.';

create table partner.term (
  like partner.category including all,
  unit text not null default 'text' check (unit in ('percent', 'sar', 'days', 'count', 'text'))
);
comment on table partner.term is 'Contract terms compared before → after (V56): corporate rate, free cancellation …';

create table work.priority (like partner.category including all);
comment on table work.priority is 'Priorities for tasks and prospects (V63).';

-- `like … including all` copies defaults, checks and the key's unique index, not the foreign keys.
do $$
declare
  t text;
begin
  foreach t in array array['partner.tier', 'partner.segment', 'partner.status_reason', 'partner.call_outcome',
                           'partner.term', 'work.priority']
  loop
    execute pg_catalog.format('alter table %s add foreign key (created_by) references core.person (id)', t);
    execute pg_catalog.format('alter table %s add foreign key (updated_by) references core.person (id)', t);
  end loop;
end $$;

-- Each role's own fields (V62): a strategic partner's stage, a supplier's services … validated on the partner's role.
create table partner.role_field (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references partner.role (id),
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label_en text not null check (pg_catalog.btrim(label_en) <> ''), label_ar text not null check (pg_catalog.btrim(label_ar) <> ''),
  type text not null check (type in ('text', 'number', 'date', 'select', 'boolean')),
  required boolean not null default false,
  options jsonb check (options is null or pg_catalog.jsonb_typeof(options) = 'array'),   -- select: [{key, en, ar}]
  sort int not null default 0,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (type <> 'select' or pg_catalog.jsonb_array_length(options) > 0)
);
create unique index role_field_one_key on partner.role_field (role_id, key) where deleted_at is null;

-- ================================================================ the partner (§3.4, V77)
create table partner.partner (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,                               -- DK-P-0142, from partner.id_format
  trade_name_en text not null check (pg_catalog.btrim(trade_name_en) <> ''),
  trade_name_ar text,
  official_name_en text,
  official_name_ar text,
  category_id uuid references partner.category (id),
  tier_id uuid references partner.tier (id),
  segment_id uuid references partner.segment (id),
  priority_id uuid references work.priority (id),
  key_partner boolean not null default false,
  website text, city text, country text, address text, notes text,
  archived_at timestamptz,
  merged_into_id uuid references partner.partner (id),
  logo_file_id uuid,                                         -- → core.file, added with files (P3-8b)
  client_since date,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (merged_into_id is distinct from id),
  check (merged_into_id is null or archived_at is not null)
);
comment on table partner.partner is 'One record per organisation (V52); the trade name is its name everywhere (V77). No VAT, CR, client ID, code or email columns: those are identifiers.';

-- A partner holds any number of roles, each with its own fields (V62).
create table partner.partner_role (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner.partner (id),
  role_id uuid not null references partner.role (id),
  subkind text,
  field_values jsonb not null default '{}' check (pg_catalog.jsonb_typeof(field_values) = 'object'),
  since date, until date,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (until is null or since is null or until >= since)
);
create unique index partner_role_live on partner.partner_role (partner_id, role_id) where deleted_at is null;

-- Status with history (V62): never updated — the status on a day is the latest change effective on or before it.
create table partner.status_change (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner.partner (id),
  status text not null check (status in ('prospect', 'active', 'at_risk', 'lost')),
  effective_on date not null,
  reason_id uuid references partner.status_reason (id),
  note text,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (status not in ('at_risk', 'lost') or reason_id is not null)
);
create index status_change_partner on partner.status_change (partner_id, effective_on desc, created_at desc)
  where deleted_at is null;

-- The credit limit Payments enforces, mirrored with its history (V70); 0 is "Prepaid only" (V92).
create table partner.credit_limit (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner.partner (id),
  amount_sar numeric(14,2) not null check (amount_sar >= 0),
  effective_from date not null,
  approved_by uuid not null references core.person (id),
  reason text not null check (pg_catalog.btrim(reason) <> ''),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);

-- ================================================================ identifiers (§3.4, §3.5, V133)
-- The clues invoices are matched by. A value is never rewritten or moved: it is removed and added to the right partner
-- (the ident branch's rule); a removed one comes back (Undo) only while no other partner holds it.
create table partner.identifier (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner.partner (id),
  kind text not null check (kind in ('payments_client_id', 'vat', 'cr', 'discount_code', 'email', 'phone', 'name')),
  subkind text,
  value_raw text not null check (pg_catalog.btrim(value_raw) <> ''),
  value_key text not null,
  norm_version int not null,
  reason text not null check (pg_catalog.btrim(reason) <> ''),
  valid_from date,
  valid_to date,
  source text not null default 'person' check (source in ('person', 'decision', 'import', 'merge')),
  note text,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (case kind
           when 'payments_client_id' then subkind is null or subkind in ('prepaid', 'postpaid', 'tender')
           when 'name' then subkind in ('official_en', 'official_ar', 'trade_en', 'trade_ar', 'alias')
           else subkind is null end),
  check (kind = 'discount_code' or (valid_from is null and valid_to is null)),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);
create unique index identifier_one_holder on partner.identifier (kind, value_key)
  where deleted_at is null and kind <> 'discount_code';
alter table partner.identifier add constraint identifier_code_dates exclude using gist
  (value_key with =, pg_catalog.daterange(valid_from, valid_to, '[]') with &&)
  where (kind = 'discount_code' and deleted_at is null);
create index identifier_partner on partner.identifier (partner_id) where deleted_at is null;
comment on table partner.identifier is 'A partner''s clues (§3.5): client IDs, VAT, CR, codes, emails, phones, names — each value held by one partner at a time.';

-- Values that can never be identifiers: staff email domains, the Payments test VAT, test customers.
create table partner.identifier_block (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('payments_client_id', 'vat', 'cr', 'discount_code', 'email', 'phone', 'name')),
  match text not null default 'exact' check (match in ('exact', 'domain')),
  value text not null check (pg_catalog.btrim(value) <> ''),
  value_key text not null,
  reason text not null check (pg_catalog.btrim(reason) <> ''),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (match = 'exact' or kind = 'email')
);

-- "Individual (not an organisation)" (D25): names that are people, never partners.
create table partner.individual_name (
  id uuid primary key default gen_random_uuid(),
  name_raw text not null check (pg_catalog.btrim(name_raw) <> ''),
  name_key text not null,
  reason text,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index individual_name_once on partner.individual_name (name_key) where deleted_at is null;

-- A short-trial code credited to no partner (V65): listed apart, like individuals.
create table partner.campaign_code (
  id uuid primary key default gen_random_uuid(),
  code_raw text not null check (pg_catalog.btrim(code_raw) <> ''),
  code_key text not null,
  name text not null check (pg_catalog.btrim(name) <> ''),
  valid_from date,
  valid_to date,
  owner_id uuid references core.person (id),
  reason text not null check (pg_catalog.btrim(reason) <> ''),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);
alter table partner.campaign_code add constraint campaign_code_dates exclude using gist
  (code_key with =, pg_catalog.daterange(valid_from, valid_to, '[]') with &&) where (deleted_at is null);

-- A code's terms (V65): fee percent of the service fee, scope, volume tiers, review date and approval, with history.
create table partner.code_terms (
  id uuid primary key default gen_random_uuid(),
  identifier_id uuid references partner.identifier (id),
  campaign_code_id uuid references partner.campaign_code (id),
  fee_percent numeric(5,2) not null check (fee_percent between 0 and 100),
  services uuid[] not null default '{}',                    -- → finance.service (P4-2)
  countries text[] not null default '{}',
  tiers jsonb not null default '[]' check (pg_catalog.jsonb_typeof(tiers) = 'array'),   -- [{from_bookings, fee_percent}]
  review_on date,
  approved_by uuid not null references core.person (id),
  approved_on date not null,
  effective_from date not null,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check ((identifier_id is null) <> (campaign_code_id is null))
);

-- A code key is live on one partner or one campaign at a time, dates included (V65): each table keeps its own rows
-- apart (the exclusion constraints above); these keep them apart from each other.
create function partner.identifier_code_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  holder text;
begin
  if new.deleted_at is null and new.kind = 'discount_code' then
    select c.name into holder from partner.campaign_code c
    where c.code_key = new.value_key and c.deleted_at is null
      and pg_catalog.daterange(c.valid_from, c.valid_to, '[]') && pg_catalog.daterange(new.valid_from, new.valid_to, '[]')
    limit 1;
    if holder is not null then
      raise exception using errcode = '23505', message = 'identifier.held', detail = holder;
    end if;
  end if;
  return new;
end
$$;
create trigger code_guard before insert or update on partner.identifier for each row
  execute function partner.identifier_code_guard();

create function partner.campaign_code_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  holder text;
begin
  if new.deleted_at is null then
    select p.number || ' · ' || p.trade_name_en into holder
    from partner.identifier i join partner.partner p on p.id = i.partner_id
    where i.kind = 'discount_code' and i.value_key = new.code_key and i.deleted_at is null
      and pg_catalog.daterange(i.valid_from, i.valid_to, '[]') && pg_catalog.daterange(new.valid_from, new.valid_to, '[]')
    limit 1;
    if holder is not null then
      raise exception using errcode = '23505', message = 'identifier.held', detail = holder;
    end if;
  end if;
  return new;
end
$$;
create trigger code_guard before insert or update on partner.campaign_code for each row
  execute function partner.campaign_code_guard();

-- An identifier is never rewritten: only its removal (and Undo's restore) changes it — and norm.rebuild(), which
-- recomputes its key from the same value.
create function partner.identifier_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.partner_id, new.kind, new.subkind, new.value_raw, new.valid_from, new.valid_to, new.source)
     is distinct from
     (old.partner_id, old.kind, old.subkind, old.value_raw, old.valid_from, old.valid_to, old.source) then
    raise exception using errcode = 'P0001', message = 'identifier.never_rewritten',
      detail = 'Remove it and add it to the right partner.';
  end if;
  return new;
end
$$;
create trigger guard before update on partner.identifier for each row execute function partner.identifier_guard();

-- A status change is never rewritten either (V62): only its removal.
create function partner.status_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (new.partner_id, new.status, new.effective_on, new.reason_id, new.note)
     is distinct from (old.partner_id, old.status, old.effective_on, old.reason_id, old.note) then
    raise exception using errcode = 'P0001', message = 'partner.status_never_rewritten',
      detail = 'Add a new change with its own date instead.';
  end if;
  if new.reason_id is not null
     and not exists (select 1 from partner.status_reason r where r.id = new.reason_id and r.status = new.status) then
    raise exception using errcode = 'P0001', message = 'partner.reason_not_for_status';
  end if;
  return new;
end
$$;
create trigger guard before insert or update on partner.status_change for each row execute function partner.status_guard();

-- ================================================================ account managers, contacts, merges
create table partner.account_manager (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner.partner (id),
  person_id uuid not null references core.person (id),
  effective_from date not null,
  effective_to date,
  reason text,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (effective_to is null or effective_to > effective_from)
);
alter table partner.account_manager add constraint account_manager_one_at_a_time exclude using gist
  (partner_id with =, pg_catalog.daterange(effective_from, effective_to, '[)') with &&) where (deleted_at is null);

create table partner.contact (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partner.partner (id),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''),
  name_ar text,
  job_title text, email text, phone text, notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index contact_one_primary on partner.contact (partner_id) where is_primary and deleted_at is null;
comment on table partner.contact is 'A person at a partner. Their email is not an identifier unless added as one (§3.4).';

create table partner.merge (
  id uuid primary key default gen_random_uuid(),
  kept_id uuid not null references partner.partner (id),
  merged_id uuid not null references partner.partner (id),
  reason text not null check (pg_catalog.btrim(reason) <> ''),
  request_id uuid references audit.request (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  check (kept_id <> merged_id)
);

-- ================================================================ every table: guarded, watched, indexed
do $$
declare
  t text;
begin
  foreach t in array array['partner.role', 'partner.category', 'partner.tier', 'partner.segment',
    'partner.status_reason', 'partner.call_outcome', 'partner.term', 'work.priority', 'partner.role_field',
    'partner.partner', 'partner.partner_role', 'partner.status_change', 'partner.credit_limit', 'partner.identifier',
    'partner.identifier_block', 'partner.individual_name', 'partner.campaign_code', 'partner.code_terms',
    'partner.account_manager', 'partner.contact', 'partner.merge']
  loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;
select core.index_foreign_keys('partner');
select core.index_foreign_keys('work');
