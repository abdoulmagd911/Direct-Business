-- Builder E · the achievements part of P5-4 (TECH-SPEC §3.8, §3.11; brief docs/v2/briefs/achievements.md). Plans —
-- only the yearly rows the categories need (objectives, KPIs and readings stay builder A's); achievement categories
-- with their sub-categories, edited by admins in Settings; achievements under the dates rule (V400), their evidence — a
-- file or a Direct reference with its link (V99) — and their participants; the doors to log, edit, move, assign,
-- remove (with a reason) and list; and the Past work grid's door for achievements (#105): one paste, one request, each
-- row Backfilled with its day or its report's last day (V504), the report as its evidence (V506), owner Unknown allowed
-- (V491), one live row per import key, and the deal value on Contract signed and MoU (V505) — a newer report's value
-- replacing an older one's, the older kept in the change log (V502, V500). Nothing is dated before 1 January 2025
-- (V506). Every achievement has its number, ACH-<year>-0042, and may be marked a repeat of an earlier one (V531); an MoU
-- sets the side chosen on it to Prospect where that side has no status yet (V521). V370–V376, V378. Every function the
-- Data API reaches is a security-invoker wrapper (V124). Forward-only (V103).
--
-- project_id → work.project and source_task_id → work.task (P5-1, #140, already on v2/main) are foreign keys here;
-- links to tables other steps build — service_id → finance.service (P4), origin_report_id → report.report (P6-1) —
-- are plain columns, and the step that lands second adds the foreign key (spec §3.0).

create schema perf;   -- plans, KPIs, achievements, challenges, period targets (§3.8)
create extension if not exists pg_trgm with schema extensions;   -- the repeat check's title similarity (V531)
comment on schema perf is 'Yearly plans, KPIs, achievements, challenges and period targets (TECH-SPEC §3.8).';

-- ================================================================ plans (§3.8, §5a)
-- One plan per department and calendar year. Builder A's plan editor and api.plan_copy add objectives, KPIs and
-- targets to these rows; here a plan exists so that its year has categories and its achievements have a home.
create table perf.plan (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references core.department (id),
  year int not null check (year between 2025 and 2100),
  name text not null check (pg_catalog.btrim(name) <> '' and pg_catalog.length(name) <= 200),
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  copied_from_plan_id uuid references perf.plan (id),
  activated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index plan_one_per_year on perf.plan (department_id, year) where deleted_at is null;
comment on table perf.plan is 'A department''s plan for one calendar year (§3.8): its categories here; its objectives, KPIs and targets builder A''s.';

-- ================================================================ categories (§3.8; V66, V76, V90, V99, V505)
-- A plan's achievement categories, one level of sub-categories under them. The code stays the same when a plan is
-- copied, so a measure names a category across years. Each carries the Arabic and English sentence its report line is
-- drafted from (V76). Contract signed and MoU carry a deal value (V505); Technical integration needs its Product ticket
-- (V99, V407): required_ref_system names the system a reference must point into before the achievement is saved.
create table perf.achievement_category (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references perf.plan (id),
  parent_id uuid references perf.achievement_category (id),
  code text not null check (code ~ '^[A-Z][A-Z0-9_-]*$' and pg_catalog.length(code) <= 40),
  name_en text not null check (pg_catalog.btrim(name_en) <> '' and pg_catalog.length(name_en) <= 120),
  name_ar text not null check (pg_catalog.btrim(name_ar) <> '' and pg_catalog.length(name_ar) <= 120),
  is_money_link boolean not null default false,
  has_deal_value boolean not null default false,
  sets_prospect boolean not null default false,                      -- V521: an MoU sets its chosen side to Prospect
  required_ref_system_id uuid references work.ref_system (id),
  line_template_en text not null check (pg_catalog.btrim(line_template_en) <> '' and pg_catalog.length(line_template_en) <= 300),
  line_template_ar text not null check (pg_catalog.btrim(line_template_ar) <> '' and pg_catalog.length(line_template_ar) <= 300),
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint achievement_category_not_own_parent check (parent_id is distinct from id)
);
create unique index achievement_category_code on perf.achievement_category (plan_id, code) where deleted_at is null;
comment on table perf.achievement_category is
  'A plan''s achievement categories and sub-categories (§3.8): the code survives a plan copy; the line templates draft a report line in both languages (V76).';

-- ================================================================ achievements (§3.8; V400, V491, V502, V504–V506)
create table perf.achievement (
  id uuid primary key default gen_random_uuid(),
  number text not null unique check (number ~ '^ACH-[0-9]{4}-[0-9]{4,}$'),   -- V531: written by the app, never changed
  repeat_of uuid references perf.achievement (id),                    -- V531: "This is a new one" of an earlier one
  mou_side text check (mou_side in ('client', 'supplier_partner')),   -- V521: the side an MoU was signed with
  mou_status_id uuid references partner.side_status_change (id),      -- V601: the Prospect this MoU set, if it set one
  plan_id uuid not null references perf.plan (id),                     -- the plan of happened_on's year (set by trigger)
  department_id uuid not null references core.department (id),
  category_id uuid not null references perf.achievement_category (id),
  partner_id uuid references partner.partner (id),
  project_id uuid references work.project (id),
  source_task_id uuid references work.task (id),
  service_id uuid,                                                       -- → finance.service (P4)
  title text not null check (pg_catalog.btrim(title) <> '' and pg_catalog.length(title) <= 300),
  notes text check (notes is null or pg_catalog.length(notes) <= 20000),
  count int not null default 1 check (count between 1 and 100000),
  before_value numeric(14,2),
  after_value numeric(14,2),
  deal_value numeric(14,2) check (deal_value is null or deal_value >= 0),   -- V505: typed, never Finance money
  value_report_kind text check (value_report_kind in ('bd_monthly', 'partnerships', 'commercial_quarterly', 'improvements')),
  value_report_period text check (value_report_period ~ '^[0-9]{4}-(0[1-9]|1[0-2]|Q[1-4])$'),
  draft boolean generated always as (happened_on is null) stored,       -- V68: no date yet — never counts
  happened_on date check (happened_on >= date '2025-01-01'),            -- V400: the date on the evidence; V506
  logged_at timestamptz not null default core.clock(),
  period_moved_from date,
  period_move_reason text check (period_move_reason is null or (pg_catalog.btrim(period_move_reason) <> ''
                                                                 and pg_catalog.length(period_move_reason) <= 500)),
  period_moved_by uuid references core.person (id),
  owner_id uuid references core.person (id),                            -- null = Unknown: past work only (V491)
  use_as_example boolean not null default false,
  origin text not null default 'person' check (origin in ('person', 'task', 'report', 'import', 'backfill')),
  origin_report_id uuid,                                                 -- → report.report (P6-1)
  source_kind text check (source_kind in ('bd_monthly', 'partnerships', 'commercial_quarterly', 'improvements')),
  source_period text check (source_period ~ '^[0-9]{4}-(0[1-9]|1[0-2]|Q[1-4])$'),
  date_from_report boolean not null default false,
  import_key text check (import_key is null or pg_catalog.length(import_key) between 1 and 300),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint achievement_not_its_own_repeat check (repeat_of is distinct from id),
  constraint achievement_not_after_logged check (happened_on is null or happened_on <= core.riyadh_day(logged_at)),
  constraint achievement_moved_together check ((period_moved_from is null) = (period_move_reason is null)
                                               and (period_moved_from is null) = (period_moved_by is null)),
  constraint achievement_source_on_backfill check ((source_kind is null) = (source_period is null)
                                                   and (source_kind is null or origin = 'backfill')
                                                   and (not date_from_report or origin = 'backfill')),
  constraint achievement_backfill_dated check (origin <> 'backfill' or happened_on is not null),
  constraint achievement_value_report check ((value_report_kind is null) = (value_report_period is null)
                                             and (value_report_kind is null or deal_value is not null))
);
create unique index achievement_import_key on perf.achievement (import_key) where import_key is not null and deleted_at is null;
create index achievement_department on perf.achievement (department_id, happened_on desc) where deleted_at is null;
create index achievement_owner on perf.achievement (owner_id, happened_on desc) where deleted_at is null;
comment on table perf.achievement is
  'An achievement (§3.8) under the dates rule (V400): happened_on is the date on its evidence; owner Unknown only on past work (V491); the deal value on Contract signed and MoU (V505).';
comment on column perf.achievement.value_report_kind is
  'The report the deal value was last taken from (V502): a newer report replaces it, the older stays in the change log; null when a person typed it.';
comment on column perf.achievement.import_key is 'The Past work grid''s key of the row (OLD-PRF-045): one live achievement per key.';

-- Evidence (V99): a Direct ticket or booking reference with its link — beside the files linked with purpose evidence.
create table perf.achievement_ref (
  id uuid primary key default gen_random_uuid(),
  achievement_id uuid not null references perf.achievement (id),
  system_id uuid not null references work.ref_system (id),
  value text not null check (pg_catalog.btrim(value) <> '' and pg_catalog.length(value) <= 200),
  url text check (url is null or (url ~* '^https?://[^[:space:]]+$' and pg_catalog.length(url) <= 1000)),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint achievement_ref_no_secrets check (not core.looks_secret(value) and not core.looks_secret(url))
);
create unique index achievement_ref_live on perf.achievement_ref (achievement_id, system_id, value) where deleted_at is null;
comment on table perf.achievement_ref is 'An achievement''s Direct reference (V99): a ticket or booking number with its link — evidence beside files.';

-- The people who shared in it (§3.8): they see it as theirs and edit it with its owner.
create table perf.achievement_participant (
  id uuid primary key default gen_random_uuid(),
  achievement_id uuid not null references perf.achievement (id),
  person_id uuid not null references core.person (id),
  role text check (role is null or (pg_catalog.btrim(role) <> '' and pg_catalog.length(role) <= 100)),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index achievement_participant_live on perf.achievement_participant (achievement_id, person_id)
  where deleted_at is null;

do $$
declare
  t text;
begin
  foreach t in array array['perf.plan', 'perf.achievement_category', 'perf.achievement', 'perf.achievement_ref',
                           'perf.achievement_participant'] loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;
select core.index_foreign_keys('perf');

-- A category's names carry no banned word (V404), whichever door saves them.
create trigger name_banned before insert or update on perf.achievement_category
  for each row execute function core.name_banned();

-- ================================================================ small helpers
-- Who may be named (V465): staff who can work here, never the test account.
create function perf.person_ok(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select core.person_available(p_person)
         and exists (select 1 from core.person p where p.id = p_person and p.account <> 'test_account')
$$;

-- Past work (V491, V506): every backfilled entry, and anything dated before the go-live day.
create function perf.is_past(p_origin text, p_on date) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_origin = 'backfill'
         or coalesce(p_on < nullif(core.setting_at('app.go_live_on', null, core.riyadh_today()) #>> '{}', '')::date, false)
$$;

-- A report's last day (V504): a month's, or a quarter's for the Commercial quarterly.
create function perf.period_last_day(p_period text) returns date
language sql immutable parallel safe set search_path = ''
as $$
  select case
    when p_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
      then (pg_catalog.to_date(p_period || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date
    when p_period ~ '^[0-9]{4}-Q[1-4]$'
      then (pg_catalog.make_date(pg_catalog.left(p_period, 4)::int, pg_catalog.right(p_period, 1)::int * 3, 1)
            + interval '1 month' - interval '1 day')::date
  end
$$;

-- Whether report a is newer than report b (V502): a later last day; on the same day the quarterly beats the monthly.
create function perf.report_newer(p_kind_a text, p_period_a text, p_kind_b text, p_period_b text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select perf.period_last_day(p_period_a) > perf.period_last_day(p_period_b)
         or (perf.period_last_day(p_period_a) = perf.period_last_day(p_period_b)
             and p_kind_a = 'commercial_quarterly' and p_kind_b <> 'commercial_quarterly')
$$;

create function perf.plan_of(p_department uuid, p_year int) returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id from perf.plan p where p.department_id = p_department and p.year = p_year and p.deleted_at is null
$$;

-- ================================================================ the rules every write meets
-- An achievement belongs to the plan of its day's year in its department (§5a) — no plan for that year is refused,
-- naming the year; its category is that plan's (a re-dated achievement takes the same code in the new year's plan);
-- a retired category takes no new achievement; a deal value only on a category that carries one (V505); an Unknown
-- owner only on past work (V491); a named owner can work here (V465).
create function perf.achievement_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  yr int := pg_catalog.date_part('year', coalesce(new.happened_on, core.riyadh_day(new.logged_at)))::int;
  pl uuid := perf.plan_of(new.department_id, yr);
  c perf.achievement_category;
begin
  if pl is null then
    raise exception using errcode = 'P0001', message = 'achievement.no_plan', detail = yr::text;
  end if;
  select * into c from perf.achievement_category x where x.id = new.category_id;
  if c.plan_id is distinct from pl then
    select * into c from perf.achievement_category x where x.plan_id = pl and x.code = c.code and x.deleted_at is null;
    if c.id is null then
      raise exception using errcode = 'P0001', message = 'achievement.category_not_in_plan', detail = yr::text;
    end if;
    new.category_id := c.id;
  end if;
  if (tg_op = 'INSERT' or new.category_id is distinct from old.category_id) and (c.deleted_at is not null or not c.active) then
    raise exception using errcode = 'P0001', message = 'achievement.category_retired', detail = c.code;
  end if;
  new.plan_id := pl;
  if tg_op = 'UPDATE' and new.number is distinct from old.number then
    raise exception using errcode = 'P0001', message = 'achievement.number_fixed';
  end if;
  if new.deal_value is not null and not c.has_deal_value then
    raise exception using errcode = 'P0001', message = 'achievement.no_deal_value', detail = c.code;
  end if;
  if new.owner_id is null and not perf.is_past(new.origin, new.happened_on) then
    raise exception using errcode = 'P0001', message = 'achievement.owner_required';
  end if;
  if new.owner_id is not null and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id)
     and not perf.person_ok(new.owner_id) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = new.owner_id::text;
  end if;
  return new;
end
$$;
create trigger guard before insert or update on perf.achievement for each row execute function perf.achievement_guard();

create function perf.participant_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.person_id is distinct from old.person_id) and not perf.person_ok(new.person_id) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = new.person_id::text;
  end if;
  return new;
end
$$;
create trigger guard before insert or update on perf.achievement_participant
  for each row execute function perf.participant_guard();

-- A sub-category sits under a top-level category of the same plan, and has none of its own: one level only.
create function perf.category_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.parent_id is not null and not exists (
       select 1 from perf.achievement_category p
       where p.id = new.parent_id and p.plan_id = new.plan_id and p.parent_id is null and p.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'achievement_category.parent_invalid';
  end if;
  if new.parent_id is not null and exists (select 1 from perf.achievement_category s
                                           where s.parent_id = new.id and s.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'achievement_category.parent_invalid';
  end if;
  return new;
end
$$;
create trigger guard before insert or update of parent_id, plan_id on perf.achievement_category
  for each row execute function perf.category_guard();

-- ================================================================ who sees and who changes (§5; V96, V467)
-- The whole team sees every achievement of its departments (V96): a person's level on one is their level on KPIs
-- while it belongs to one of their departments — their own, or one an admin lets them see.
create function perf.sees_department(p_person uuid, p_department uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select coalesce(r.is_admin, false) or p.department_id = p_department
           or exists (select 1 from core.person_department pd
                      where pd.person_id = p.id and pd.department_id = p_department and pd.deleted_at is null)
    from core.person p left join core.role r on r.id = p.role_id
    where p.id = p_person), false)
$$;

-- The achievement a perf row belongs to.
create function perf.achievement_of(p_table text, p_id uuid) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  case p_table
    when 'perf.achievement' then return p_id;
    when 'perf.achievement_ref' then return (select x.achievement_id from perf.achievement_ref x where x.id = p_id);
    when 'perf.achievement_participant' then
      return (select x.achievement_id from perf.achievement_participant x where x.id = p_id);
    else return null;
  end case;
end
$$;

-- The record types' level function (core.entity.level): KPIs' level, in the person's departments.
create function perf.row_level(p_table text, p_id uuid, p_person uuid) returns core.level
language sql stable security definer set search_path = ''
as $$
  select case when a.id is not null and perf.sees_department(p_person, a.department_id)
              then authz.level_of(p_person, 'kpis') else 'none'::core.level end
  from (select perf.achievement_of(p_table, p_id) as aid) k
  left join perf.achievement a on a.id = k.aid
$$;

-- An achievement's own people: its owner, its creator and its participants — told when someone else changes it.
create function perf.achievement_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select a.owner_id from perf.achievement a where a.id = p_id and a.owner_id is not null
  union select a.created_by from perf.achievement a where a.id = p_id
  union select x.person_id from perf.achievement_participant x where x.achievement_id = p_id and x.deleted_at is null
$$;
create function perf.achievement_ref_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select perf.achievement_owners(perf.achievement_of('perf.achievement_ref', p_id)) $$;
create function perf.achievement_participant_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select perf.achievement_owners(perf.achievement_of('perf.achievement_participant', p_id)) $$;

-- Whether it is the person's own: they own it, logged it, or shared in it.
create function perf.is_own(p_person uuid, a perf.achievement) returns boolean
language sql stable security definer set search_path = ''
as $$ select p_person is not null and p_person = any (array(select perf.achievement_owners(a.id))) $$;

-- No approval step (§3.8): its own people edit it with Own on KPIs; a manager with Full edits anyone's.
create function perf.can_edit(p_person uuid, a perf.achievement) returns boolean
language sql stable security definer set search_path = ''
as $$
  select case perf.row_level('perf.achievement', a.id, p_person)
           when 'full' then true
           when 'own' then perf.is_own(p_person, a)
           else false end
$$;

create function perf.achievement_editable(p_id uuid) returns perf.achievement
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  a perf.achievement;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into a from perf.achievement where id = p_id and deleted_at is null;
  if a.id is null or perf.row_level('perf.achievement', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not perf.can_edit(me, a) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'kpis', 'level', 'own')::text;
  end if;
  return a;
end
$$;

-- A change to past work tells nobody (V491): the open request is dated on the work's own day, never later than
-- yesterday — only when every achievement it touches is past work. A past day otherwise dates the request (V400).
create function perf.quiet_if_past(p_ids uuid[]) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  d date;
begin
  if not exists (select 1 from perf.achievement a where a.id = any (p_ids) and not perf.is_past(a.origin, a.happened_on)) then
    select pg_catalog.min(a.happened_on) into d from perf.achievement a where a.id = any (p_ids);
    if d is not null then
      perform audit.happened(least(d, core.riyadh_today() - 1));
    end if;
  end if;
end
$$;

-- ================================================================ plans and categories (Settings → Targets)
-- The starting categories (V66, V80, V90, V99, V505), written into a plan that has none to copy.
create function perf.categories_seed(p_plan uuid) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  k int;
begin
  insert into perf.achievement_category (plan_id, code, name_en, name_ar, has_deal_value, sets_prospect,
                                         required_ref_system_id, line_template_en, line_template_ar, sort)
  select p_plan, s.code, s.name_en, s.name_ar, s.deal, s.code = 'MOU', (select r.id from work.ref_system r
                                                         where r.key = s.ref and r.deleted_at is null), s.en, s.ar, s.sort
  from (values
    ('PROBLEM', 'Problem solving', 'حل المشكلات', false, null, 'Problem solved: {title}', 'حل مشكلة: {title}', 10),
    ('COST', 'Cost savings', 'خفض التكاليف', false, null, 'Cost saving: {title}', 'خفض تكاليف: {title}', 20),
    ('MOU', 'MoU / strategic signing', 'مذكرة تفاهم / توقيع استراتيجي', true, null,
     'MoU signed with {organisation}: {title}', 'توقيع مذكرة تفاهم مع {organisation}: {title}', 30),
    ('CONTRACT', 'Contract signed', 'توقيع عقد', true, null,
     'Contract signed with {organisation}: {title}', 'توقيع عقد مع {organisation}: {title}', 40),
    ('INTEGRATION', 'Technical integration', 'ربط تقني', false, 'ticket',
     'Integration with {organisation} handed to Product: {title}', 'تسليم ربط تقني مع {organisation} إلى فريق المنتج: {title}', 50),
    ('CASHBACK', 'Supplier cashback', 'استرداد نقدي من مورد', false, null,
     'Cashback received from {organisation}: {title}', 'استرداد نقدي من {organisation}: {title}', 60),
    ('AWARD', 'Awards', 'الجوائز', false, null, 'Award: {title}', 'جائزة: {title}', 70)
  ) s(code, name_en, name_ar, deal, ref, en, ar, sort);
  get diagnostics k = row_count;
  return k;
end
$$;

-- Opens a department's plan for a year (Settings → Targets, admins): its categories copied from the nearest plan of the
-- department — the latest earlier year, else the earliest later one — sub-categories under their copied parents, or
-- the starting categories when it has none. A second plan for the same year is refused, naming the one held.
create function perf.plan_open(p_department uuid, p_year int, p_name text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.performance', 'full');
  src uuid;
  pid uuid;
  req uuid;
  held uuid;
begin
  if p_department is null or not exists (select 1 from core.department d where d.id = p_department and d.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_year is null or p_year < 2025 or p_year > pg_catalog.date_part('year', core.riyadh_today())::int + 1 then
    raise exception using errcode = 'P0001', message = 'plan.year_invalid', detail = p_year::text;
  end if;
  held := perf.plan_of(p_department, p_year);
  if held is not null then
    raise exception using errcode = '23505', message = 'plan.year_taken', detail = held::text;
  end if;
  select p.id into src from perf.plan p
  where p.department_id = p_department and p.deleted_at is null
  order by (p.year < p_year) desc, pg_catalog.abs(p.year - p_year), p.year
  limit 1;
  req := audit.begin('ui', 'plan.opened', pg_catalog.jsonb_build_object('year', p_year));
  insert into perf.plan (department_id, year, name, copied_from_plan_id)
  values (p_department, p_year,
          coalesce(nullif(pg_catalog.btrim(p_name), ''),
                   (select d.name_en from core.department d where d.id = p_department) || ' ' || p_year),
          src)
  returning id into pid;
  if src is null then
    perform perf.categories_seed(pid);
  else
    insert into perf.achievement_category (plan_id, code, name_en, name_ar, is_money_link, has_deal_value, sets_prospect,
                                           required_ref_system_id, line_template_en, line_template_ar, sort, active)
    select pid, c.code, c.name_en, c.name_ar, c.is_money_link, c.has_deal_value, c.sets_prospect, c.required_ref_system_id,
           c.line_template_en, c.line_template_ar, c.sort, c.active
    from perf.achievement_category c where c.plan_id = src and c.deleted_at is null;
    update perf.achievement_category n set parent_id = np.id
    from perf.achievement_category o
    join perf.achievement_category op on op.id = o.parent_id
    join perf.achievement_category np on np.plan_id = pid and np.code = op.code and np.deleted_at is null
    where o.plan_id = src and o.deleted_at is null and o.parent_id is not null
      and n.plan_id = pid and n.code = o.code and n.deleted_at is null;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'version', 1, 'request_id', req);
end
$$;

-- The plans a reader may see, newest year first, each with its categories counted.
create function perf.plans(p_department uuid default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'view');
begin
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', p.id, 'department_id', p.department_id, 'year', p.year, 'name', p.name, 'status', p.status,
      'copied_from_plan_id', p.copied_from_plan_id, 'version', p.version,
      'categories', (select pg_catalog.count(*)::int from perf.achievement_category c
                     where c.plan_id = p.id and c.deleted_at is null)) order by p.year desc, p.name)
    from perf.plan p
    where p.deleted_at is null and perf.sees_department(me, p.department_id)
      and (p_department is null or p.department_id = p_department)), '[]'::jsonb);
end
$$;

-- A category of a plan, by its code or its id.
create function perf.category_in(p_plan uuid, p_category text) returns perf.achievement_category
language sql stable security definer set search_path = ''
as $$
  select c.* from perf.achievement_category c
  where c.plan_id = p_plan and c.deleted_at is null
    and (c.code = pg_catalog.upper(pg_catalog.btrim(p_category))
         or (p_category ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and c.id = p_category::uuid))
$$;

-- Adds or changes a category (admins, Settings → Targets): its names, sentences, parent (a code of the same plan),
-- whether it carries a deal value, the reference system it needs, its order and whether it is in use. The code is
-- given once and kept, so measures and copies keep naming it.
create function perf.category_save(p_id uuid, p_plan uuid, p_values jsonb, p_version int default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.performance', 'full');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  c perf.achievement_category;
  par uuid;
  sys uuid;
  req uuid;
  cid uuid;
  what text;
  allowed text[] := array['code', 'name_en', 'name_ar', 'parent', 'is_money_link', 'has_deal_value', 'sets_prospect',
                          'required_ref_system',
                          'line_template_en', 'line_template_ar', 'sort', 'active'];
begin
  if exists (select 1 from pg_catalog.jsonb_object_keys(v) k where k <> all (allowed)) then
    raise exception using errcode = 'P0001', message = 'common.field_unknown',
      detail = (select pg_catalog.string_agg(k, ', ') from pg_catalog.jsonb_object_keys(v) k where k <> all (allowed));
  end if;
  if p_id is not null then
    select * into c from perf.achievement_category x where x.id = p_id and x.deleted_at is null;
    if c.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if v ? 'code' and pg_catalog.upper(pg_catalog.btrim(v ->> 'code')) is distinct from c.code then
      raise exception using errcode = 'P0001', message = 'achievement_category.code_fixed';
    end if;
    perform core.check_version('perf.achievement_category', p_id, p_version,
      array(select case k when 'parent' then 'parent_id' when 'required_ref_system' then 'required_ref_system_id' else k end
            from pg_catalog.jsonb_object_keys(v) k));
  elsif p_plan is null or not exists (select 1 from perf.plan p where p.id = p_plan and p.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if nullif(v ->> 'parent', '') is not null then
    par := (perf.category_in(coalesce(c.plan_id, p_plan), v ->> 'parent')).id;
    if par is null then
      raise exception using errcode = 'P0001', message = 'achievement_category.parent_invalid';
    end if;
  end if;
  if nullif(v ->> 'required_ref_system', '') is not null then
    select r.id into sys from work.ref_system r where r.key = v ->> 'required_ref_system' and r.deleted_at is null;
    if sys is null then
      raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = v ->> 'required_ref_system';
    end if;
  end if;
  req := audit.begin('ui', case when p_id is null then 'achievement_category.added' else 'achievement_category.changed' end,
                     pg_catalog.jsonb_build_object('code', coalesce(c.code, v ->> 'code')));
  begin
    if p_id is null then
      insert into perf.achievement_category (plan_id, parent_id, code, name_en, name_ar, is_money_link, has_deal_value,
                                             sets_prospect, required_ref_system_id, line_template_en, line_template_ar,
                                             sort, active)
      values (p_plan, par, pg_catalog.upper(pg_catalog.btrim(v ->> 'code')), pg_catalog.btrim(v ->> 'name_en'),
              pg_catalog.btrim(v ->> 'name_ar'), coalesce((v ->> 'is_money_link')::boolean, false),
              coalesce((v ->> 'has_deal_value')::boolean, false), coalesce((v ->> 'sets_prospect')::boolean, false), sys,
              coalesce(nullif(pg_catalog.btrim(v ->> 'line_template_en'), ''), '{title}'),
              coalesce(nullif(pg_catalog.btrim(v ->> 'line_template_ar'), ''), '{title}'),
              coalesce((v ->> 'sort')::int, 0), coalesce((v ->> 'active')::boolean, true))
      returning id into cid;
    else
      update perf.achievement_category x set
        name_en = case when v ? 'name_en' then pg_catalog.btrim(v ->> 'name_en') else x.name_en end,
        name_ar = case when v ? 'name_ar' then pg_catalog.btrim(v ->> 'name_ar') else x.name_ar end,
        parent_id = case when v ? 'parent' then par else x.parent_id end,
        is_money_link = case when v ? 'is_money_link' then (v ->> 'is_money_link')::boolean else x.is_money_link end,
        has_deal_value = case when v ? 'has_deal_value' then (v ->> 'has_deal_value')::boolean else x.has_deal_value end,
        sets_prospect = case when v ? 'sets_prospect' then (v ->> 'sets_prospect')::boolean else x.sets_prospect end,
        required_ref_system_id = case when v ? 'required_ref_system' then sys else x.required_ref_system_id end,
        line_template_en = case when v ? 'line_template_en' then pg_catalog.btrim(v ->> 'line_template_en') else x.line_template_en end,
        line_template_ar = case when v ? 'line_template_ar' then pg_catalog.btrim(v ->> 'line_template_ar') else x.line_template_ar end,
        sort = case when v ? 'sort' then (v ->> 'sort')::int else x.sort end,
        active = case when v ? 'active' then (v ->> 'active')::boolean else x.active end
      where x.id = p_id;
      cid := p_id;
    end if;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'achievement_category.code_taken',
        detail = (select x.id::text from perf.achievement_category x
                  where x.plan_id = coalesce(c.plan_id, p_plan) and x.code = pg_catalog.upper(pg_catalog.btrim(v ->> 'code'))
                    and x.deleted_at is null);
    when check_violation or not_null_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = 'achievement_category.invalid', detail = coalesce(what, '');
  end;
  -- A deal value already typed keeps its category's flag on: switching it off would leave figures nothing can show.
  if exists (select 1 from perf.achievement a join perf.achievement_category x on x.id = a.category_id
             where x.id = cid and not x.has_deal_value and a.deal_value is not null and a.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'achievement_category.deal_values_held';
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'version',
    (select x.version from perf.achievement_category x where x.id = cid), 'request_id', req);
end
$$;

-- Removes categories no live achievement uses (admins); one in use is retired instead (active false), never removed.
create function perf.categories_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.performance', 'full');
  req uuid;
  k int;
  used text;
begin
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if exists (select 1 from pg_catalog.unnest(p_ids) i
             where not exists (select 1 from perf.achievement_category c where c.id = i and c.deleted_at is null)) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select pg_catalog.string_agg(distinct c.code, ', ') into used
  from perf.achievement_category c
  where c.id = any (p_ids)
    and (exists (select 1 from perf.achievement a where a.category_id = c.id and a.deleted_at is null)
         or exists (select 1 from perf.achievement_category s
                    where s.parent_id = c.id and s.deleted_at is null and s.id <> all (p_ids)));
  if used is not null then
    raise exception using errcode = 'P0001', message = 'list.in_use', detail = used;
  end if;
  req := audit.begin('ui', 'achievement_category.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)),
                     p_reason);
  update perf.achievement_category set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason
  where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- A plan's categories, top-level first with their sub-categories after them — for Log achievement, the grid's choices
-- and Settings. The plan is the reader's department's for a year (this year by default), or one named.
create function perf.categories(p_plan uuid default null, p_year int default null, p_department uuid default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'view');
  pl uuid := p_plan;
begin
  if pl is null then
    pl := perf.plan_of(coalesce(p_department, (select p.department_id from core.person p where p.id = me)),
                       coalesce(p_year, pg_catalog.date_part('year', core.riyadh_today())::int));
  end if;
  if pl is null or not exists (select 1 from perf.plan p where p.id = pl and p.deleted_at is null
                               and perf.sees_department(me, p.department_id)) then
    return '[]'::jsonb;
  end if;
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', c.id, 'plan_id', c.plan_id, 'code', c.code, 'name_en', c.name_en, 'name_ar', c.name_ar,
      'parent_id', c.parent_id, 'parent_code', p.code, 'is_money_link', c.is_money_link, 'has_deal_value', c.has_deal_value,
      'sets_prospect', c.sets_prospect or coalesce(p.sets_prospect, false),
      'required_ref_system', r.key, 'line_template_en', c.line_template_en, 'line_template_ar', c.line_template_ar,
      'sort', c.sort, 'active', c.active, 'version', c.version)
      order by coalesce(p.sort, c.sort), coalesce(p.code, c.code), c.parent_id nulls first, c.sort, c.code)
    from perf.achievement_category c
    left join perf.achievement_category p on p.id = c.parent_id
    left join work.ref_system r on r.id = c.required_ref_system_id
    where c.plan_id = pl and c.deleted_at is null), '[]'::jsonb);
end
$$;

-- ================================================================ the line (§3.8, V76)
-- One function renders an achievement as one line from its category's sentence, in English or Arabic — the list, the
-- KPI drill-down, the report suggestions and the exports all call it. {title}, {organisation}, {count}, {deal_value}.
create function perf.line_of(p_id uuid, p_locale text default 'en') returns text
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
           case when p_locale = 'ar' then c.line_template_ar else c.line_template_en end,
           '{title}', a.title),
           '{organisation}', coalesce(case when p_locale = 'ar' then coalesce(pt.trade_name_ar, pt.trade_name_en)
                                           else pt.trade_name_en end, '—')),
           '{count}', a.count::text),
           '{deal_value}', coalesce(pg_catalog.to_char(a.deal_value, 'FM999,999,999,990.00'), '—'))
  from perf.achievement a
  join perf.achievement_category c on c.id = a.category_id
  left join partner.partner pt on pt.id = a.partner_id
  where a.id = p_id
$$;

-- The line for whoever may see the achievement; nothing for anyone else.
create function perf.achievement_line(p_id uuid, p_locale text default 'en') returns text
language sql stable security definer set search_path = ''
as $$
  select case when perf.row_level('perf.achievement', p_id, authz.me()) >= 'view' then perf.line_of(p_id, p_locale) end
$$;

-- ================================================================ numbers and repeats (V531)
-- The number an achievement is known by: ACH-<year>-0042, the year its Happened on falls in when it is made (a draft:
-- the year it is logged), drawn from core.next_number — never typed, never changed, never reused.
create function perf.number_for(p_year int) returns text
language sql volatile security definer set search_path = ''
as $$ select core.format_number('ACH', p_year, core.next_number('achievement', p_year)) $$;

-- How alike two titles must be (V531): the setting perf.repeat_similarity, registered once its words exist in both
-- catalogs (V378); until then 0.6.
create function perf.repeat_threshold() returns numeric
language plpgsql stable security definer set search_path = ''
as $$
begin
  if exists (select 1 from core.setting_def d where d.key = 'perf.repeat_similarity') then
    return coalesce((core.setting_at('perf.repeat_similarity', null, core.riyadh_today()) #>> '{}')::numeric, 0.6);
  end if;
  return 0.6;
end
$$;

-- Possible repeats (V531): live achievements the person may see for the same organisation and category code, dated
-- in the 12 months up to the day, whose title is like this one (folded, then a trigram score at least the setting
-- perf.repeat_similarity, default 0.6) — best first. No organisation, no check.
create function perf.repeats_for(p_person uuid, p_partner uuid, p_category text, p_title text, p_on date,
                                 p_exclude uuid default null) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', x.id, 'number', x.number, 'title', x.title, 'happened_on', x.happened_on, 'score', pg_catalog.round(x.score::numeric, 2))
      order by x.score desc, x.happened_on desc), '[]'::jsonb)
  from (
    select a.id, a.number, a.title, a.happened_on,
           extensions.similarity(norm.fold(a.title), norm.fold(p_title)) as score
    from perf.achievement a
    join perf.achievement_category c on c.id = a.category_id
    where p_partner is not null and nullif(pg_catalog.btrim(p_title), '') is not null
      and a.partner_id = p_partner and a.deleted_at is null and a.id is distinct from p_exclude
      and c.code = pg_catalog.upper(pg_catalog.btrim(p_category))
      and a.happened_on between (coalesce(p_on, core.riyadh_today()) - interval '12 months')::date
                            and coalesce(p_on, core.riyadh_today())
      and perf.sees_department(p_person, a.department_id)
  ) x
  where x.score >= perf.repeat_threshold()
$$;

-- The read Log achievement calls before saving (V531): the possible repeats, for the one-tap choice.
create function perf.achievement_repeats(p_partner uuid, p_category text, p_title text, p_on date default null)
  returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'view');
begin
  return perf.repeats_for(me, p_partner, p_category, p_title, p_on);
end
$$;

-- An MoU sets the side chosen on it to Prospect from its signing day, only where that side is on and has no status at
-- all yet (V461, V521), and never a new client (C4). It is a consequence the rules attach to the member's own
-- achievement, not the member editing the side (V601, QA-512): no partner rights are asked, no owner is assigned, and it
-- is its own entry in the log — the logger as its person, "Prospect, from MoU ACH-…" as its words — so that undoing the
-- achievement never needs rights on the side. Returns the status change it made, or null.
create function perf.mou_prospect(p_achievement uuid, p_number text, p_partner uuid, p_side text, p_on date)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  outer_id text := pg_catalog.current_setting('app.request_id', true);
  outer_depth text := pg_catalog.current_setting('app.request_depth', true);
  sid uuid;
begin
  if p_partner is null or p_side is null
     or not exists (select 1 from partner.partner_side s
                    where s.partner_id = p_partner and s.side = p_side and s.deleted_at is null)
     or exists (select 1 from partner.side_status_change s
                where s.partner_id = p_partner and s.side = p_side and s.deleted_at is null) then
    return null;
  end if;
  perform pg_catalog.set_config('app.request_depth', '0', true);
  perform pg_catalog.set_config('app.request_id', '', true);
  perform audit.begin('ui', 'perf.mou_prospect', pg_catalog.jsonb_build_object('side', p_side, 'status', 'prospect',
                      'achievement', p_number, 'achievement_id', p_achievement));
  perform audit.happened(p_on);
  insert into partner.side_status_change (partner_id, side, status, effective_on, note)
  values (p_partner, p_side, 'prospect', p_on, 'From MoU ' || p_number)
  returning id into sid;
  perform audit.end();
  perform pg_catalog.set_config('app.request_id', coalesce(outer_id, ''), true);
  perform pg_catalog.set_config('app.request_depth', coalesce(nullif(outer_depth, ''), '0'), true);
  return sid;
end
$$;

-- Undoing an MoU achievement undoes the Prospect it set while the side is still Prospect from it — no other live status
-- change on that side; once the side has moved on, the side is left as it is (V601). Runs inside the undo's own request,
-- so a redo brings both back.
create function perf.achievement_undo_prospect() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  s partner.side_status_change;
begin
  select * into s from partner.side_status_change x where x.id = new.mou_status_id and x.deleted_at is null;
  if s.id is not null and not exists (
       select 1 from partner.side_status_change o
       where o.partner_id = s.partner_id and o.side = s.side and o.deleted_at is null and o.id <> s.id) then
    update partner.side_status_change
    set deleted_at = pg_catalog.now(), deleted_by = authz.me(), delete_reason = 'undo'
    where id = s.id;
  end if;
  return new;
end
$$;
create trigger undo_prospect after update of deleted_at on perf.achievement for each row
  when (old.deleted_at is null and new.deleted_at is not null and new.delete_reason = 'undo'
        and new.mou_status_id is not null)
  execute function perf.achievement_undo_prospect();

-- ================================================================ the doors: log, change, move, assign, remove
create function perf.achievement_refused(p_constraint text) returns text
language sql immutable set search_path = ''
as $$
  select case p_constraint
    when 'achievement_title_check' then 'achievement.title_required'
    when 'achievement_notes_check' then 'achievement.notes_too_long'
    when 'achievement_count_check' then 'achievement.count_invalid'
    when 'achievement_deal_value_check' then 'achievement.value_invalid'
    when 'achievement_happened_on_check' then 'achievement.before_2025'
    when 'achievement_not_after_logged' then 'common.date_in_future'
    when 'achievement_ref_value_check' then 'achievement.ref_value_required'
    when 'achievement_ref_url_check' then 'achievement.ref_url_invalid'
    when 'achievement_ref_no_secrets' then 'achievement.ref_looks_secret'
    when 'achievement_participant_role_check' then 'achievement.role_too_long'
    else 'common.invalid' end
$$;

-- Adds a reference to an achievement, the system named by its key (ticket, booking …).
create function perf.ref_insert(p_achievement uuid, p_system text, p_value text, p_url text) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  sys uuid;
  rid uuid;
  what text;
begin
  select r.id into sys from work.ref_system r where r.key = p_system and r.deleted_at is null and r.active;
  if sys is null then
    raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = coalesce(p_system, '');
  end if;
  begin
    insert into perf.achievement_ref (achievement_id, system_id, value, url)
    values (p_achievement, sys, pg_catalog.btrim(p_value), nullif(pg_catalog.btrim(p_url), ''))
    returning id into rid;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'achievement.ref_taken', detail = p_value;
    when check_violation or not_null_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = perf.achievement_refused(coalesce(what, 'achievement_ref_value_check'));
  end;
  return rid;
end
$$;

-- Log achievement (§3.8; V68, V400, V467): a category of the plan of its day's year — category first, then its
-- fields; happened_on is the date on the evidence (empty: a flagged draft that never counts, V68); the person's own,
-- or — for a manager with Full on KPIs — someone else's (V467). References and participants come in the same request;
-- a category that needs a reference (Technical integration: the Product ticket, V99) is refused without one.
create function perf.achievement_log(p_values jsonb, p_refs jsonb default null, p_participants uuid[] default null)
  returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'own');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  refs jsonb := coalesce(p_refs, '[]'::jsonb);
  k text;
  owner uuid := coalesce(nullif(v ->> 'owner_id', '')::uuid, me);
  day date := nullif(v ->> 'happened_on', '')::date;
  yr int;
  dept uuid;
  pl uuid;
  c perf.achievement_category;
  pid uuid := nullif(v ->> 'partner_id', '')::uuid;
  rep uuid := nullif(v ->> 'repeat_of', '')::uuid;
  side text := nullif(v ->> 'side', '');
  prospect boolean;
  aid uuid := gen_random_uuid();
  num text;
  sid uuid;
  req uuid;
  r jsonb;
  pp uuid;
  what text;
begin
  if pg_catalog.jsonb_typeof(v) <> 'object' or pg_catalog.jsonb_typeof(refs) <> 'array' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('category', 'title', 'notes', 'happened_on', 'partner_id', 'count', 'deal_value', 'owner_id',
                 'use_as_example', 'before_value', 'after_value', 'repeat_of', 'side') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if owner is distinct from me and authz.level_of(me, 'kpis') < 'full' then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'kpis', 'level', 'full')::text;
  end if;
  if day > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'common.date_in_future';
  end if;
  select p.department_id into dept from core.person p where p.id = owner;
  if dept is null or not perf.sees_department(me, dept) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'core.person';
  end if;
  yr := pg_catalog.date_part('year', coalesce(day, core.riyadh_today()))::int;
  pl := perf.plan_of(dept, yr);
  if pl is null then
    raise exception using errcode = 'P0001', message = 'achievement.no_plan', detail = yr::text;
  end if;
  c := perf.category_in(pl, v ->> 'category');
  if c.id is null then
    raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = coalesce(v ->> 'category', '');
  end if;
  if pid is not null and not authz.can_see_as(me, 'partner.partner', pid) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
  -- V521: an MoU with an organisation names the side it was signed with.
  prospect := c.sets_prospect or exists (select 1 from perf.achievement_category x where x.id = c.parent_id and x.sets_prospect);
  if side is not null and side not in ('client', 'supplier_partner') then
    raise exception using errcode = 'P0001', message = 'achievement.side_required';
  end if;
  if prospect and pid is not null and side is null then
    raise exception using errcode = 'P0001', message = 'achievement.side_required';
  end if;
  -- V531: "This is a new one" names the earlier achievement it repeats — one the person sees, same organisation and code.
  if rep is not null and not exists (
       select 1 from perf.achievement e join perf.achievement_category ec on ec.id = e.category_id
       where e.id = rep and e.deleted_at is null and e.partner_id is not distinct from pid and ec.code = c.code
         and perf.sees_department(me, e.department_id)) then
    raise exception using errcode = 'P0001', message = 'achievement.repeat_invalid';
  end if;
  if c.required_ref_system_id is not null and not exists (
       select 1 from pg_catalog.jsonb_array_elements(refs) x join work.ref_system s on s.key = x ->> 'system'
       where s.id = c.required_ref_system_id and nullif(pg_catalog.btrim(x ->> 'value'), '') is not null) then
    raise exception using errcode = 'P0001', message = 'achievement.ref_required',
      detail = (select s.key from work.ref_system s where s.id = c.required_ref_system_id);
  end if;
  req := audit.begin('ui', 'achievement.logged', pg_catalog.jsonb_build_object('category', c.code));
  perform audit.happened(day);
  num := perf.number_for(yr);
  if prospect and day is not null then
    sid := perf.mou_prospect(aid, num, pid, side, day);
  end if;
  begin
    insert into perf.achievement (id, number, plan_id, department_id, category_id, partner_id, title, notes, count,
                                  before_value, after_value, deal_value, happened_on, owner_id, use_as_example, origin,
                                  repeat_of, mou_side, mou_status_id)
    values (aid, num, pl, dept, c.id, pid, pg_catalog.btrim(v ->> 'title'),
            nullif(pg_catalog.btrim(v ->> 'notes'), ''), coalesce((v ->> 'count')::int, 1),
            (v ->> 'before_value')::numeric, (v ->> 'after_value')::numeric, (v ->> 'deal_value')::numeric, day, owner,
            coalesce((v ->> 'use_as_example')::boolean, false), 'person', rep, case when prospect then side end, sid);
  exception when check_violation or not_null_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = perf.achievement_refused(coalesce(what, 'achievement_title_check'));
  end;
  for r in select x from pg_catalog.jsonb_array_elements(refs) x loop
    perform perf.ref_insert(aid, r ->> 'system', r ->> 'value', r ->> 'url');
  end loop;
  foreach pp in array coalesce(p_participants, '{}') loop
    continue when pp = owner;
    insert into perf.achievement_participant (achievement_id, person_id) values (aid, pp) on conflict do nothing;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', aid, 'version', 1, 'request_id', req,
                                       'number', (select a.number from perf.achievement a where a.id = aid));
end
$$;

-- Its own people, or a manager with Full on KPIs, change an achievement's own fields — a manager changing someone
-- else's says why (§3.8). happened_on is the date on the evidence (V400): changing it moves the figures with it; a
-- manager's move into an earlier period with its mark is achievement_move. A deal value typed here is a person's, so
-- it no longer names a report (V502).
create function perf.achievement_update(p_id uuid, p_values jsonb, p_version int, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  a perf.achievement := perf.achievement_editable(p_id);
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  cat uuid := a.category_id;
  pid uuid := a.partner_id;
  day date := a.happened_on;
  req uuid;
  what text;
begin
  if pg_catalog.jsonb_typeof(v) <> 'object' or v = '{}'::jsonb then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('category', 'title', 'notes', 'happened_on', 'partner_id', 'count', 'deal_value', 'use_as_example',
                 'before_value', 'after_value') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if not perf.is_own(me, a) and nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  perform core.check_version('perf.achievement', p_id, p_version,
    array(select case x when 'category' then 'category_id' else x end from pg_catalog.jsonb_object_keys(v) x));
  if v ? 'happened_on' then
    day := nullif(v ->> 'happened_on', '')::date;
    if day > core.riyadh_today() then
      raise exception using errcode = 'P0001', message = 'common.date_in_future';
    end if;
    if day is null and a.happened_on is not null then
      raise exception using errcode = 'P0001', message = 'achievement.date_required';
    end if;
  end if;
  if v ? 'category' then
    cat := (perf.category_in(a.plan_id, v ->> 'category')).id;
    if cat is null then
      raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = coalesce(v ->> 'category', '');
    end if;
  end if;
  if v ? 'partner_id' then
    pid := nullif(v ->> 'partner_id', '')::uuid;
    if pid is not null and not authz.can_see_as(me, 'partner.partner', pid) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
    end if;
  end if;
  req := audit.begin('ui', 'achievement.changed', null, nullif(pg_catalog.btrim(p_reason), ''));
  perform perf.quiet_if_past(array[p_id]);
  begin
    update perf.achievement x set
      category_id = cat,
      partner_id = pid,
      happened_on = day,
      title = case when v ? 'title' then pg_catalog.btrim(v ->> 'title') else x.title end,
      notes = case when v ? 'notes' then nullif(pg_catalog.btrim(v ->> 'notes'), '') else x.notes end,
      count = case when v ? 'count' then (v ->> 'count')::int else x.count end,
      deal_value = case when v ? 'deal_value' then (v ->> 'deal_value')::numeric else x.deal_value end,
      value_report_kind = case when v ? 'deal_value' then null else x.value_report_kind end,
      value_report_period = case when v ? 'deal_value' then null else x.value_report_period end,
      use_as_example = case when v ? 'use_as_example' then coalesce((v ->> 'use_as_example')::boolean, false)
                            else x.use_as_example end,
      before_value = case when v ? 'before_value' then (v ->> 'before_value')::numeric else x.before_value end,
      after_value = case when v ? 'after_value' then (v ->> 'after_value')::numeric else x.after_value end
    where x.id = p_id;
  exception when check_violation or not_null_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = perf.achievement_refused(coalesce(what, 'achievement_title_check'));
  end;
  -- Re-filed under a category that needs a reference, live work brings it first (V99).
  if exists (select 1 from perf.achievement y join perf.achievement_category c on c.id = y.category_id
             where y.id = p_id and y.origin <> 'backfill' and c.required_ref_system_id is not null
               and not exists (select 1 from perf.achievement_ref r where r.achievement_id = y.id
                               and r.system_id = c.required_ref_system_id and r.deleted_at is null)) then
    raise exception using errcode = 'P0001', message = 'achievement.ref_required',
      detail = (select s.key from perf.achievement y join perf.achievement_category c on c.id = y.category_id
                join work.ref_system s on s.id = c.required_ref_system_id where y.id = p_id);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from perf.achievement x where x.id = p_id),
                                       'request_id', req);
end
$$;

-- A manager or admin moves an achievement into an earlier period, with a reason (V400): the "moved" mark keeps where it
-- was, who moved it and why; the KPIs of both periods follow the date.
create function perf.achievement_move(p_id uuid, p_to date, p_reason text, p_version int) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  a perf.achievement := perf.achievement_editable(p_id);
  req uuid;
begin
  if perf.row_level('perf.achievement', p_id, me) < 'full' then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'kpis', 'level', 'full')::text;
  end if;
  if nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if a.happened_on is null or p_to is null or core.month_of(p_to) >= core.month_of(a.happened_on) then
    raise exception using errcode = 'P0001', message = 'achievement.move_earlier_only';
  end if;
  perform core.check_version('perf.achievement', p_id, p_version, array['happened_on']);
  req := audit.begin('ui', 'achievement.moved', null, pg_catalog.btrim(p_reason));
  perform perf.quiet_if_past(array[p_id]);
  begin
    update perf.achievement set happened_on = p_to,
      period_moved_from = coalesce(period_moved_from, a.happened_on), period_move_reason = pg_catalog.btrim(p_reason),
      period_moved_by = me
    where id = p_id;
  exception when check_violation then
    raise exception using errcode = 'P0001', message = 'achievement.before_2025';
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from perf.achievement x where x.id = p_id),
                                       'request_id', req);
end
$$;

-- Needs an owner (V491): a manager with Full on KPIs gives achievements their owner — logged and undoable; past work
-- tells nobody.
create function perf.achievements_assign(p_ids uuid[], p_owner uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'full');
  i uuid;
  req uuid;
  k int;
begin
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if p_owner is null or not perf.person_ok(p_owner) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = coalesce(p_owner::text, '');
  end if;
  foreach i in array p_ids loop
    perform perf.achievement_editable(i);
    if perf.row_level('perf.achievement', i, me) < 'full' then
      raise exception using errcode = '42501', message = 'access.needs_level',
        detail = pg_catalog.jsonb_build_object('page', 'kpis', 'level', 'full')::text;
    end if;
  end loop;
  req := audit.begin('ui', 'achievement.assigned', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)),
                     p_reason);
  perform perf.quiet_if_past(p_ids);
  update perf.achievement set owner_id = p_owner where id = any (p_ids) and owner_id is distinct from p_owner;
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- The participants of an achievement, set as a whole: those left out are unlinked (a soft removal, undoable).
create function perf.achievement_participants_set(p_id uuid, p_people uuid[]) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  a perf.achievement := perf.achievement_editable(p_id);
  want uuid[] := array(select distinct x from pg_catalog.unnest(coalesce(p_people, '{}')) x
                       where x is distinct from a.owner_id);
  req uuid;
  pp uuid;
begin
  req := audit.begin('ui', 'achievement.participants_set', null);
  perform perf.quiet_if_past(array[p_id]);
  update perf.achievement_participant set deleted_at = core.clock(), deleted_by = authz.me()
  where achievement_id = p_id and deleted_at is null and person_id <> all (want);
  foreach pp in array want loop
    if not exists (select 1 from perf.achievement_participant x
                   where x.achievement_id = p_id and x.person_id = pp and x.deleted_at is null) then
      insert into perf.achievement_participant (achievement_id, person_id) values (p_id, pp);
    end if;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

create function perf.achievement_ref_add(p_id uuid, p_system text, p_value text, p_url text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  a perf.achievement := perf.achievement_editable(p_id);
  req uuid;
  rid uuid;
begin
  req := audit.begin('ui', 'achievement.ref_added', null);
  perform perf.quiet_if_past(array[a.id]);
  rid := perf.ref_insert(p_id, p_system, p_value, p_url);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'version', 1, 'request_id', req);
end
$$;

-- Removes references; the last one a category needs (the Product ticket of an integration) stays.
create function perf.achievement_refs_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  i uuid;
  aid uuid;
  ach uuid[] := '{}';
  req uuid;
  k int;
begin
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  foreach i in array p_ids loop
    select x.achievement_id into aid from perf.achievement_ref x where x.id = i and x.deleted_at is null;
    if aid is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    perform perf.achievement_editable(aid);
    ach := ach || aid;
  end loop;
  req := audit.begin('ui', 'achievement.ref_removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)),
                     p_reason);
  perform perf.quiet_if_past(ach);
  update perf.achievement_ref set deleted_at = core.clock(), deleted_by = authz.me(), delete_reason = p_reason
  where id = any (p_ids);
  get diagnostics k = row_count;
  if exists (select 1 from perf.achievement a join perf.achievement_category c on c.id = a.category_id
             where a.id = any (ach) and a.deleted_at is null and c.required_ref_system_id is not null
               and not exists (select 1 from perf.achievement_ref r where r.achievement_id = a.id
                               and r.system_id = c.required_ref_system_id and r.deleted_at is null)) then
    raise exception using errcode = 'P0001', message = 'achievement.ref_required';
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- Removing always says why (the brief; §3.8): its own people, or a manager for anyone's. One Undo restores it.
create function perf.achievements_remove(p_ids uuid[], p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  i uuid;
  req uuid;
  k int;
begin
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  foreach i in array p_ids loop
    perform perf.achievement_editable(i);
  end loop;
  req := audit.begin('ui', 'achievement.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)),
                     pg_catalog.btrim(p_reason));
  perform perf.quiet_if_past(p_ids);
  update perf.achievement set deleted_at = core.clock(), deleted_by = authz.me(), delete_reason = pg_catalog.btrim(p_reason)
  where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- ================================================================ the reads: flags, the list, one achievement
-- Flags (V68, V99, V400, V491): past work; Needs an owner; Backfilled; a draft (no date — never counts); no evidence
-- yet (no file, no reference, no source report); logged late (after go-live only, never backfilled); moved.
create function perf.achievement_flags(a perf.achievement) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'past_work', perf.is_past(a.origin, a.happened_on),
    'needs_owner', a.owner_id is null,
    'backfilled', a.origin = 'backfill',
    'draft', a.draft,
    'no_evidence', a.source_kind is null
                   and not exists (select 1 from perf.achievement_ref r where r.achievement_id = a.id and r.deleted_at is null)
                   and not exists (select 1 from core.file_link f where f.entity_table = 'perf.achievement'
                                   and f.entity_id = a.id and f.deleted_at is null),
    'logged_late', a.origin <> 'backfill' and a.happened_on is not null and core.logged_late(a.happened_on, a.logged_at),
    'moved', a.period_moved_from is not null)
$$;

create function perf.achievement_row(a perf.achievement, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', a.id, 'number', a.number, 'plan_id', a.plan_id, 'year', p.year, 'department_id', a.department_id,
    'repeat_of', a.repeat_of, 'repeat_of_number', (select e.number from perf.achievement e where e.id = a.repeat_of),
    'mou_side', a.mou_side,
    'category', c.code, 'category_en', c.name_en, 'category_ar', c.name_ar, 'parent_category', pc.code,
    'has_deal_value', c.has_deal_value, 'title', a.title, 'count', a.count, 'deal_value', a.deal_value,
    'value_report_kind', a.value_report_kind, 'value_report_period', a.value_report_period,
    'partner_id', a.partner_id, 'owner_id', a.owner_id, 'happened_on', a.happened_on, 'logged_at', a.logged_at,
    'origin', a.origin, 'source_kind', a.source_kind, 'source_period', a.source_period,
    'date_from_report', a.date_from_report, 'use_as_example', a.use_as_example, 'version', a.version,
    'line_en', perf.line_of(a.id, 'en'), 'line_ar', perf.line_of(a.id, 'ar'),
    'can_edit', perf.can_edit(p_reader, a),
    'participants', coalesce((select pg_catalog.jsonb_agg(x.person_id order by x.created_at, x.person_id)
                              from perf.achievement_participant x where x.achievement_id = a.id and x.deleted_at is null),
                             '[]'::jsonb)
  ) || perf.achievement_flags(a)
  from perf.plan p
  join perf.achievement_category c on c.id = a.category_id
  left join perf.achievement_category pc on pc.id = c.parent_id
  where p.id = a.plan_id
$$;

-- The list (Achievements under KPIs): the reader's departments, newest first, drafts on top. Filters: category (a code,
-- its sub-categories with it, across years), person_id (owner or participant), scope 'mine', month ('YYYY-MM'), year,
-- partner_id, backfilled, past_work (true: past work only; false: live only; absent: both), needs_owner, draft,
-- no_evidence, q.
create function perf.achievement_list(p_filter jsonb default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'view');
  f jsonb := coalesce(p_filter, '{}'::jsonb);
  lim int := greatest(1, least(coalesce(p_limit, 50), 200));
  off int := greatest(coalesce(p_offset, 0), 0);
  q text := norm.fold(f ->> 'q');
  who uuid := case when f ->> 'scope' = 'mine' then me else nullif(f ->> 'person_id', '')::uuid end;
  month date := case when f ->> 'month' ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then (f ->> 'month' || '-01')::date end;
  cat text := pg_catalog.upper(nullif(pg_catalog.btrim(f ->> 'category'), ''));
  rows jsonb;
  total int;
begin
  with hits as (
    select a, perf.achievement_flags(a) as fl
    from perf.achievement a
    join perf.achievement_category c on c.id = a.category_id
    left join perf.achievement_category pc on pc.id = c.parent_id
    where a.deleted_at is null and perf.sees_department(me, a.department_id)
      and (cat is null or c.code = cat or pc.code = cat)
      and (who is null or a.owner_id = who
           or exists (select 1 from perf.achievement_participant x
                      where x.achievement_id = a.id and x.person_id = who and x.deleted_at is null))
      and (month is null or (a.happened_on >= month and a.happened_on < (month + interval '1 month')::date))
      and (nullif(f ->> 'year', '') is null or pg_catalog.date_part('year', a.happened_on) = (f ->> 'year')::int)
      and (nullif(f ->> 'partner_id', '') is null or a.partner_id = (f ->> 'partner_id')::uuid)
      and (q is null or norm.fold(a.title) like '%' || q || '%' or norm.fold(a.number) like '%' || q || '%')
  ), flagged as (
    select * from hits h
    where (f -> 'backfilled' is null or (h.fl ->> 'backfilled')::boolean = (f ->> 'backfilled')::boolean)
      and (f -> 'past_work' is null or (h.fl ->> 'past_work')::boolean = (f ->> 'past_work')::boolean)
      and (not coalesce((f ->> 'needs_owner')::boolean, false) or (h.fl ->> 'needs_owner')::boolean)
      and (f -> 'draft' is null or (h.fl ->> 'draft')::boolean = (f ->> 'draft')::boolean)
      and (not coalesce((f ->> 'no_evidence')::boolean, false) or (h.fl ->> 'no_evidence')::boolean)
  )
  select (select pg_catalog.count(*)::int from flagged),
         coalesce((select pg_catalog.jsonb_agg(perf.achievement_row(x.a, me) order by x.o)
                   from (select y.a, pg_catalog.row_number() over (
                                  order by (y.a).happened_on desc nulls first, (y.a).logged_at desc, (y.a).id) o
                         from flagged y) x
                   where x.o > off and x.o <= off + lim), '[]'::jsonb)
    into total, rows;
  return pg_catalog.jsonb_build_object('rows', rows, 'total', total, 'more', total > off + lim);
end
$$;

-- One achievement with its references (and each one's link from its system's pattern, V99), its participants with
-- their roles, its notes, the moved mark and who logged it — for whoever may see it.
create function perf.achievement_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  a perf.achievement;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into a from perf.achievement where id = p_id and deleted_at is null;
  if a.id is null or perf.row_level('perf.achievement', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return perf.achievement_row(a, me) || pg_catalog.jsonb_build_object(
    'notes', a.notes, 'before_value', a.before_value, 'after_value', a.after_value, 'created_by', a.created_by,
    'moved_from', a.period_moved_from, 'move_reason', a.period_move_reason, 'moved_by', a.period_moved_by,
    'import_key', a.import_key,
    'refs', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', r.id, 'system', s.key, 'system_en', s.name_en, 'system_ar', s.name_ar, 'value', r.value,
        'url', coalesce(r.url, pg_catalog.replace(s.url_template, '{value}', r.value)), 'version', r.version)
        order by r.created_at)
      from perf.achievement_ref r join work.ref_system s on s.id = r.system_id
      where r.achievement_id = p_id and r.deleted_at is null), '[]'::jsonb),
    'participant_roles', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', x.id, 'person_id', x.person_id, 'role', x.role) order by x.created_at)
      from perf.achievement_participant x where x.achievement_id = p_id and x.deleted_at is null), '[]'::jsonb));
end
$$;

-- ================================================================ the Past work grid's door (V400, V491, V502, V504–V506)
-- The keys already held, for the grid's preview (OLD-PRF-045), each with its deal value and where that came from — a
-- report, typed by a person, or blank — so the preview can say which held rows a newer report would update (V502;
-- builder C on #148).
create function perf.backfill_keys_held(p_keys text[]) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'view');
begin
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                     'key', a.import_key, 'amount', a.deal_value, 'from_kind', a.value_report_kind,
                     'from_period', a.value_report_period,
                     'typed', a.deal_value is not null and a.value_report_kind is null) order by a.import_key)
                   from perf.achievement a
                   where a.import_key = any (coalesce(p_keys, '{}')) and a.deleted_at is null
                     and perf.sees_department(me, a.department_id)), '[]'::jsonb);
end
$$;

-- request (the grid's, #105): { mode: 'achievements', origin: 'backfill', source: { kind, period, last_day },
-- rows: [{ title, happened_on, date_from_report, kind (a category code of the row's year), organisation_id, notes,
-- person_id, owner_unknown, import_key, value }] }. Each row: Backfilled, its day or — undated — the report's last day
-- (V504), the report its evidence (V506), its owner, the paster, or Unknown (V491; someone else's or Unknown needs Full
-- on KPIs), its plan the one of its year in the owner's department (else the paster's). A key already held is left
-- out and named — unless the row brings a deal value from a newer report than the one the stored value came from
-- (V502: a later last day; on the same day the quarterly beats the monthly) or the stored value is blank: then the
-- value is replaced, the older kept in the change log (V500), and the key named under "updated". A value a person
-- typed is never replaced by a report: named under "kept". Every other refusal refuses the whole paste, naming the row
-- (its index, from 0). Nothing it saves tells anyone, and nothing is ever "logged late".
create function perf.backfill_achievements(p_request jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'own');
  full_access boolean := authz.level_of(authz.me(), 'kpis') >= 'full';
  src jsonb := p_request -> 'source';
  last_day date := nullif(src ->> 'last_day', '')::date;
  r jsonb;
  i int := -1;
  day date;
  first_day date;
  owner uuid;
  dept uuid;
  pl uuid;
  c perf.achievement_category;
  pid uuid;
  val numeric;
  cur perf.achievement;
  aid uuid;
  req uuid;
  what text;
  ids uuid[] := '{}';
  touched uuid[] := '{}';
  held jsonb := '[]'::jsonb;
  updated jsonb := '[]'::jsonb;
  kept jsonb := '[]'::jsonb;
  repeats jsonb := '[]'::jsonb;
begin
  if p_request is null or pg_catalog.jsonb_typeof(p_request -> 'rows') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_request -> 'rows') = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if coalesce(p_request ->> 'mode', 'achievements') <> 'achievements'
     or coalesce(p_request ->> 'origin', 'backfill') <> 'backfill' then
    raise exception using errcode = 'P0001', message = 'backfill.mode_invalid';
  end if;
  if src ->> 'kind' is null or src ->> 'kind' not in ('bd_monthly', 'partnerships', 'commercial_quarterly', 'improvements')
     or perf.period_last_day(src ->> 'period') is null or last_day is distinct from perf.period_last_day(src ->> 'period')
     or ((src ->> 'kind' = 'commercial_quarterly') <> (src ->> 'period' ~ 'Q')) then
    raise exception using errcode = 'P0001', message = 'backfill.source_required';
  end if;
  if last_day > core.riyadh_today() then
    raise exception using errcode = 'P0001', message = 'common.date_in_future';
  end if;
  req := audit.begin('ui', 'achievement.backfilled', pg_catalog.jsonb_build_object(
    'count', pg_catalog.jsonb_array_length(p_request -> 'rows'), 'source', src ->> 'kind', 'period', src ->> 'period'));
  for r in select x from pg_catalog.jsonb_array_elements(p_request -> 'rows') x loop
    i := i + 1;
    val := nullif(r ->> 'value', '')::numeric;
    if val < 0 then
      raise exception using errcode = 'P0001', message = 'achievement.value_invalid', detail = i::text;
    end if;
    -- A key already held: left out — or its deal value taken from a newer report (V502).
    select * into cur from perf.achievement a
    where a.import_key = nullif(r ->> 'import_key', '') and a.deleted_at is null;
    if cur.id is not null then
      if val is not null and val is distinct from cur.deal_value then
        if not perf.can_edit(me, cur) then
          raise exception using errcode = '42501', message = 'access.needs_level',
            detail = pg_catalog.jsonb_build_object('page', 'kpis', 'level', 'own', 'row', i)::text;
        end if;
        if cur.deal_value is null
           or (cur.value_report_kind is not null
               and perf.report_newer(src ->> 'kind', src ->> 'period', cur.value_report_kind, cur.value_report_period)) then
          begin
            update perf.achievement set deal_value = val, value_report_kind = src ->> 'kind',
              value_report_period = src ->> 'period'
            where id = cur.id;
          exception
            when check_violation then
              get stacked diagnostics what = constraint_name;
              raise exception using errcode = 'P0001', message = perf.achievement_refused(what), detail = i::text;
            when raise_exception then
              get stacked diagnostics what = message_text;
              raise exception using errcode = 'P0001', message = what, detail = i::text;
          end;
          updated := updated || pg_catalog.to_jsonb(cur.import_key);
          touched := touched || cur.id;
          first_day := least(coalesce(first_day, cur.happened_on), cur.happened_on);
          continue;
        end if;
        if cur.value_report_kind is null then
          kept := kept || pg_catalog.to_jsonb(cur.import_key);
          continue;
        end if;
      end if;
      held := held || pg_catalog.to_jsonb(cur.import_key);
      continue;
    end if;
    day := coalesce(nullif(r ->> 'happened_on', '')::date, last_day);
    if day < date '2025-01-01' then
      raise exception using errcode = 'P0001', message = 'backfill.before_2025', detail = i::text;
    end if;
    if day > core.riyadh_today() then
      raise exception using errcode = 'P0001', message = 'common.date_in_future', detail = i::text;
    end if;
    owner := case when coalesce((r ->> 'owner_unknown')::boolean, false) then null
                  else coalesce(nullif(r ->> 'person_id', '')::uuid, me) end;
    if owner is distinct from me and not full_access then
      raise exception using errcode = '42501', message = 'access.needs_level',
        detail = pg_catalog.jsonb_build_object('page', 'kpis', 'level', 'full', 'row', i)::text;
    end if;
    dept := coalesce((select p.department_id from core.person p where p.id = owner),
                     (select p.department_id from core.person p where p.id = me));
    if not perf.sees_department(me, dept) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = i::text;
    end if;
    pl := perf.plan_of(dept, pg_catalog.date_part('year', day)::int);
    if pl is null then
      raise exception using errcode = 'P0001', message = 'achievement.no_plan',
        detail = i::text || ':' || pg_catalog.date_part('year', day)::int;
    end if;
    c := perf.category_in(pl, r ->> 'kind');
    if c.id is null then
      raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = i::text;
    end if;
    -- A category's required reference is asked of live work only: the report stands as past work's evidence (V506).
    pid := nullif(r ->> 'organisation_id', '')::uuid;
    if pid is not null and not authz.can_see_as(me, 'partner.partner', pid) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = i::text;
    end if;
    begin
      insert into perf.achievement (number, plan_id, department_id, category_id, partner_id, title, notes, deal_value,
                                    value_report_kind, value_report_period, happened_on, owner_id, origin, source_kind,
                                    source_period, date_from_report, import_key)
      values (perf.number_for(pg_catalog.date_part('year', day)::int), pl, dept, c.id, pid, pg_catalog.btrim(r ->> 'title'), nullif(pg_catalog.btrim(r ->> 'notes'), ''), val,
              case when val is not null then src ->> 'kind' end, case when val is not null then src ->> 'period' end,
              day, owner, 'backfill', src ->> 'kind', src ->> 'period', nullif(r ->> 'happened_on', '') is null,
              nullif(r ->> 'import_key', ''))
      returning id into aid;
    exception
      when check_violation or not_null_violation then
        get stacked diagnostics what = constraint_name;
        raise exception using errcode = 'P0001', message = perf.achievement_refused(coalesce(what, 'achievement_title_check')),
          detail = i::text;
      when raise_exception then
        get stacked diagnostics what = message_text;
        raise exception using errcode = 'P0001', message = what, detail = i::text;
    end;
    ids := ids || aid;
    first_day := least(coalesce(first_day, day), day);
    -- V531: a paste never prompts; it names the rows that may repeat an earlier achievement.
    if pid is not null then
      repeats := repeats || (select pg_catalog.jsonb_build_object('row', i, 'id', aid, 'matches', m)
                             from (select perf.repeats_for(me, pid, c.code, r ->> 'title', day, aid) as m) x
                             where m <> '[]'::jsonb);
    end if;
  end loop;
  if first_day is not null then
    perform audit.happened(least(first_day, core.riyadh_today() - 1));    -- past work tells nobody (V491)
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object(
    'request_id', case when pg_catalog.cardinality(ids) + pg_catalog.cardinality(touched) > 0 then req end,
    'saved', pg_catalog.cardinality(ids), 'ids', pg_catalog.to_jsonb(ids),
    'held', held, 'updated', updated, 'kept', kept, 'repeats', repeats);
end
$$;

-- ================================================================ grants and the doors (V124)
grant usage on schema perf to authenticated;
grant execute on function
  perf.plan_open(uuid, int, text), perf.plans(uuid), perf.category_save(uuid, uuid, jsonb, int),
  perf.categories_remove(uuid[], text), perf.categories(uuid, int, uuid), perf.achievement_line(uuid, text),
  perf.achievement_log(jsonb, jsonb, uuid[]), perf.achievement_update(uuid, jsonb, int, text),
  perf.achievement_move(uuid, date, text, int), perf.achievements_assign(uuid[], uuid, text),
  perf.achievement_participants_set(uuid, uuid[]), perf.achievement_ref_add(uuid, text, text, text),
  perf.achievement_refs_remove(uuid[], text), perf.achievements_remove(uuid[], text),
  perf.achievement_list(jsonb, int, int), perf.achievement_get(uuid), perf.backfill_keys_held(text[]),
  perf.backfill_achievements(jsonb), perf.achievement_repeats(uuid, text, text, date)
  to authenticated;

create function api.plan_open(p_department uuid, p_year int, p_name text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select perf.plan_open(p_department, p_year, p_name) $$;
create function api.plans(p_department uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select perf.plans(p_department) $$;
create function api.achievement_category_save(p_id uuid, p_plan uuid, p_values jsonb, p_version int default null)
  returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select perf.category_save(p_id, p_plan, p_values, p_version) $$;
create function api.achievement_categories_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select perf.categories_remove(p_ids, p_reason) $$;
create function api.achievement_categories(p_plan uuid default null, p_year int default null, p_department uuid default null)
  returns jsonb
language sql stable security invoker set search_path = '' as $$ select perf.categories(p_plan, p_year, p_department) $$;
create function api.achievement_log(p_values jsonb, p_refs jsonb default null, p_participants uuid[] default null)
  returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select perf.achievement_log(p_values, p_refs, p_participants) $$;
create function api.achievement_update(p_id uuid, p_values jsonb, p_version int, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select perf.achievement_update(p_id, p_values, p_version, p_reason) $$;
create function api.achievement_move(p_id uuid, p_to date, p_reason text, p_version int) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select perf.achievement_move(p_id, p_to, p_reason, p_version) $$;
create function api.achievements_assign(p_ids uuid[], p_owner uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select perf.achievements_assign(p_ids, p_owner, p_reason) $$;
create function api.achievement_participants_set(p_id uuid, p_people uuid[]) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select perf.achievement_participants_set(p_id, p_people) $$;
create function api.achievement_ref_add(p_id uuid, p_system text, p_value text, p_url text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select perf.achievement_ref_add(p_id, p_system, p_value, p_url) $$;
create function api.achievement_refs_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select perf.achievement_refs_remove(p_ids, p_reason) $$;
create function api.achievements_remove(p_ids uuid[], p_reason text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select perf.achievements_remove(p_ids, p_reason) $$;
create function api.achievements(p_filter jsonb default null, p_limit int default 50, p_offset int default 0) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select perf.achievement_list(p_filter, p_limit, p_offset) $$;
create function api.achievement(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select perf.achievement_get(p_id) $$;
create function api.achievement_line(p_id uuid, p_locale text default 'en') returns text
language sql stable security invoker set search_path = '' as $$ select perf.achievement_line(p_id, p_locale) $$;
create function api.backfill_achievement_keys_held(p_keys text[]) returns jsonb
language sql stable security invoker set search_path = '' as $$ select perf.backfill_keys_held(p_keys) $$;
create function api.backfill_achievements(p_request jsonb) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select perf.backfill_achievements(p_request) $$;
create function api.achievement_repeats(p_partner uuid, p_category text, p_title text, p_on date default null)
  returns jsonb
language sql stable security invoker set search_path = ''
as $$ select perf.achievement_repeats(p_partner, p_category, p_title, p_on) $$;
grant execute on function
  api.achievement_repeats(uuid, text, text, date),
  api.plan_open(uuid, int, text), api.plans(uuid), api.achievement_category_save(uuid, uuid, jsonb, int),
  api.achievement_categories_remove(uuid[], text), api.achievement_categories(uuid, int, uuid),
  api.achievement_log(jsonb, jsonb, uuid[]), api.achievement_update(uuid, jsonb, int, text),
  api.achievement_move(uuid, date, text, int), api.achievements_assign(uuid[], uuid, text),
  api.achievement_participants_set(uuid, uuid[]), api.achievement_ref_add(uuid, text, text, text),
  api.achievement_refs_remove(uuid[], text), api.achievements_remove(uuid[], text),
  api.achievements(jsonb, int, int), api.achievement(uuid), api.achievement_line(uuid, text),
  api.backfill_achievement_keys_held(text[]), api.backfill_achievements(jsonb)
  to authenticated;
