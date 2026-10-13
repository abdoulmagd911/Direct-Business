-- P6-1a, Reports data part 1 (TECH-SPEC §3.9; V57, V58, V76, V79, V403, OLD-052, OLD-PRF-067, OLD-PRF-069): the report,
-- its template and sections, its named editors, the two kinds of line, issue (a frozen snapshot with its SHA-256 and
-- a number), a double Issue answering "Already issued as …", correction and superseding, and an issued report never
-- removed. The sections that read KPIs (tiles, month additions, results, gaps), Compare, search, legacy reports, drift
-- and "added / revised since issue" come in the next parts (P6-1b, P6-1c); KPIs themselves are P5-4. Forward-only.

create schema report;

-- ================================================================ sections and templates — "sections are a setting"
-- The kinds of section a template may hold; synced from code, each with the label the screen words it by.
create table report.section_def (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  kind text not null check (kind in ('cover', 'kpi_tiles', 'kpi_month_additions', 'kpi_results', 'achievements_by_category',
                                     'challenges', 'period_targets', 'operational_plan', 'revenue_by_service', 'cases',
                                     'partners_at_risk', 'added_to_earlier_periods', 'free_text')),
  label_key text not null check (label_key ~ '^[a-z][a-z0-9_.]*$'),
  takes_lines boolean not null default false,    -- editors write lines in it (the others are computed)
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1
);

-- A department's template for a kind of report (null department: the company's), dated: the newest whose
-- effective_from is on or before the period's start is the one a new report takes.
create table report.template (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references core.department (id),
  kind text not null check (kind in ('monthly', 'quarterly', 'yearly')),
  sections text[] not null check (pg_catalog.cardinality(sections) between 1 and 30),
  print_languages text[] not null default '{ar}'
    check (pg_catalog.cardinality(print_languages) >= 1 and print_languages <@ array['ar', 'en']),   -- V76, V403
  review boolean not null default false,                                  -- "Submit for review" (optional)
  effective_from date not null,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index template_one_per_day on report.template (coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
                                                            kind, effective_from) where deleted_at is null;

-- Named report editors and the optional reviewers of a department (V57, V79): editors edit its drafts whatever
-- their level on Reports.
create table report.editor (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references core.department (id),
  person_id uuid not null references core.person (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index editor_live on report.editor (department_id, person_id) where deleted_at is null;
create table report.reviewer (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references core.department (id),
  person_id uuid not null references core.person (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index reviewer_live on report.reviewer (department_id, person_id) where deleted_at is null;

-- ================================================================ the report
create table report.report (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references core.department (id),
  kind text not null check (kind in ('monthly', 'quarterly', 'yearly')),
  period_start date not null,
  period_end date not null,
  plan_id uuid references perf.plan (id),
  template_id uuid references report.template (id),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'issued', 'superseded', 'legacy')),
  number text unique check (number is null or number ~ '^[A-Z][A-Z0-9_]*-[MQY]-[0-9]{4}(-([0-9]{2}|Q[1-4]))?(-C[0-9]+)?$'),
  issued_at timestamptz,
  issued_by uuid references core.person (id),
  supersedes_id uuid references report.report (id),
  correction_note text check (correction_note is null or (pg_catalog.btrim(correction_note) <> ''
                                                          and pg_catalog.length(correction_note) <= 2000)),
  snapshot jsonb,
  snapshot_sha256 text check (snapshot_sha256 is null or snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint report_period check (period_end >= period_start),
  constraint report_issued_whole check ((status in ('issued', 'superseded'))
                                        = (number is not null and issued_at is not null and snapshot is not null
                                           and snapshot_sha256 is not null)),
  constraint report_correction_says_why check ((supersedes_id is null) = (correction_note is null)),
  constraint report_issued_never_removed check (deleted_at is null or status in ('draft', 'in_review'))   -- OLD-PRF-069
);
-- One issued report per department, kind and period; one open draft per period besides a correction's.
create unique index report_one_issued on report.report (department_id, kind, period_start) where status = 'issued';
create unique index report_one_draft on report.report (department_id, kind, period_start)
  where status in ('draft', 'in_review') and deleted_at is null and supersedes_id is null;
create unique index report_one_correction on report.report (supersedes_id)
  where supersedes_id is not null and deleted_at is null and status in ('draft', 'in_review');

-- ================================================================ lines (V79): an Achievement line or a Note line
create table report.line (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references report.report (id),
  section_key text not null references report.section_def (key),
  kind text not null check (kind in ('achievement', 'note')),
  category_id uuid references perf.achievement_category (id),
  text_en text check (text_en is null or pg_catalog.length(text_en) <= 4000),
  text_ar text check (text_ar is null or pg_catalog.length(text_ar) <= 4000),
  text_en_draft boolean not null default false,       -- the Translate helper's draft, until the editor edits or confirms it
  text_ar_draft boolean not null default false,
  sort int not null check (sort between 1 and 10000),
  show_amount boolean not null default false,
  amount_source text check (amount_source in ('invoices', 'field')),
  amount_field_key text check (amount_field_key is null or amount_field_key ~ '^[a-z][a-z0-9_]*$'),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint line_has_text check (pg_catalog.btrim(coalesce(text_en, '')) <> '' or pg_catalog.btrim(coalesce(text_ar, '')) <> ''),
  -- a note never counts: no amount, no category (V79)
  constraint line_note_carries_nothing check (kind = 'achievement'
                                              or (not show_amount and amount_source is null and amount_field_key is null
                                                  and category_id is null)),
  constraint line_field_named check ((amount_source = 'field') = (amount_field_key is not null))
);
create index line_report on report.line (report_id, section_key, sort) where deleted_at is null;

-- What an Achievement line cites (V79, V531): achievements, and invoices directly.
create table report.line_achievement (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references report.line (id),
  achievement_id uuid not null references perf.achievement (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index line_achievement_live on report.line_achievement (line_id, achievement_id) where deleted_at is null;
create table report.line_invoice (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references report.line (id),
  invoice_id uuid not null references finance.invoice (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index line_invoice_live on report.line_invoice (line_id, invoice_id) where deleted_at is null;

alter table perf.achievement add constraint achievement_origin_report
  foreign key (origin_report_id) references report.report (id);
create index achievement_origin_report on perf.achievement (origin_report_id);

do $$
declare
  t text;
begin
  foreach t in array array['report.section_def', 'report.template', 'report.editor', 'report.reviewer', 'report.report',
                           'report.line', 'report.line_achievement', 'report.line_invoice'] loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;
select core.index_foreign_keys('report');

-- ================================================================ the starting sections and templates
insert into report.section_def (key, kind, label_key, takes_lines, created_by) values
  ('cover', 'cover', 'report.section.cover', false, core.system_person_id()),
  ('kpi_tiles', 'kpi_tiles', 'report.section.kpi_tiles', false, core.system_person_id()),
  ('kpi_month_additions', 'kpi_month_additions', 'report.section.kpi_month_additions', false, core.system_person_id()),
  ('kpi_results', 'kpi_results', 'report.section.kpi_results', false, core.system_person_id()),
  ('achievements_by_category', 'achievements_by_category', 'report.section.achievements_by_category', true,
   core.system_person_id()),
  ('challenges', 'challenges', 'report.section.challenges', true, core.system_person_id()),
  ('period_targets', 'period_targets', 'report.section.period_targets', true, core.system_person_id()),
  ('operational_plan', 'operational_plan', 'report.section.operational_plan', false, core.system_person_id()),
  ('revenue_by_service', 'revenue_by_service', 'report.section.revenue_by_service', false, core.system_person_id()),
  ('cases', 'cases', 'report.section.cases', true, core.system_person_id()),
  ('partners_at_risk', 'partners_at_risk', 'report.section.partners_at_risk', false, core.system_person_id()),
  ('added_to_earlier_periods', 'added_to_earlier_periods', 'report.section.added_to_earlier_periods', false,
   core.system_person_id()),
  ('free_text', 'free_text', 'report.section.free_text', true, core.system_person_id());

-- The company's starting templates (§3.9 "the two report kinds"); a department's own come from Settings.
insert into report.template (department_id, kind, sections, effective_from, created_by) values
  (null, 'monthly', array['cover', 'kpi_month_additions', 'kpi_tiles', 'achievements_by_category', 'partners_at_risk',
                          'challenges', 'period_targets', 'added_to_earlier_periods'], date '2025-01-01', core.system_person_id()),
  (null, 'quarterly', array['cover', 'kpi_tiles', 'achievements_by_category', 'kpi_results', 'cases', 'partners_at_risk',
                            'challenges', 'period_targets', 'operational_plan', 'added_to_earlier_periods'], date '2025-01-01',
   core.system_person_id());

-- ================================================================ who may read and who may edit
-- A report is read by those who see its department with View on Reports; its drafts are edited by the department's
-- named editors whatever their level, or by Full on Reports (V57, V79).
create function report.sees(p_person uuid, p_department uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select work.sees_department(p_person, p_department) and authz.level_of(p_person, 'reports') >= 'view' $$;

create function report.can_edit(p_person uuid, p_department uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select work.sees_department(p_person, p_department)
         and (authz.level_of(p_person, 'reports') >= 'full'
              or exists (select 1 from report.editor e
                         where e.department_id = p_department and e.person_id = p_person and e.deleted_at is null))
$$;

-- The report a report row belongs to, and the record types' level function (core.entity.level).
create function report.report_of(p_table text, p_id uuid) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  case p_table
    when 'report.report' then return p_id;
    when 'report.line' then return (select x.report_id from report.line x where x.id = p_id);
    when 'report.line_achievement' then
      return (select l.report_id from report.line_achievement x join report.line l on l.id = x.line_id where x.id = p_id);
    when 'report.line_invoice' then
      return (select l.report_id from report.line_invoice x join report.line l on l.id = x.line_id where x.id = p_id);
    else return null;
  end case;
end
$$;

create function report.row_level(p_table text, p_id uuid, p_person uuid) returns core.level
language sql stable security definer set search_path = ''
as $$
  select case when r.id is null or not report.sees(p_person, r.department_id) then 'none'::core.level
              when r.status in ('draft', 'in_review') and report.can_edit(p_person, r.department_id) then 'full'::core.level
              else 'view'::core.level end
  from (select report.report_of(p_table, p_id) as rid) k
  left join report.report r on r.id = k.rid
$$;

-- The report, locked, for a change to its draft.
create function report.draft_for_edit(p_report uuid, p_me uuid) returns report.report
language plpgsql security definer set search_path = ''
as $$
declare
  r report.report;
begin
  select * into r from report.report x where x.id = p_report and x.deleted_at is null for update;
  if r.id is null or not report.sees(p_me, r.department_id) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'report.report';
  end if;
  if not report.can_edit(p_me, r.department_id) then
    raise exception using errcode = '42501', message = 'report.editors_only';
  end if;
  if r.status not in ('draft', 'in_review') then
    raise exception using errcode = 'P0001', message = 'report.not_a_draft', detail = coalesce(r.number, r.status);
  end if;
  return r;
end
$$;

-- ================================================================ open a draft
create function report.create(p_kind text, p_period_start date, p_department uuid default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  dept uuid := coalesce(p_department, (select p.department_id from core.person p where p.id = me));
  start date;
  finish date;
  t report.template;
  rid uuid;
  req uuid;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_kind not in ('monthly', 'quarterly', 'yearly') then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'kind';
  end if;
  if dept is null or not report.sees(me, dept) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'core.department';
  end if;
  if not report.can_edit(me, dept) then
    raise exception using errcode = '42501', message = 'report.editors_only';
  end if;
  start := pg_catalog.date_trunc(case p_kind when 'monthly' then 'month' when 'quarterly' then 'quarter' else 'year' end,
                                 p_period_start)::date;
  if p_period_start is null or start <> p_period_start then
    raise exception using errcode = 'P0001', message = 'report.period_start', detail = p_kind;
  end if;
  finish := (start + case p_kind when 'monthly' then interval '1 month' when 'quarterly' then interval '3 months'
                                 else interval '1 year' end - interval '1 day')::date;
  select * into t from report.template x
  where x.kind = p_kind and x.deleted_at is null and x.effective_from <= start
    and (x.department_id = dept or x.department_id is null)
  order by x.department_id is null, x.effective_from desc
  limit 1;
  if t.id is null then
    raise exception using errcode = 'P0002', message = 'report.no_template', detail = p_kind;
  end if;
  -- an issued period is changed through its correction, never a second report of its own
  if exists (select 1 from report.report x where x.department_id = dept and x.kind = p_kind and x.period_start = start
               and x.status = 'issued') then
    raise exception using errcode = 'P0001', message = 'report.already_issued',
      detail = (select x.number from report.report x where x.department_id = dept and x.kind = p_kind
                  and x.period_start = start and x.status = 'issued');
  end if;
  req := audit.begin('ui', 'report.created', pg_catalog.jsonb_build_object('kind', p_kind, 'period', start));
  begin
    insert into report.report (department_id, kind, period_start, period_end, plan_id, template_id, created_by)
    values (dept, p_kind, start, finish, perf.plan_of(dept, pg_catalog.date_part('year', start)::int), t.id, me)
    returning id into rid;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'report.draft_exists',
      detail = (select x.id from report.report x
                where x.department_id = dept and x.kind = p_kind and x.period_start = start and x.deleted_at is null
                  and x.status in ('draft', 'in_review') and x.supersedes_id is null)::text;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'request_id', req);
end
$$;

-- ================================================================ lines
-- A note whose text holds a money figure — a number with SAR, ريال or ر.س on either side — is refused (V79).
create function report.has_money(p text) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(p, '') ~* '[0-9٠-٩][0-9٠-٩,.٬٫]*[[:space:]]*(sar\M|ريال|ر[.]?[[:space:]]?س)'
         or coalesce(p, '') ~* '(\msar|ريال|ر[.]?[[:space:]]?س)[[:space:]]*[0-9٠-٩]'
$$;

-- The checks every line passes, on add and on edit: the section takes lines in this report's template; a note cites
-- nothing and holds no money figure; an Achievement line cites at least one achievement, each one the editor may see
-- in the report's department; invoices only for a reader with View on Finance.
create function report.line_check(r report.report, p_me uuid, p_section text, p_kind text, p_text_en text,
                                  p_text_ar text, p_achievements uuid[], p_invoices uuid[], p_show_amount boolean,
                                  p_amount_source text) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  sections text[] := (select t.sections from report.template t where t.id = r.template_id);
  a uuid;
begin
  if not (p_section = any (sections))
     or not exists (select 1 from report.section_def d where d.key = p_section and d.takes_lines) then
    raise exception using errcode = 'P0001', message = 'report.unknown_section', detail = coalesce(p_section, '');
  end if;
  if p_kind = 'note' then
    if pg_catalog.cardinality(coalesce(p_achievements, '{}')) > 0 or pg_catalog.cardinality(coalesce(p_invoices, '{}')) > 0
       or coalesce(p_show_amount, false) or p_amount_source is not null then
      raise exception using errcode = 'P0001', message = 'report.note_cites_nothing';
    end if;
    if report.has_money(p_text_en) or report.has_money(p_text_ar) then
      raise exception using errcode = 'P0001', message = 'report.note_has_money';
    end if;
  elsif p_kind = 'achievement' then
    if pg_catalog.cardinality(coalesce(p_achievements, '{}')) = 0 then
      raise exception using errcode = 'P0001', message = 'report.line_cites_an_achievement';
    end if;
    foreach a in array p_achievements loop
      if not exists (select 1 from perf.achievement x where x.id = a and x.deleted_at is null
                       and x.department_id = r.department_id)
         or perf.row_level('perf.achievement', a, p_me) < 'view' then
        raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'perf.achievement';
      end if;
    end loop;
    if pg_catalog.cardinality(coalesce(p_invoices, '{}')) > 0 then
      if authz.level_of(p_me, 'finance') < 'view' then
        raise exception using errcode = '42501', message = 'access.needs_level',
          detail = pg_catalog.jsonb_build_object('page', 'finance', 'level', 'view')::text;
      end if;
      if exists (select 1 from pg_catalog.unnest(p_invoices) i(id)
                 where not exists (select 1 from finance.invoice v where v.id = i.id and v.deleted_at is null)) then
        raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'finance.invoice';
      end if;
    end if;
  else
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'kind';
  end if;
end
$$;

-- The citations of a line become exactly these: the ones left out are archived, new ones added.
create function report.line_cite(p_line uuid, p_achievements uuid[], p_invoices uuid[], p_me uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update report.line_achievement x set deleted_at = pg_catalog.now(), deleted_by = p_me, delete_reason = 'no longer cited'
  where x.line_id = p_line and x.deleted_at is null and not (x.achievement_id = any (coalesce(p_achievements, '{}')));
  insert into report.line_achievement (line_id, achievement_id, created_by)
  select p_line, a, p_me from (select distinct pg_catalog.unnest(coalesce(p_achievements, '{}')) as a) s
  where not exists (select 1 from report.line_achievement x where x.line_id = p_line and x.achievement_id = s.a
                      and x.deleted_at is null);
  update report.line_invoice x set deleted_at = pg_catalog.now(), deleted_by = p_me, delete_reason = 'no longer cited'
  where x.line_id = p_line and x.deleted_at is null and not (x.invoice_id = any (coalesce(p_invoices, '{}')));
  insert into report.line_invoice (line_id, invoice_id, created_by)
  select p_line, i, p_me from (select distinct pg_catalog.unnest(coalesce(p_invoices, '{}')) as i) s
  where not exists (select 1 from report.line_invoice x where x.line_id = p_line and x.invoice_id = s.i
                      and x.deleted_at is null);
end
$$;

create function report.uuids(p jsonb) returns uuid[]
language sql immutable set search_path = ''
as $$ select case when p is null or pg_catalog.jsonb_typeof(p) = 'null' then null
                  else array(select pg_catalog.jsonb_array_elements_text(p)::uuid) end $$;

-- Add a line: { section, kind, text_en, text_ar, text_en_draft, text_ar_draft, category, achievement_ids, invoice_ids,
-- show_amount }.
create function report.line_add(p_report uuid, p_fields jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  f jsonb := coalesce(p_fields, '{}'::jsonb);
  k text;
  r report.report;
  achs uuid[] := report.uuids(f -> 'achievement_ids');
  invs uuid[] := report.uuids(f -> 'invoice_ids');
  cat uuid;
  lid uuid;
  req uuid;
begin
  for k in select pg_catalog.jsonb_object_keys(f) loop
    if k not in ('section', 'kind', 'text_en', 'text_ar', 'text_en_draft', 'text_ar_draft', 'category', 'achievement_ids',
                 'invoice_ids', 'show_amount') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  r := report.draft_for_edit(p_report, me);
  perform report.line_check(r, me, f ->> 'section', f ->> 'kind', f ->> 'text_en', f ->> 'text_ar', achs, invs,
                            (f ->> 'show_amount')::boolean, case when (f ->> 'show_amount')::boolean then 'invoices' end);
  if nullif(f ->> 'category', '') is not null then
    cat := (perf.category_in(r.plan_id, f ->> 'category')).id;
    if cat is null then
      raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = f ->> 'category';
    end if;
  end if;
  req := audit.begin('ui', 'report.line_added', pg_catalog.jsonb_build_object('kind', f ->> 'kind'));
  insert into report.line (report_id, section_key, kind, category_id, text_en, text_ar, text_en_draft, text_ar_draft, sort,
                           show_amount, amount_source, created_by)
  values (r.id, f ->> 'section', f ->> 'kind', cat, nullif(pg_catalog.btrim(f ->> 'text_en'), ''),
          nullif(pg_catalog.btrim(f ->> 'text_ar'), ''), coalesce((f ->> 'text_en_draft')::boolean, false),
          coalesce((f ->> 'text_ar_draft')::boolean, false),
          (select coalesce(max(l.sort), 0) + 1 from report.line l
           where l.report_id = r.id and l.section_key = f ->> 'section' and l.deleted_at is null),
          coalesce((f ->> 'show_amount')::boolean, false),
          case when (f ->> 'show_amount')::boolean then 'invoices' end, me)
  returning id into lid;
  perform report.line_cite(lid, achs, invs, me);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', lid, 'request_id', req);
end
$$;

-- An Achievement line typed in the report creates its achievement in the same request (V79): the achievement is
-- logged as on the KPIs page (perf.achievement_log — its checks, its number), marked added from report.
create function report.add_achievement_line(p_report uuid, p_section text, p_achievement jsonb, p_text_en text,
                                            p_text_ar text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  r report.report;
  made jsonb;
  aid uuid;
  lid uuid;
  req uuid;
begin
  r := report.draft_for_edit(p_report, me);
  req := audit.begin('ui', 'report.line_added', pg_catalog.jsonb_build_object('kind', 'achievement'));
  made := perf.achievement_log(p_achievement);
  aid := (made ->> 'id')::uuid;
  if aid is null or not exists (select 1 from perf.achievement a where a.id = aid and a.department_id = r.department_id) then
    raise exception using errcode = 'P0001', message = 'report.achievement_in_another_department';
  end if;
  update perf.achievement a set origin = 'report', origin_report_id = r.id where a.id = aid;
  perform report.line_check(r, me, p_section, 'achievement', p_text_en, p_text_ar, array[aid], null, false, null);
  insert into report.line (report_id, section_key, kind, category_id, text_en, text_ar, sort, created_by)
  values (r.id, p_section, 'achievement', (select a.category_id from perf.achievement a where a.id = aid),
          nullif(pg_catalog.btrim(p_text_en), ''), nullif(pg_catalog.btrim(p_text_ar), ''),
          (select coalesce(max(l.sort), 0) + 1 from report.line l
           where l.report_id = r.id and l.section_key = p_section and l.deleted_at is null), me)
  returning id into lid;
  perform report.line_cite(lid, array[aid], null, me);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', lid, 'achievement_id', aid,
                                       'number', (select a.number from perf.achievement a where a.id = aid), 'request_id', req);
end
$$;

-- Edit a line: its texts, their draft marks, its place, its citations and amount (a line keeps its kind and section).
create function report.line_update(p_line uuid, p_fields jsonb, p_version int) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  f jsonb := coalesce(p_fields, '{}'::jsonb);
  k text;
  l report.line;
  r report.report;
  achs uuid[];
  invs uuid[];
  en text;
  ar text;
  show boolean;
  req uuid;
begin
  for k in select pg_catalog.jsonb_object_keys(f) loop
    if k not in ('text_en', 'text_ar', 'text_en_draft', 'text_ar_draft', 'sort', 'achievement_ids', 'invoice_ids',
                 'show_amount') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  select * into l from report.line x where x.id = p_line and x.deleted_at is null for update;
  if l.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'report.line';
  end if;
  r := report.draft_for_edit(l.report_id, me);
  perform core.check_version('report.line', l.id, p_version, array(select pg_catalog.jsonb_object_keys(f)));
  achs := coalesce(report.uuids(f -> 'achievement_ids'),
                   array(select x.achievement_id from report.line_achievement x where x.line_id = l.id and x.deleted_at is null));
  invs := coalesce(report.uuids(f -> 'invoice_ids'),
                   array(select x.invoice_id from report.line_invoice x where x.line_id = l.id and x.deleted_at is null));
  en := case when f ? 'text_en' then nullif(pg_catalog.btrim(f ->> 'text_en'), '') else l.text_en end;
  ar := case when f ? 'text_ar' then nullif(pg_catalog.btrim(f ->> 'text_ar'), '') else l.text_ar end;
  show := coalesce((f ->> 'show_amount')::boolean, l.show_amount);
  perform report.line_check(r, me, l.section_key, l.kind, en, ar, achs, invs, show,
                            case when show then 'invoices' end);
  req := audit.begin('ui', 'report.line_changed', null);
  update report.line x set
    text_en = en, text_ar = ar,
    -- an edited text is the editor's own: its draft mark goes unless the edit says otherwise
    text_en_draft = coalesce((f ->> 'text_en_draft')::boolean, case when f ? 'text_en' then false else x.text_en_draft end),
    text_ar_draft = coalesce((f ->> 'text_ar_draft')::boolean, case when f ? 'text_ar' then false else x.text_ar_draft end),
    sort = coalesce((f ->> 'sort')::int, x.sort),
    show_amount = show, amount_source = case when show then 'invoices' end,
    updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
  where x.id = l.id;
  if f ? 'achievement_ids' or f ? 'invoice_ids' then
    perform report.line_cite(l.id, achs, invs, me);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', l.id, 'request_id', req);
end
$$;

create function report.lines_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  rid uuid;
  n int;
  req uuid;
begin
  for rid in select distinct l.report_id from report.line l where l.id = any (p_ids) and l.deleted_at is null loop
    perform report.draft_for_edit(rid, me);
  end loop;
  req := audit.begin('ui', 'report.lines_removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)),
                     p_reason);
  update report.line l set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = coalesce(p_reason, 'removed')
  where l.id = any (p_ids) and l.deleted_at is null;
  get diagnostics n = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('removed', n, 'request_id', req);
end
$$;

-- ================================================================ a line's amount and its rendering
-- The sum of the distinct invoices a line cites (V79): an invoice cited twice counts once.
create function report.line_amount(p_line uuid) returns numeric
language sql stable security definer set search_path = ''
as $$
  select sum(v.total_sar)
  from (select distinct x.invoice_id from report.line_invoice x where x.line_id = p_line and x.deleted_at is null) d
  join finance.invoice v on v.id = d.invoice_id and v.deleted_at is null
$$;

-- A line as the report holds it: its place, kind, texts and draft marks, the achievements it cites with their numbers
-- and dates — each repeat listed apart with its date (V531) — and its amount when it shows one.
create function report.line_json(l report.line) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', l.id, 'section', l.section_key, 'place', l.sort, 'kind', l.kind,
    'category', (select c.code from perf.achievement_category c where c.id = l.category_id),
    'text_en', l.text_en, 'text_ar', l.text_ar, 'text_en_draft', l.text_en_draft, 'text_ar_draft', l.text_ar_draft,
    'achievements', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                'id', a.id, 'number', a.number, 'happened_on', a.happened_on, 'repeat_of',
                                (select o.number from perf.achievement o where o.id = a.repeat_of))
                                order by a.happened_on, a.number)
                              from report.line_achievement x join perf.achievement a on a.id = x.achievement_id
                              where x.line_id = l.id and x.deleted_at is null), '[]'::jsonb),
    'invoice_count', (select pg_catalog.count(distinct x.invoice_id)::int from report.line_invoice x
                      where x.line_id = l.id and x.deleted_at is null),
    'amount', case when l.show_amount then report.line_amount(l.id) end,
    'version', l.version)
$$;

-- ================================================================ issue (§3.9): the snapshot, its SHA-256, its number
-- The snapshot is the frozen report: its period, template and every line's text and figures, each section in the
-- template's order. Names stay entity tokens ({{partner:<id>}}, V58), so the hash never moves with a rename.
create function report.snapshot_of(r report.report) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'department', (select d.code from core.department d where d.id = r.department_id),
    'kind', r.kind, 'period_start', r.period_start, 'period_end', r.period_end,
    'print_languages', (select pg_catalog.to_jsonb(t.print_languages) from report.template t where t.id = r.template_id),
    'sections', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'key', s.key,
               'lines', coalesce((select pg_catalog.jsonb_agg(report.line_json(l) - 'id' - 'version' order by l.sort, l.id)
                                  from report.line l
                                  where l.report_id = r.id and l.section_key = s.key and l.deleted_at is null), '[]'::jsonb))
               order by s.ord)
      from report.template t, pg_catalog.unnest(t.sections) with ordinality s(key, ord)
      where t.id = r.template_id), '[]'::jsonb))
$$;

-- The number: <DEPT>-M-2026-09, <DEPT>-Q-2026-Q3, <DEPT>-Y-2026; a correction takes the corrected report's number
-- with -C1, -C2 ….
create function report.number_for(r report.report) returns text
language sql stable security definer set search_path = ''
as $$
  select case when r.supersedes_id is null then
           pg_catalog.upper(d.code) || '-' || case r.kind when 'monthly' then 'M' when 'quarterly' then 'Q' else 'Y' end
           || '-' || pg_catalog.to_char(r.period_start, 'YYYY')
           || case r.kind when 'monthly' then '-' || pg_catalog.to_char(r.period_start, 'MM')
                          when 'quarterly' then '-Q' || pg_catalog.to_char(r.period_start, 'Q') else '' end
         else pg_catalog.regexp_replace(o.number, '-C[0-9]+$', '') || '-C'
              || (coalesce((pg_catalog.regexp_match(o.number, '-C([0-9]+)$'))[1]::int, 0) + 1)::text
         end
  from core.department d left join report.report o on o.id = r.supersedes_id
  where d.id = r.department_id
$$;

create function report.issue(p_report uuid, p_version int) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  r report.report;
  langs text[];
  missing record;
  snap jsonb;
  num text;
  flags jsonb;
  req uuid;
begin
  select * into r from report.report x where x.id = p_report and x.deleted_at is null for update;
  if r.id is null or not report.sees(me, r.department_id) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'report.report';
  end if;
  -- a second Issue answers with the number it was issued as (OLD-052)
  if r.status in ('issued', 'superseded') then
    raise exception using errcode = 'P0001', message = 'report.already_issued', detail = r.number;
  end if;
  r := report.draft_for_edit(p_report, me);
  perform core.check_version('report.report', r.id, p_version, '{}'::text[]);
  if r.supersedes_id is null and exists (select 1 from report.report x
                                         where x.department_id = r.department_id and x.kind = r.kind
                                           and x.period_start = r.period_start and x.status = 'issued') then
    raise exception using errcode = 'P0001', message = 'report.already_issued',
      detail = (select x.number from report.report x where x.department_id = r.department_id and x.kind = r.kind
                  and x.period_start = r.period_start and x.status = 'issued');
  end if;
  -- every line has its text in each language the template prints (V403)
  langs := (select t.print_languages from report.template t where t.id = r.template_id);
  select l.section_key, l.sort, g.lang into missing
  from report.line l, pg_catalog.unnest(langs) g(lang)
  where l.report_id = r.id and l.deleted_at is null
    and pg_catalog.btrim(coalesce(case g.lang when 'ar' then l.text_ar else l.text_en end, '')) = ''
  order by l.section_key, l.sort
  limit 1;
  if missing.sort is not null then
    raise exception using errcode = 'P0001', message = 'report.line_missing_language',
      detail = missing.section_key || ':' || missing.sort || ':' || missing.lang;
  end if;
  snap := report.snapshot_of(r);
  num := report.number_for(r);
  -- a banned word in a line is flagged at issue, never silently kept (OLD-PRF-067, V404)
  flags := coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('section', l.section_key, 'place', l.sort,
                                                                                'word', w.word) order by l.section_key, l.sort)
                     from report.line l
                     cross join lateral (select coalesce(core.banned_word(l.text_en), core.banned_word(l.text_ar)) as word) w
                     where l.report_id = r.id and l.deleted_at is null and w.word is not null), '[]'::jsonb);
  req := audit.begin('ui', 'report.issued', pg_catalog.jsonb_build_object('number', num));
  update report.report x set status = 'superseded', updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
  where x.id = r.supersedes_id and x.status = 'issued';
  update report.report x set status = 'issued', number = num, issued_at = pg_catalog.now(), issued_by = me, snapshot = snap,
         snapshot_sha256 = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(snap::text, 'UTF8')), 'hex'),
         updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
  where x.id = r.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', r.id, 'number', num, 'flags', flags, 'request_id', req);
end
$$;

-- ================================================================ correction (§3.9): a correcting draft supersedes on issue
create function report.correct(p_report uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  r report.report;
  nid uuid;
  l report.line;
  lid uuid;
  req uuid;
begin
  select * into r from report.report x where x.id = p_report and x.deleted_at is null for update;
  if r.id is null or not report.sees(me, r.department_id) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'report.report';
  end if;
  if not report.can_edit(me, r.department_id) then
    raise exception using errcode = '42501', message = 'report.editors_only';
  end if;
  if r.status <> 'issued' then
    raise exception using errcode = 'P0001', message = 'report.correct_issued_only', detail = r.status;
  end if;
  if pg_catalog.btrim(coalesce(p_note, '')) = '' then
    raise exception using errcode = 'P0001', message = 'report.correction_says_why';
  end if;
  req := audit.begin('ui', 'report.correction_opened', pg_catalog.jsonb_build_object('number', r.number), p_note);
  begin
    insert into report.report (department_id, kind, period_start, period_end, plan_id, template_id, supersedes_id,
                               correction_note, created_by)
    values (r.department_id, r.kind, r.period_start, r.period_end, r.plan_id, r.template_id, r.id,
            pg_catalog.btrim(p_note), me)
    returning id into nid;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'report.correction_open',
      detail = (select x.id from report.report x where x.supersedes_id = r.id and x.deleted_at is null
                  and x.status in ('draft', 'in_review'))::text;
  end;
  -- the correcting draft starts as the issued report's lines and citations
  for l in select * from report.line x where x.report_id = r.id and x.deleted_at is null order by x.section_key, x.sort loop
    insert into report.line (report_id, section_key, kind, category_id, text_en, text_ar, text_en_draft, text_ar_draft, sort,
                             show_amount, amount_source, amount_field_key, created_by)
    values (nid, l.section_key, l.kind, l.category_id, l.text_en, l.text_ar, l.text_en_draft, l.text_ar_draft, l.sort,
            l.show_amount, l.amount_source, l.amount_field_key, me)
    returning id into lid;
    perform report.line_cite(lid,
      array(select x.achievement_id from report.line_achievement x where x.line_id = l.id and x.deleted_at is null),
      array(select x.invoice_id from report.line_invoice x where x.line_id = l.id and x.deleted_at is null), me);
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'request_id', req);
end
$$;

-- ================================================================ remove a draft — never an issued report (OLD-PRF-069)
create function report.reports_remove(p_ids uuid[], p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  rid uuid;
  n int;
  req uuid;
begin
  if pg_catalog.btrim(coalesce(p_reason, '')) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  for rid in select x.id from report.report x where x.id = any (p_ids) and x.deleted_at is null loop
    if (select x.status from report.report x where x.id = rid) not in ('draft', 'in_review') then
      raise exception using errcode = 'P0001', message = 'report.issued_never_removed',
        detail = (select x.number from report.report x where x.id = rid);
    end if;
    perform report.draft_for_edit(rid, me);
  end loop;
  req := audit.begin('ui', 'report.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update report.report x set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_reason
  where x.id = any (p_ids) and x.deleted_at is null;
  get diagnostics n = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('removed', n, 'request_id', req);
end
$$;

-- ================================================================ reads
-- One report: its header, its template's sections in order, and — a draft — its live lines, or — issued — its
-- snapshot and hash. Money is masked for a reader without View on Finance (V458): the snapshot keeps it.
create function report.get(p_report uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  r report.report;
  money boolean;
  body jsonb;
begin
  select * into r from report.report x where x.id = p_report and x.deleted_at is null;
  if r.id is null or not report.sees(me, r.department_id) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'report.report';
  end if;
  money := authz.level_of(me, 'finance') >= 'view';
  body := case when r.status in ('issued', 'superseded') then r.snapshot else report.snapshot_of(r) end;
  if not money then
    body := pg_catalog.jsonb_set(body, '{sections}', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_set(s, '{lines}', coalesce((
               select pg_catalog.jsonb_agg(case when l ? 'amount' then pg_catalog.jsonb_set(l, '{amount}', 'null'::jsonb)
                                                else l end order by o)
               from pg_catalog.jsonb_array_elements(s -> 'lines') with ordinality y(l, o)), '[]'::jsonb)) order by so)
      from pg_catalog.jsonb_array_elements(body -> 'sections') with ordinality z(s, so)), '[]'::jsonb));
  end if;
  return pg_catalog.jsonb_build_object(
    'id', r.id, 'department_id', r.department_id, 'kind', r.kind, 'period_start', r.period_start,
    'period_end', r.period_end, 'status', r.status, 'number', r.number, 'issued_at', r.issued_at,
    'issued_by', r.issued_by, 'supersedes_id', r.supersedes_id, 'correction_note', r.correction_note,
    'superseded_by', (select pg_catalog.jsonb_build_object('id', x.id, 'number', x.number) from report.report x
                      where x.supersedes_id = r.id and x.status in ('issued', 'superseded')),
    'snapshot_sha256', r.snapshot_sha256, 'money_masked', not money,
    'can_edit', r.status in ('draft', 'in_review') and report.can_edit(me, r.department_id),
    'lines', case when r.status in ('draft', 'in_review') then coalesce((
               select pg_catalog.jsonb_agg(report.line_json(l) order by l.section_key, l.sort)
               from report.line l where l.report_id = r.id and l.deleted_at is null), '[]'::jsonb) end,
    'body', body, 'version', r.version);
end
$$;

-- The archive (V57): the reports of the reader's departments, newest period first, by kind and year.
create function report.list(p_kind text default null, p_year int default null) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', r.id, 'department_id', r.department_id, 'kind', r.kind, 'period_start', r.period_start,
           'period_end', r.period_end, 'status', r.status, 'number', r.number, 'issued_at', r.issued_at,
           'supersedes_id', r.supersedes_id)
           order by r.period_start desc, r.kind, r.issued_at desc nulls first), '[]'::jsonb)
  from report.report r
  where r.deleted_at is null and report.sees(authz.me(), r.department_id)
    and (p_kind is null or r.kind = p_kind)
    and (p_year is null or pg_catalog.date_part('year', r.period_start)::int = p_year)
$$;

-- ================================================================ the doors the Data API reaches (V124)
create function api.report_create(p_kind text, p_period_start date, p_department uuid default null) returns jsonb
language sql security invoker set search_path = '' as $$ select report.create(p_kind, p_period_start, p_department) $$;
create function api.report_line_add(p_report uuid, p_fields jsonb) returns jsonb
language sql security invoker set search_path = '' as $$ select report.line_add(p_report, p_fields) $$;
create function api.report_add_achievement_line(p_report uuid, p_section text, p_achievement jsonb,
                                                p_text_en text default null, p_text_ar text default null) returns jsonb
language sql security invoker set search_path = ''
as $$ select report.add_achievement_line(p_report, p_section, p_achievement, p_text_en, p_text_ar) $$;
create function api.report_line_update(p_line uuid, p_fields jsonb, p_version int) returns jsonb
language sql security invoker set search_path = '' as $$ select report.line_update(p_line, p_fields, p_version) $$;
create function api.report_lines_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql security invoker set search_path = '' as $$ select report.lines_remove(p_ids, p_reason) $$;
create function api.report_issue(p_report uuid, p_version int) returns jsonb
language sql security invoker set search_path = '' as $$ select report.issue(p_report, p_version) $$;
create function api.report_correct(p_report uuid, p_note text) returns jsonb
language sql security invoker set search_path = '' as $$ select report.correct(p_report, p_note) $$;
create function api.reports_remove(p_ids uuid[], p_reason text) returns jsonb
language sql security invoker set search_path = '' as $$ select report.reports_remove(p_ids, p_reason) $$;
create function api.report(p_report uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select report.get(p_report) $$;
create function api.reports(p_kind text default null, p_year int default null) returns jsonb
language sql security invoker set search_path = '' as $$ select report.list(p_kind, p_year) $$;

grant usage on schema report to authenticated;
grant execute on function
  report.create(text, date, uuid), report.line_add(uuid, jsonb), report.add_achievement_line(uuid, text, jsonb, text, text),
  report.line_update(uuid, jsonb, int), report.lines_remove(uuid[], text), report.issue(uuid, int),
  report.correct(uuid, text), report.reports_remove(uuid[], text), report.get(uuid), report.list(text, int)
  to authenticated;
grant execute on function
  api.report_create(text, date, uuid), api.report_line_add(uuid, jsonb),
  api.report_add_achievement_line(uuid, text, jsonb, text, text), api.report_line_update(uuid, jsonb, int),
  api.report_lines_remove(uuid[], text), api.report_issue(uuid, int), api.report_correct(uuid, text),
  api.reports_remove(uuid[], text), api.report(uuid), api.reports(text, int)
  to authenticated;
