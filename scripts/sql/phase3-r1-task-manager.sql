-- Phase 3 · RELEASE 1 (tasks + projects) — the task-manager design v1.2.4 with the corrections the
-- live check found (docs/PHASE3_SCHEMA_CHECK_2026-09-25.md). Every change from 29a is marked "R1 CHANGE".
-- Rollback: phase3-r1-task-manager-rollback.sql.
-- DirectKSA task manager · database structure v1.2.4 — four page levels through the live page_level() (D2), tasks follow D7 (helpers, not locks), achievements stay with the owner / whoever manages the task.
-- Target: Supabase project vkxoeeoauexyfpzqufqd (direct-business). Needs the live Phase 1a functions (page_level, can_edit_page, access_pages). Never directksa-performance.
-- =====================================================================
-- DirectKSA · Task manager + linked pages · STRUCTURE v1.2.4 (four page levels via live page_level(); D7 for tasks)
-- Target: direct-business (vkxoeeoauexyfpzqufqd). New tables only.
-- v1.1 = v1 re-aligned to Direct's real systems (25 Sep 2026 sweep):
--  · money is REFLECTED from Direct Payments (finance_invoices), never typed
--  · no copy of anything Direct Payments / Executive CRM / the app already owns
--  · reuses the app's numbering, audit, roles, page-access and service list
--  · every table ships with RLS in the same migration (rule M20)
-- =====================================================================

-- ---------- LOOKUPS (Settings) ----------
-- ---------- ACCESS: the new Tasks page joins the four-level grid (D2), Reports gets its levels (D7 split) ----------
-- Tasks follow D7 "helpers, not locks": everyone on the team starts on Full — anyone can help, every change is
-- recorded and the owner is told. Achievements feed KPIs and appraisals, so they are stricter, like money:
-- employees start on Own (their own lines and lines of tasks they manage), managers on Full.
create or replace function public.access_pages()
returns text[] language sql immutable set search_path to 'public' as $$
  select array['today','leads','clients','offers','documents','ops','reports','finance','settings',
               'events','airlines','vendors','sopsla','activity','archive',
               'projects','bookings','invoices','tickets','sync','tasks']
$$;
create or replace function public.default_page_levels(r public.user_role)
returns jsonb language sql immutable set search_path to 'public' as $$
  select case r
    when 'admin' then '{}'::jsonb
    -- R1 CHANGE: the manager keeps "documents" (live since Phase 1b, owner-approved); Tasks only —
    -- the Reports levels land with the report-registration release (today's Reports page lives in each browser)
    when 'manager' then '{"today":"full","leads":"full","clients":"full","finance":"full","offers":"full","documents":"full",
                          "events":"full","airlines":"full","settings":"full","activity":"full","archive":"full",
                          "tasks":"full"}'::jsonb
    when 'team_member' then '{"today":"full","leads":"full","clients":"full","finance":"full","tasks":"full"}'::jsonb
    else '{"today":"view"}'::jsonb
  end
$$;
-- existing people get the Tasks page; nothing they already have changes
-- R1 CHANGE: Tasks only (measured before/after on live: 8 people gain tasks:full, nothing else moves)
update app_users set page_access = page_access
     || case when page_access ? 'tasks' then '{}'::jsonb else jsonb_build_object('tasks','full') end
 where active and role in ('manager','team_member') and page_access is not null;

create table departments (
  id uuid primary key default gen_random_uuid(),
  code text unique not null, name_en text not null, name_ar text not null,
  parent_id uuid references departments(id) on delete restrict,       -- all six sit under Commercial
  head_member_id uuid,
  active boolean not null default true, sort int not null default 0);
insert into departments(code,name_en,name_ar,sort) values ('commercial','Commercial','التجاري',0);
insert into departments(code,name_en,name_ar,sort) values
 ('business','Business','الأعمال',1),('partnership','Partnership','الشراكات',2),
 ('quality','Quality','الجودة',3),('complaints','Complaints','الشكاوى',4),
 ('strategy','Strategy','الاستراتيجية',5),('integrity','Integrity','النزاهة',6);
update departments set parent_id = (select id from departments where code='commercial') where code <> 'commercial';

-- one switch for "who sees what": open = every signed-in person sees everything (owner's choice for now);
-- the role rules below stay in place and take over the day an admin turns this off
create table work_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
insert into work_settings values ('open_visibility', 'true');

create table task_statuses (code text primary key, name_en text not null, name_ar text not null,
  is_closed boolean not null default false, is_done boolean not null default false, sort int not null);
insert into task_statuses values
 ('backlog','Backlog','مؤجل',false,false,1),('todo','To do','للتنفيذ',false,false,2),
 ('in_progress','In progress','قيد التنفيذ',false,false,3),('waiting','Waiting on others','بانتظار طرف آخر',false,false,4),
 ('done','Done','منجز',true,true,5),('cancelled','Cancelled','ملغي',true,false,6);

create table priorities (code text primary key, name_en text not null, name_ar text not null, sort int not null);
insert into priorities values ('urgent','Urgent','عاجل',1),('high','High','مرتفع',2),('normal','Normal','عادي',3),('low','Low','منخفض',4);

create table work_types (code text primary key, name_en text not null, name_ar text not null, sort int not null);
insert into work_types values
 ('sales','Sales & accounts','مبيعات وحسابات',1),('tender','Tender','مناقصة',2),
 ('partnership','Partnership / supplier','شراكة / مزود',3),('booking','Booking & operations','حجوزات وتشغيل',4),
 ('complaint','Complaint / support','شكوى / دعم',5),('quality','Quality','جودة',6),('internal','Internal / admin','داخلي / إداري',7);

-- the app's own 20-service list (Leads service-fit map, js/13) — same keys, same words.
-- dp_line = the line name Direct Payments uses for that service, where one exists.
create table service_types (code text primary key, name_en text not null, name_ar text not null,
  dp_line text unique, sort int not null);
insert into service_types values
 ('flights','Flights','الطيران','Flights',1),('hotels','Hotels','الفنادق','Hotels',2),
 ('visa','Visa / e-Visa','التأشيرات','Visa',3),('umrah','Umrah / Hajj','العمرة والحج',null,4),
 ('transfers','Transfers','التنقلات',null,5),('carrental','Car rental','تأجير السيارات',null,6),
 ('insurance','Insurance','التأمين','Insurance',7),('tours','Activities / tours','الأنشطة والجولات','Activities',8),
 ('mice','MICE / events','الفعاليات',null,9),('packages','Packages','الباقات','Packages',10),
 ('study','Study abroad','الدراسة بالخارج','Course',11),('idl','Intl driving licence','رخصة القيادة الدولية',null,12),
 ('chauffeur','Chauffeur','سائق خاص',null,13),('esim','eSIM / roaming','شريحة eSIM',null,14),
 ('training','Training','التدريب',null,15),('vip','VIP meet & assist','استقبال كبار الشخصيات',null,16),
 ('translation','Translation','ترجمة الوثائق',null,17),('shipping','Shipping','الشحن البريدي',null,18),
 ('halls','Event halls','قاعات الفعاليات',null,19),('support','Support','الدعم','Support',20);

create table report_categories (id uuid primary key default gen_random_uuid(),
  code text unique not null, name_en text not null, name_ar text not null,
  active boolean not null default true, sort int not null default 0);
insert into report_categories(code,name_en,name_ar,sort) values
 ('deals','New deals & bookings','صفقات وحجوزات جديدة',1),('tenders','Tenders','المناقصات',2),
 ('partners','Partnerships & suppliers','الشراكات والمزودون',3),('airlines','Airlines','شركات الطيران',4),
 ('commission','Commissions & fees','العمولات والرسوم',5),('tech','Integrations & systems','الربط والأنظمة',6),
 ('events','Events & awards','الفعاليات والجوائز',7),('other','Other','أخرى',99);

-- ---------- PEOPLE (one row per existing app_users login; logins are never created here) ----------
create table team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references app_users(id) on delete restrict,
  department_id uuid not null references departments(id) on delete restrict,
  reports_to uuid references team_members(id) on delete restrict,
  job_title_en text, job_title_ar text, joined_on date, left_on date,
  active boolean not null default true,
  check (reports_to is null or reports_to <> id), check (active or left_on is not null));
alter table departments add constraint departments_head_fk foreign key (head_member_id) references team_members(id) on delete restrict;

-- helpers used by the row rules
create or replace function my_member_id() returns uuid language sql stable security definer set search_path to public as
$$ select id from team_members where user_id = auth.uid() and active $$;
create or replace function is_manager() returns boolean language sql stable security definer set search_path to public as
$$ select coalesce(app_role() in ('admin','manager'), false) $$;
create or replace function heads_department(d uuid) returns boolean language sql stable security definer set search_path to public as
$$ select exists (select 1 from departments x left join departments up on up.id = x.parent_id
     where x.id = d and my_member_id() in (x.head_member_id, up.head_member_id)) $$;   -- the Commercial head heads all six

-- ---------- CALENDAR ----------
create table periods (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('month','quarter','year')),
  year int not null check (year between 2020 and 2100),
  quarter int check (quarter between 1 and 4), month int check (month between 1 and 12),
  start_date date not null, end_date date not null,
  label_en text not null, label_ar text not null, locked_at timestamptz,
  unique (kind, year, quarter, month),
  check ((kind='month' and month is not null and quarter is not null)
      or (kind='quarter' and month is null and quarter is not null)
      or (kind='year' and month is null and quarter is null)),
  check (end_date >= start_date));
create or replace function seed_periods(y int) returns void language plpgsql as $$
declare m int; q int; ar text[] := array['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
begin
  insert into periods(kind,year,start_date,end_date,label_en,label_ar) values ('year',y,make_date(y,1,1),make_date(y,12,31),y::text,y::text) on conflict do nothing;
  for q in 1..4 loop
    insert into periods(kind,year,quarter,start_date,end_date,label_en,label_ar)
    values ('quarter',y,q,make_date(y,q*3-2,1),(make_date(y,q*3-2,1)+interval '3 months - 1 day')::date,'Q'||q||' '||y,'الربع '||q||' '||y) on conflict do nothing;
  end loop;
  for m in 1..12 loop
    insert into periods(kind,year,quarter,month,start_date,end_date,label_en,label_ar)
    values ('month',y,(m+2)/3,m,make_date(y,m,1),(make_date(y,m,1)+interval '1 month - 1 day')::date,to_char(make_date(y,m,1),'Mon YYYY'),ar[m]||' '||y) on conflict do nothing;
  end loop;
end $$;
select seed_periods(y) from generate_series(2024,2027) y;
create view period_compare with (security_invoker = on) as
select p.id, p.kind, p.year, p.quarter, p.month,
  (select q.id from periods q where q.kind=p.kind and q.start_date = (p.start_date - case p.kind when 'month' then interval '1 month' when 'quarter' then interval '3 months' else interval '1 year' end)::date) as previous_id,
  (select q.id from periods q where q.kind=p.kind and q.start_date = (p.start_date - interval '1 year')::date) as same_last_year_id
from periods p;

-- ---------- WORK ----------
-- R1 CHANGE: live next_document_number() is Generator-only (Phase 1b), so an employee could not create a task.
-- Work codes get their own door onto the same counters: anyone who may work on Tasks, PRJ / TSK only.
create or replace function public.next_work_number(p_family text) returns text language plpgsql security definer set search_path to public as $$
declare y integer := extract(year from now())::integer; n integer; f text := upper(coalesce(p_family,''));
begin
  if app_role() is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if f not in ('PRJ','TSK') then raise exception 'Unknown work number family %', f using errcode = '22023'; end if;
  if not (public.page_level('tasks') in ('own','full')) then
    raise exception 'Only someone who works on the Tasks page can create tasks or projects.' using errcode = '42501'; end if;
  insert into document_counters(family, year, last_n) values (f, y, 1)
    on conflict (family, year) do update set last_n = document_counters.last_n + 1
    returning last_n into n;
  return f || '-' || y || '-' || lpad(n::text, 3, '0');
end $$;
-- codes come from the app's own numbering (next_document_number → document_counters): PRJ-2026-001, TSK-2026-001
create table projects (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default next_work_number('PRJ'),   -- R1 CHANGE
  name text not null check (length(trim(name)) > 0), name_ar text,
  business_id uuid references businesses(id) on delete restrict,        -- lead or client (one table in the app)
  department_id uuid not null references departments(id) on delete restrict,
  owner_id uuid not null references team_members(id) on delete restrict,        -- project owner (defaults to the company's account manager)
  assigned_by uuid references team_members(id), assigned_at timestamptz,
  work_type text not null references work_types(code),
  service_type text references service_types(code),
  status text not null default 'active' check (status in ('planned','active','on_hold','done','cancelled')),
  start_date date, due_date date, closed_at timestamptz,
  source_ref text,          -- tender no. / REQ-nnn / RFQ / proposal ref (reference only)
  exec_crm_ref text,        -- the contract/tender row in the Executive CRM (reference only — its money stays there)
  notes text,
  created_by uuid references team_members(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check (work_type = 'internal' or business_id is not null),
  check (due_date is null or start_date is null or due_date >= start_date),
  check ((status in ('done','cancelled')) = (closed_at is not null)));

create table tasks (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default next_work_number('TSK'),   -- R1 CHANGE
  project_id uuid references projects(id) on delete restrict,
  parent_task_id uuid references tasks(id) on delete restrict,
  business_id uuid references businesses(id) on delete restrict,
  contact_id uuid references contacts(id) on delete set null,       -- who at the company
  ksa_event_id uuid references ksa_events(id) on delete set null,   -- Events → tasks hook
  title text not null check (length(trim(title)) > 0), description text,
  status text not null default 'todo' references task_statuses(code),
  priority text not null default 'normal' references priorities(code),
  work_type text not null references work_types(code),
  service_type text references service_types(code),
  owner_id uuid not null references team_members(id) on delete restrict,        -- who does it (the assignee)
  assigned_by uuid references team_members(id), assigned_at timestamptz,       -- stamped when someone else hands it over
  department_id uuid not null references departments(id) on delete restrict,
  start_date date, due_date date, done_at timestamptz, done_by uuid references team_members(id),
  report_category_id uuid references report_categories(id),
  kpi_id uuid,                                  -- the KPI this task works toward (FK added below)
  plan_entry_id uuid,                           -- the report's planned item this task delivers (FK added below)
  include_in_report boolean not null default false,
  is_blocker boolean not null default false, blocker_note text,
  sort int not null default 0,
  created_by uuid references team_members(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check (parent_task_id is null or parent_task_id <> id),
  check (due_date is null or start_date is null or due_date >= start_date),
  constraint blocker_needs_note check (not is_blocker or coalesce(length(trim(blocker_note)),0) > 0),
  constraint report_task_needs_category check (not include_in_report or report_category_id is not null));
create index on tasks(owner_id) where deleted_at is null;
create index on tasks(project_id) where deleted_at is null;
create index on tasks(business_id) where deleted_at is null;
create index on tasks(due_date) where deleted_at is null;

create table task_people (id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  member_id uuid not null references team_members(id) on delete restrict,
  role text not null check (role in ('helper','reviewer','watcher')),
  constraint task_person_once unique (task_id, member_id));
create table task_checklist (id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  text text not null check (length(trim(text)) > 0), is_done boolean not null default false,
  done_at timestamptz, done_by uuid references team_members(id), sort int not null default 0,
  check (is_done = (done_at is not null)));
-- comments carry the weekly, date-stamped update rhythm (kind = weekly_update)
create table task_comments (id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  author_id uuid not null references team_members(id) on delete restrict,
  kind text not null default 'comment' check (kind in ('comment','weekly_update','manager_note')),  -- manager_note: heads/managers only
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(), edited_at timestamptz, deleted_at timestamptz);
create table task_files (id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  storage_path text not null unique check (storage_path like 'task-files/%'),   -- private bucket only
  file_name text not null, mime_type text, size_bytes bigint check (size_bytes >= 0),
  uploaded_by uuid not null references team_members(id), created_at timestamptz not null default now(), deleted_at timestamptz);
create table task_dependencies (id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  blocked_by_task_id uuid not null references tasks(id) on delete cascade,
  unique (task_id, blocked_by_task_id), check (task_id <> blocked_by_task_id));
create table tags (id uuid primary key default gen_random_uuid(), name text unique not null, color text);
create table task_tags (id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade, tag_id uuid not null references tags(id) on delete restrict,
  unique (task_id, tag_id));
create table task_status_log (id bigserial primary key,
  task_id uuid not null references tasks(id) on delete cascade,
  from_status text, to_status text not null, at timestamptz not null default now(), by_member uuid);

-- ---------- REFLECTION OF MONEY (read from Direct Payments' invoices; nothing typed) ----------
-- one invoice NUMBER (all its lines) belongs to one project at most
create table work_finance_links (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique,
  project_id uuid not null references projects(id) on delete restrict,
  task_id uuid references tasks(id) on delete restrict,
  credited_member_id uuid references team_members(id) on delete restrict,   -- override for a shared deal only
  note text, linked_by uuid references team_members(id), linked_at timestamptz not null default now(),
  constraint override_needs_note check (credited_member_id is null or coalesce(length(trim(note)),0) > 0));

-- ---------- COMPANY PLAN → KPIs (seeded verbatim from the Reports page, core-10) ----------
create table objectives (id uuid primary key default gen_random_uuid(),
  year int not null, n int not null, title_en text not null, title_ar text,
  strategy_link text, owner_text text,
  level text not null default 'company' check (level in ('company','department')),
  department_id uuid references departments(id) on delete restrict,
  unique (year, n), check (level='company' or department_id is not null));
create table initiatives (id uuid primary key default gen_random_uuid(),
  year int not null, n int not null, title_en text not null, title_ar text,
  objective_id uuid references objectives(id) on delete restrict, unique (year, n));
create table kpi_definitions (id uuid primary key default gen_random_uuid(),
  code text unique not null, n int, name_en text not null, name_ar text,
  unit text not null check (unit in ('SAR','count','percent','score','days')),
  aggregation text not null default 'sum' check (aggregation in ('sum','latest')),  -- counts/SAR add up; %/scores take the latest
  direction text not null default 'higher' check (direction in ('higher','lower')),
  method text not null default 'manual' check (method in
    ('tasks_done','tasks_on_time_pct','finance_revenue','finance_profit','finance_collected','manual')),
  filter_work_type text references work_types(code), filter_service_type text references service_types(code),
  objective_id uuid references objectives(id) on delete restrict,
  focus text[], is_draft boolean not null default false, active boolean not null default true,
  check (method not like 'finance%' or unit='SAR'),
  check (unit not in ('percent','score') or aggregation='latest'));
create table kpi_targets (id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references kpi_definitions(id) on delete restrict,
  scope text not null check (scope in ('company','department','member')),
  department_id uuid references departments(id) on delete restrict,
  member_id uuid references team_members(id) on delete restrict,
  period_id uuid not null references periods(id) on delete restrict,
  target_value numeric(16,2) not null check (target_value >= 0),
  set_by uuid references team_members(id), set_at timestamptz not null default now(),
  check ((scope='company' and department_id is null and member_id is null)
      or (scope='department' and department_id is not null and member_id is null)
      or (scope='member' and member_id is not null and department_id is null)));
create unique index kpi_targets_one on kpi_targets (kpi_id, scope,
  coalesce(department_id,'00000000-0000-0000-0000-000000000000'), coalesce(member_id,'00000000-0000-0000-0000-000000000000'), period_id);
-- ---------- REPORT REGISTRATION (replaces the Google Sheet + the Reports page's browser-only store) ----------
create table report_entries (id uuid primary key default gen_random_uuid(),
  period_id uuid not null references periods(id) on delete restrict,
  department_id uuid not null references departments(id) on delete restrict,
  member_id uuid references team_members(id),
  section text not null check (section in ('achievement','challenge','next_month_plan','kpi_note')),
  category_id uuid references report_categories(id),
  title text, text_ar text, text_en text,
  entry_date date,
  business_id uuid references businesses(id) on delete restrict,   -- the client it was for (Reports page "client")
  objective_id uuid references objectives(id), kpi_id uuid references kpi_definitions(id),
  value numeric(16,2),          -- a count / % / score toward a KPI — never money (money comes from Finance)
  source text not null default 'manual' check (source in ('manual','task','kpi')),
  source_id uuid, include boolean not null default true, sort int not null default 0,
  -- the task owner or whoever manages the task finalizes it; no outside sign-off, proof optional
  status text not null default 'final' check (status in ('draft','final')),
  finalized_by uuid references team_members(id), finalized_at timestamptz,
  created_by uuid references team_members(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (coalesce(length(trim(text_ar)),0) + coalesce(length(trim(text_en)),0) + coalesce(length(trim(title)),0) > 0),
  check (source = 'manual' or source_id is not null),
  check (value is null or kpi_id is not null),
  check ((status = 'final') = (finalized_at is not null)),
  constraint achievement_needs_category check (section <> 'achievement' or category_id is not null));
create table reports (id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('monthly','quarterly','annual')),
  period_id uuid not null references periods(id) on delete restrict,
  department_id uuid references departments(id),          -- null = whole company (all department sections)
  status text not null default 'draft' check (status in ('draft','issued','superseded')),
  doc_number text unique,                                  -- MRP / QRP / YRP-2026-001, given at issue
  snapshot jsonb, issued_at timestamptz, issued_by uuid references team_members(id),
  generated_document_id uuid references generated_documents(id),   -- PDF/PPTX lives with the Generator's documents
  supersedes_id uuid references reports(id), correction_note text,
  created_at timestamptz not null default now(),
  check (status = 'draft' or (snapshot is not null and issued_at is not null and issued_by is not null and doc_number is not null)),
  constraint correction_needs_note check (supersedes_id is null or coalesce(length(trim(correction_note)),0) > 0));
create unique index reports_one_live on reports (kind, period_id, coalesce(department_id,'00000000-0000-0000-0000-000000000000')) where status = 'issued';

alter table tasks add constraint tasks_kpi_fk foreign key (kpi_id) references kpi_definitions(id) on delete restrict;
alter table tasks add constraint tasks_plan_fk foreign key (plan_entry_id) references report_entries(id) on delete restrict;

-- ---------- PROOFS (optional supporting file: contract, agreement, email, screenshot) ----------
create table evidence_files (id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references report_entries(id) on delete restrict,
  storage_path text not null unique check (storage_path like 'proofs/%'),     -- private bucket only
  file_name text not null, mime_type text, size_bytes bigint check (size_bytes >= 0),
  uploaded_by uuid not null references team_members(id), created_at timestamptz not null default now(), deleted_at timestamptz);

-- ---------- COMPANY FILES (client companies' CR, VAT, agreement, IBAN letter, business cards) ----------
-- stored in the existing private bucket company-docs under clients/<company>/…; numbers stay on the company record
create table company_documents (id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete restrict,
  client_profile_id uuid references client_profiles(id) on delete restrict,   -- when it belongs to one client ID (e.g. its agreement)
  doc_type text not null check (doc_type in ('cr','vat','agreement','iban','business_card','other')),
  title text, valid_to date,
  storage_path text not null unique check (storage_path like 'clients/%'),
  file_name text not null, mime_type text, size_bytes bigint check (size_bytes >= 0),
  uploaded_by uuid references team_members(id), created_at timestamptz not null default now(), deleted_at timestamptz);
create index on company_documents(business_id) where deleted_at is null;

-- ---------- DISCOUNT CODES: extends the existing promo_codes registry (no second list) ----------
-- A code only works at checkout once it exists on the Direct website; this registry records who it is for,
-- which services, what for, and when it expires. For kind='fixed', value_pct holds the SAR amount (as imported).
alter table promo_codes add column if not exists purpose text;
alter table promo_codes add column if not exists services text[];   -- service_types codes; empty/null = all services
create or replace function open_visibility() returns boolean language sql stable security definer set search_path to public as
$$ select coalesce((select value = 'true'::jsonb from work_settings where key='open_visibility'), false) $$;
-- the four levels (D2) through the live page_level(): none · view (see all, change nothing) · own (own work) · full (everyone's)
-- can_work = may change SOMETHING on the page (own or full); can_edit_page (live) = full only
create or replace function can_work(p text) returns boolean language sql stable security definer set search_path to public as
$$ select page_level(p) in ('own','full') $$;
-- who controls a task: its owner, whoever assigned or created it, the department head, managers/admins
create or replace function can_manage_task(t tasks) returns boolean language sql stable security definer set search_path to public as $$
  select coalesce(is_manager() or my_member_id() in (t.owner_id, t.created_by, t.assigned_by) or heads_department(t.department_id), false) $$;   -- never 'unknown'
-- who works on a task: the above plus the people added to it (helpers/reviewers)
create or replace function can_work_on_task_id(tid uuid) returns boolean language sql stable security definer set search_path to public as $$
  select coalesce((select can_manage_task(t) or exists (select 1 from task_people tp where tp.task_id = t.id and tp.member_id = my_member_id())
                   from tasks t where t.id = tid), false) $$;
-- who controls a report line: the person it's about, whoever wrote it, whoever manages its task, the head, managers
create or replace function can_edit_entry(e report_entries) returns boolean language sql stable security definer set search_path to public as $$
  select coalesce(is_manager() or my_member_id() in (e.member_id, e.created_by) or heads_department(e.department_id)
      or (e.source = 'task' and coalesce((select can_manage_task(t) from tasks t where t.id = e.source_id), false)), false) $$;
create or replace function can_edit_entry_id(eid uuid) returns boolean language sql stable security definer set search_path to public as
$$ select coalesce((select can_edit_entry(e) from report_entries e where e.id = eid), false) $$;

-- the company's owner = its account manager on the company record (read, not copied), resolved to a team member
-- R1 CHANGE: through the live resolve_owner() (Phase 1b-E) — full / Arabic name, nicknames, e-mail prefix,
-- ambiguous names refused, the owner's preference honoured — instead of a second, looser name match
create or replace function company_owner_member(b uuid) returns uuid language sql stable security definer set search_path to public as $$
  select tm.id from businesses x join team_members tm on tm.user_id = public.resolve_owner(x.account_manager) and tm.active
   where x.id = b $$;
-- handing work to someone else: only admins, managers and the department head (Commercial head covers all six)
create or replace function can_assign_to(m uuid) returns boolean language sql stable security definer set search_path to public as $$
  select coalesce(m = my_member_id() or is_manager() or heads_department((select department_id from team_members where id = m)), false) $$;   -- never 'unknown'

-- =====================================================================
-- GUARD RAILS (security definer: they must see rows the person can't)
-- =====================================================================
create or replace function tasks_guard() returns trigger language plpgsql security definer set search_path to public as $$
declare p record; parent record; owner_active boolean; v_done boolean;
begin
  -- who does it: given → project owner → company's account manager → whoever creates it
  if tg_op='INSERT' and new.owner_id is null then
    new.owner_id := coalesce((select owner_id from projects where id = new.project_id),
                             company_owner_member(coalesce(new.business_id, (select business_id from projects where id = new.project_id))),
                             my_member_id());
  end if;
  if (tg_op='INSERT' or new.owner_id is distinct from old.owner_id) then
    if not can_assign_to(new.owner_id) then
      raise exception 'Only an admin, a manager or the department head can assign tasks to someone else'; end if;
    if new.owner_id is distinct from my_member_id() then new.assigned_by := my_member_id(); new.assigned_at := now();
    elsif tg_op='UPDATE' then new.assigned_by := null; new.assigned_at := null; end if;
  end if;
  select active into owner_active from team_members where id = new.owner_id;
  if tg_op='INSERT' or new.owner_id is distinct from old.owner_id then
    if not coalesce(owner_active,false) then raise exception 'Owner is not an active team member'; end if;
    if tg_op='INSERT' or old.status not in (select ts.code from task_statuses ts where ts.is_done) then
      select department_id into new.department_id from team_members where id=new.owner_id;
    end if;
  end if;
  if tg_op='UPDATE' and old.done_at is not null
     and (new.done_at is distinct from old.done_at or new.status is distinct from old.status or new.deleted_at is distinct from old.deleted_at)
     and exists (select 1 from periods pr where pr.kind='month' and pr.locked_at is not null
                 and (old.done_at at time zone 'Asia/Riyadh')::date between pr.start_date and pr.end_date) then
    raise exception 'Task % is counted in an issued month — record a correction instead of editing it', old.code;
  end if;
  if new.project_id is not null then
    select * into p from projects where id=new.project_id;
    if p.deleted_at is not null then raise exception 'Project % is deleted', p.code; end if;
    if new.business_id is null then new.business_id := p.business_id;
    elsif p.business_id is not null and new.business_id <> p.business_id then
      raise exception 'Task company must match its project''s company'; end if;
  end if;
  if new.work_type <> 'internal' and new.business_id is null and new.project_id is null then
    raise exception 'Client work needs a company or a project'; end if;
  if new.contact_id is not null and not exists (select 1 from contacts c where c.id=new.contact_id and c.business_id is not distinct from new.business_id) then
    raise exception 'That contact belongs to a different company'; end if;
  if new.parent_task_id is not null then
    select * into parent from tasks where id=new.parent_task_id;
    if parent.parent_task_id is not null then raise exception 'Subtasks go one level deep only'; end if;
    if parent.project_id is distinct from new.project_id then raise exception 'Subtask must sit in its parent''s project'; end if;
  end if;
  if new.plan_entry_id is not null and (select section from report_entries where id=new.plan_entry_id) <> 'next_month_plan' then
    raise exception 'A task can only deliver a planned item (a "next month plan" line)'; end if;
  select s.is_done into v_done from task_statuses s where s.code=new.status;
  if v_done then
    if new.done_at is null then new.done_at := now(); end if;
    if new.done_by is null then new.done_by := my_member_id(); end if;
    if exists (select 1 from tasks c where c.parent_task_id=new.id and c.deleted_at is null
               and c.status not in (select ts.code from task_statuses ts where ts.is_closed)) then
      raise exception 'Close the open subtasks first'; end if;
  else new.done_at := null; new.done_by := null; end if;
  if tg_op='INSERT' and new.created_by is null then new.created_by := my_member_id(); end if;
  new.updated_at := now();
  return new;
end $$;
create trigger tasks_guard before insert or update on tasks for each row execute function tasks_guard();

create or replace function tasks_status_log() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if tg_op='INSERT' then insert into task_status_log(task_id,from_status,to_status,by_member) values (new.id,null,new.status,my_member_id());
  elsif new.status is distinct from old.status then
    insert into task_status_log(task_id,from_status,to_status,by_member) values (new.id,old.status,new.status,my_member_id()); end if;
  return new;
end $$;
create trigger tasks_status_log after insert or update on tasks for each row execute function tasks_status_log();

-- a finished task marked "send to report" registers its own achievement, credited to the task's owner.
-- Closed by the owner or whoever manages the task → final at once, counts toward its KPI.
-- Closed by anyone else (D7 lets colleagues help) → a draft the owner or their manager finalizes: credit is never decided by a helper.
create or replace function tasks_register_achievement() returns trigger language plpgsql security definer set search_path to public as $$
declare was_done boolean := tg_op='UPDATE' and old.status='done' and old.deleted_at is null;
        is_done boolean := new.status='done' and new.deleted_at is null; e record;
begin
  select * into e from report_entries where source='task' and source_id=new.id;
  if is_done and not was_done and new.include_in_report and e.id is null then
    insert into report_entries(period_id, department_id, member_id, section, category_id, title, entry_date, business_id,
      kpi_id, objective_id, source, source_id, status, created_by)
    select pm.id, new.department_id, new.owner_id, 'achievement', new.report_category_id, new.title,
      (new.done_at at time zone 'Asia/Riyadh')::date, new.business_id, new.kpi_id,
      (select objective_id from kpi_definitions where id=new.kpi_id), 'task', new.id, case when can_manage_task(new) then 'final' else 'draft' end, new.owner_id
    from periods pm where pm.kind='month' and (new.done_at at time zone 'Asia/Riyadh')::date between pm.start_date and pm.end_date;
  elsif was_done and not is_done and e.id is not null then
    if e.status = 'final' and not can_manage_task(new) then
      raise exception 'Task % is a final achievement — only its owner or whoever manages it can reopen it', new.code; end if;
    delete from report_entries where id = e.id;   -- reopened: its achievement is withdrawn (blocked only once the month is issued)
  end if;
  return new;
end $$;
create trigger tasks_register_achievement after insert or update on tasks for each row execute function tasks_register_achievement();

-- manager notes: only a manager/admin or the head of the task's department
create or replace function comments_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if new.kind = 'manager_note' and not (
       exists (select 1 from team_members m join app_users u on u.id=m.user_id where m.id=new.author_id and u.role in ('admin','manager'))
    or exists (select 1 from departments d join tasks t on t.department_id=d.id where t.id=new.task_id and d.head_member_id=new.author_id)) then
    raise exception 'Manager notes are for managers and the department head'; end if;
  return new;
end $$;
create trigger comments_guard before insert or update on task_comments for each row execute function comments_guard();

create or replace function company_documents_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if new.client_profile_id is not null and not exists (select 1 from client_profiles where id=new.client_profile_id and business_id=new.business_id) then
    raise exception 'That client ID belongs to a different company'; end if;
  if tg_op='INSERT' and new.uploaded_by is null then new.uploaded_by := my_member_id(); end if;
  return new;
end $$;
create trigger company_documents_guard before insert or update on company_documents for each row execute function company_documents_guard();

-- R1 CHANGE (oversight, 2026-09-25): Direct Payments owns the discount codes (D6). Their own columns —
-- code, kind, value, dates, sales, active/expired — arrive by import (the 200 live rows came in one SQL batch
-- on 12–13 Aug, no signed-in person) and are re-pointed by company merges; this guard must never refuse
-- either. So it checks ONLY this app's new column `services`, and only when `services` itself changes:
-- an import never writes it, a merge never writes it, and any value Direct Payments sends passes untouched.
-- (29a also refused unknown kinds, 0 / >100 % and reversed dates — Direct Payments' data, not ours; removed.)
create or replace function promo_codes_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if new.services is not null
     and (tg_op = 'INSERT' or new.services is distinct from old.services)
     and exists (select 1 from unnest(new.services) sv where sv not in (select code from service_types)) then
    raise exception 'Unknown service on discount code %', new.code; end if;
  return new;
end $$;
create trigger promo_codes_guard before insert or update on promo_codes for each row execute function promo_codes_guard();

create or replace function block_hard_delete() returns trigger language plpgsql as $$
begin raise exception '% rows are never deleted — archive them (set deleted_at) instead', tg_table_name; end $$;
create trigger tasks_no_delete before delete on tasks for each row execute function block_hard_delete();
create trigger company_documents_no_delete before delete on company_documents for each row execute function block_hard_delete();
create trigger task_files_no_delete before delete on task_files for each row execute function block_hard_delete();   -- removing a file = deleted_at, kept in history
create or replace function stamp_uploader() returns trigger language plpgsql security definer set search_path to public as $$
begin if my_member_id() is not null then new.uploaded_by := my_member_id(); end if; return new; end $$;
create trigger task_files_stamp before insert on task_files for each row execute function stamp_uploader();
create trigger evidence_files_stamp before insert on evidence_files for each row execute function stamp_uploader();
create trigger evidence_no_delete before delete on evidence_files for each row execute function block_hard_delete();
-- files are only added or removed (deleted_at) — never re-pointed to other work or swapped; an issued month's proofs are frozen
create or replace function files_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'deleted_at') <> (to_jsonb(old) - 'deleted_at') then
    raise exception 'A file can only be removed or restored — not moved to other work or replaced'; end if;
  return new;
end $$;
create or replace function evidence_month_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if exists (select 1 from report_entries e join periods p on p.id = e.period_id where e.id = new.entry_id and p.locked_at is not null) then
    raise exception 'This month is issued — its proofs are frozen; add a correction to the next month instead'; end if;
  return new;
end $$;
create trigger task_files_guard before insert or update on task_files for each row execute function files_guard();
create trigger evidence_files_guard before insert or update on evidence_files for each row execute function files_guard();
create trigger evidence_month_guard before insert or update on evidence_files for each row execute function evidence_month_guard();
create trigger projects_no_delete before delete on projects for each row execute function block_hard_delete();

create or replace function projects_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    if exists (select 1 from work_finance_links where project_id=new.id) then
      raise exception 'Project % has invoices linked — unlink them or keep the project', new.code; end if;
    update tasks set deleted_at = new.deleted_at where project_id = new.id and deleted_at is null;
  end if;
  if new.business_id is distinct from old.business_id and exists (select 1 from tasks where project_id=new.id) then
    raise exception 'Cannot move a project with tasks to another company'; end if;
  if new.owner_id is distinct from old.owner_id then
    if (select active from team_members where id=new.owner_id) is not true then raise exception 'Owner is not an active team member'; end if;
    if not can_assign_to(new.owner_id) then raise exception 'Only an admin, a manager or the department head can assign a project to someone else'; end if;
    new.assigned_by := case when new.owner_id is distinct from my_member_id() then my_member_id() end; new.assigned_at := now();
  end if;
  new.updated_at := now(); return new;
end $$;
create trigger projects_guard before update on projects for each row execute function projects_guard();
create or replace function projects_insert_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if new.owner_id is null then new.owner_id := coalesce(company_owner_member(new.business_id), my_member_id()); end if;
  if new.department_id is null then new.department_id := (select department_id from team_members where id = new.owner_id); end if;
  if not can_assign_to(new.owner_id) then raise exception 'Only an admin, a manager or the department head can assign a project to someone else'; end if;
  if new.owner_id is distinct from my_member_id() then new.assigned_by := my_member_id(); new.assigned_at := now(); end if;
  if (select active from team_members where id=new.owner_id) is not true then raise exception 'Owner is not an active team member'; end if;
  if new.created_by is null then new.created_by := my_member_id(); end if;
  return new;
end $$;
create trigger projects_insert_guard before insert on projects for each row execute function projects_insert_guard();

create or replace function tasks_delete_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if new.deleted_at is not null and old.deleted_at is null and exists (select 1 from work_finance_links where task_id=new.id) then
    raise exception 'Task % has invoices linked', new.code; end if;
  return new;
end $$;
create trigger tasks_delete_guard before update of deleted_at on tasks for each row execute function tasks_delete_guard();

create or replace function members_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if old.active and not new.active and exists (select 1 from tasks t join task_statuses s on s.code=t.status
     where t.owner_id=new.id and t.deleted_at is null and not s.is_closed) then
    raise exception 'Reassign this person''s open tasks before deactivating them'; end if;
  if old.active and not new.active and exists (select 1 from projects where owner_id=new.id and deleted_at is null and status not in ('done','cancelled')) then
    raise exception 'Reassign this person''s open projects before deactivating them'; end if;
  return new;
end $$;
create trigger members_guard before update on team_members for each row execute function members_guard();

-- invoice link: the invoice must exist in Finance (from Direct Payments), be live and not excluded,
-- and its company (Finance's own client match) must be the project's company
create or replace function finance_link_guard() returns trigger language plpgsql security definer set search_path to public as $$
declare p record; t record; v_live int; v_excl int; v_biz uuid; v_nbiz int;
begin
  select * into p from projects where id=new.project_id;
  if p.deleted_at is not null then raise exception 'Project is deleted'; end if;
  if p.business_id is null then raise exception 'Internal projects cannot carry invoices'; end if;
  select count(*) filter (where deleted_at is null), count(*) filter (where deleted_at is null and exclusion_reason is not null)
    into v_live, v_excl from finance_invoices where invoice_no = new.invoice_no;
  if v_live = 0 then raise exception 'Invoice % is not in Finance (imported from Direct Payments) or is deleted', new.invoice_no; end if;
  if v_excl > 0 then raise exception 'Invoice % is excluded in Finance and cannot be linked', new.invoice_no; end if;
  select count(distinct l.business_id), min(l.business_id::text)::uuid into v_nbiz, v_biz
    from finance_invoices i left join finance_client_links l on l.client_group = i.client_group
    where i.invoice_no = new.invoice_no and i.deleted_at is null;
  if v_biz is null then raise exception 'Invoice % is not matched to a company in Finance yet', new.invoice_no; end if;
  if v_nbiz > 1 or v_biz <> p.business_id then raise exception 'Invoice % belongs to a different company than project %', new.invoice_no, p.code; end if;
  if new.task_id is not null then
    select * into t from tasks where id=new.task_id;
    if t.project_id is distinct from new.project_id then raise exception 'Task is not in this project'; end if;
  end if;
  if new.credited_member_id is not null and (select active from team_members where id=new.credited_member_id) is not true then
    raise exception 'Credited person is not an active team member'; end if;
  if tg_op='INSERT' and new.linked_by is null then new.linked_by := my_member_id(); end if;
  return new;
end $$;
create trigger finance_link_guard before insert or update on work_finance_links for each row execute function finance_link_guard();

create or replace function report_entries_guard() returns trigger language plpgsql security definer set search_path to public as $$
declare pid uuid := coalesce(new.period_id, old.period_id); k text; km text; ku text; locked boolean;
begin
  select kind, locked_at is not null into k, locked from periods where id = pid;
  if k <> 'month' then raise exception 'Report lines are registered per month'; end if;
  if tg_op = 'DELETE' then
    if locked then raise exception 'This month is issued and locked — add a correction to the next month instead'; end if;
    return old; end if;
  if locked or (tg_op = 'UPDATE' and (select locked_at from periods where id=old.period_id) is not null) then
    if tg_op = 'INSERT' or (to_jsonb(new) - array['updated_at','include','sort']) <> (to_jsonb(old) - array['updated_at','include','sort']) then
      raise exception 'This month is issued and locked — add a correction to the next month instead'; end if; end if;
  if new.kpi_id is not null then
    select method, unit into km, ku from kpi_definitions where id=new.kpi_id;
    if km <> 'manual' and new.value is not null then
      raise exception 'report_no_typed_money: this KPI is calculated from the system (Finance) — nothing is typed against it'; end if;
    if new.section = 'achievement' and new.value is null and ku = 'count' then new.value := 1; end if;
  end if;
  -- finalizing: stamped with whoever is signed in (the owner or whoever manages the task) — can't be typed; proof optional
  if new.status = 'final' and (tg_op = 'INSERT' or old.status <> 'final') then
    new.finalized_at := now(); new.finalized_by := coalesce(my_member_id(), new.member_id);
  elsif new.status = 'draft' then new.finalized_at := null; new.finalized_by := null;
  else new.finalized_at := old.finalized_at; new.finalized_by := old.finalized_by; end if;
  -- a line is credited to yourself; crediting a colleague is for managers / the head (or the task's own owner when a task registers it)
  if (tg_op = 'INSERT' or new.member_id is distinct from old.member_id) and new.member_id is not null
     and not can_assign_to(new.member_id)
     and not coalesce(new.source = 'task' and new.member_id = (select owner_id from tasks where id = new.source_id), false) then
    raise exception 'Only a manager or the department head can credit an achievement to someone else'; end if;
  -- 'created by' is whoever is signed in and never changes
  if tg_op = 'INSERT' then new.created_by := coalesce(my_member_id(), new.created_by); else new.created_by := old.created_by; end if;
  new.updated_at := now(); return new;
end $$;
create trigger report_entries_guard before insert or update or delete on report_entries for each row execute function report_entries_guard();

create or replace function reports_guard() returns trigger language plpgsql security definer set search_path to public as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then raise exception 'Issued reports cannot be deleted'; end if; return old; end if;
  if old.status = 'superseded' then raise exception 'Superseded reports are frozen'; end if;
  if old.status = 'issued' then
    if new.status = 'superseded' and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then return new; end if;
    raise exception 'Issued reports are frozen — issue a correction that supersedes it'; end if;
  if new.status = 'issued' then perform reports_issue(new); new.doc_number := coalesce(new.doc_number, reports_number(new.kind)); end if;
  return new;
end $$;
create or replace function reports_number(k text) returns text language sql security definer set search_path to public as
$$ select next_document_number(case k when 'monthly' then 'MRP' when 'quarterly' then 'QRP' else 'YRP' end) $$;
create or replace function reports_issue(r reports) returns void language plpgsql security definer set search_path to public as $$
begin
  update periods set locked_at = coalesce(locked_at, now()) where id = r.period_id and kind = 'month';
end $$;
create trigger reports_guard before update or delete on reports for each row execute function reports_guard();
create or replace function reports_insert_guard() returns trigger language plpgsql security definer set search_path to public as $$
declare k text;
begin
  select kind into k from periods where id=new.period_id;
  if (new.kind, k) not in (('monthly','month'),('quarterly','quarter'),('annual','year')) then
    raise exception 'A % report needs a % period', new.kind, case new.kind when 'monthly' then 'month' when 'quarterly' then 'quarter' else 'year' end; end if;
  if new.supersedes_id is not null then
    update reports set status='superseded' where id=new.supersedes_id and status='issued';
    if not found then raise exception 'Can only supersede an issued report'; end if;
  end if;
  if new.status='issued' then perform reports_issue(new); new.doc_number := coalesce(new.doc_number, reports_number(new.kind)); end if;
  return new;
end $$;
create trigger reports_insert_guard before insert on reports for each row execute function reports_insert_guard();

-- audit trail: the app's own record_history_write (feeds Activity & Audit + 24h Undo)
do $$ declare t text; begin
  foreach t in array array['departments','team_members','projects','tasks','task_people','task_checklist','task_comments',
    'task_files','task_dependencies','task_tags','work_finance_links','objectives','initiatives','kpi_definitions',
    'kpi_targets','report_entries','reports','evidence_files','company_documents','work_settings'] loop
    execute format('create trigger trg_record_history after insert or update or delete on %I for each row execute function record_history_write()', t);
  end loop; end $$;

-- =====================================================================
-- VIEWS — security_invoker: a view never shows more than the person may read
-- =====================================================================
-- live, paid, not-excluded invoice lines = the same truth as the Finance page (M1: VAT never inside)
create view finance_lines with (security_invoker = on) as
select i.id, i.invoice_no, i.invoice_date, i.client_group, l.business_id,
  i.revenue_sar, i.cost_sar, i.profit_sar, i.amount_received_sar, i.amount_remaining_sar,
  (i.cost_sar is null or i.cost_sar = 0) as cost_missing, i.source_batch
from finance_invoices i left join finance_client_links l on l.client_group = i.client_group
where i.deleted_at is null and i.exclusion_reason is null and i.integrity_status = 'verified_paid';

-- how fresh the reflected money is (every money screen prints this)
create view finance_as_of with (security_invoker = on) as
select max(invoice_date) as latest_invoice_date, max(source_batch) as latest_batch, count(*) as live_lines from finance_lines;

-- who is credited: an override on the link, else the company's account manager (by name, as the app does)
create view finance_credit with (security_invoker = on) as
select f.*, coalesce(w.credited_member_id, am.member_id) as member_id,
  case when w.credited_member_id is not null then 'override' when am.member_id is not null then 'account_manager' else 'none' end as credit_source,
  w.project_id
from finance_lines f
left join work_finance_links w on w.invoice_no = f.invoice_no
left join businesses b on b.id = f.business_id
left join lateral (select tm.id as member_id from team_members tm      -- R1 CHANGE: the live resolver
   where b.account_manager is not null and tm.user_id = public.resolve_owner(b.account_manager)) am on true;

-- Finance page tab "By project": money per project, only through the links
create view project_money with (security_invoker = on) as
select p.id as project_id, p.code,
  sum(f.revenue_sar) as revenue_sar, sum(f.cost_sar) as cost_sar, sum(f.profit_sar) as profit_sar,
  sum(f.amount_received_sar) as collected_sar, sum(f.amount_remaining_sar) as remaining_sar,
  count(distinct f.invoice_no) as invoices, count(*) filter (where f.cost_missing) as lines_cost_missing
from projects p
join work_finance_links w on w.project_id = p.id
join finance_lines f on f.invoice_no = w.invoice_no
where p.deleted_at is null
group by p.id, p.code;

create view tasks_done_by_period with (security_invoker = on) as
select t.id as task_id, t.owner_id, t.department_id, t.work_type, t.service_type,
  pm.id as period_id, pm.kind as period_kind, t.due_date, (t.done_at at time zone 'Asia/Riyadh')::date as done_date
from tasks t join periods pm on (t.done_at at time zone 'Asia/Riyadh')::date between pm.start_date and pm.end_date
where t.deleted_at is null and t.status = 'done';

create view kpi_actuals with (security_invoker = on) as
with task_scopes as (
  select 'member'::text scope, d.owner_id member_id, null::uuid department_id, d.work_type, d.service_type, d.period_id, d.due_date, d.done_date from tasks_done_by_period d
  union all select 'department', null, d.department_id, d.work_type, d.service_type, d.period_id, d.due_date, d.done_date from tasks_done_by_period d
  union all select 'company', null, null, d.work_type, d.service_type, d.period_id, d.due_date, d.done_date from tasks_done_by_period d
), fin as (
  select c.*, tm.department_id as dept, pm.id as period_id
  from finance_credit c left join team_members tm on tm.id = c.member_id
  join periods pm on c.invoice_date between pm.start_date and pm.end_date
), fin_scopes as (
  select 'company'::text scope, null::uuid member_id, null::uuid department_id, f.period_id, f.revenue_sar, f.profit_sar, f.amount_received_sar, f.cost_missing from fin f
  union all select 'department', null, f.dept, f.period_id, f.revenue_sar, f.profit_sar, f.amount_received_sar, f.cost_missing from fin f where f.dept is not null
  union all select 'member', f.member_id, null, f.period_id, f.revenue_sar, f.profit_sar, f.amount_received_sar, f.cost_missing from fin f where f.member_id is not null
), counted as (   -- final achievements
  select e.kpi_id, e.member_id, e.department_id, e.value, pe.start_date as e_start, e.entry_date, e.created_at, pt.id as target_period_id
  from report_entries e join periods pe on pe.id = e.period_id
  join periods pt on pe.start_date >= pt.start_date and pe.end_date <= pt.end_date
  where e.kpi_id is not null and e.value is not null and e.status = 'final'
), manual as (
  select x.*, row_number() over (partition by x.kpi_id, x.scope, x.s_member, x.s_dept, x.target_period_id order by x.e_start desc, x.entry_date desc nulls last, x.created_at desc) as rn
  from (select c.*, 'member'::text scope, c.member_id s_member, null::uuid s_dept from counted c where c.member_id is not null
        union all select c.*, 'department', null, c.department_id from counted c
        union all select c.*, 'company', null, null from counted c) x
)
select k.id as kpi_id, s.scope, s.member_id, s.department_id, s.period_id,
  case k.method when 'tasks_done' then count(*)::numeric
    else round(100.0 * count(*) filter (where s.due_date is null or s.done_date <= s.due_date) / count(*), 1) end as actual,
  count(*)::int as rows_counted, null::int as lines_cost_missing
from kpi_definitions k join task_scopes s
  on (k.filter_work_type is null or s.work_type=k.filter_work_type) and (k.filter_service_type is null or s.service_type=k.filter_service_type)
where k.method in ('tasks_done','tasks_on_time_pct') and k.active
group by k.id, k.method, s.scope, s.member_id, s.department_id, s.period_id
union all
select k.id, f.scope, f.member_id, f.department_id, f.period_id,
  case k.method when 'finance_revenue' then sum(f.revenue_sar) when 'finance_profit' then sum(f.profit_sar)
                else sum(f.amount_received_sar) end,
  count(*)::int, count(*) filter (where f.cost_missing)::int
from kpi_definitions k join fin_scopes f on true
where k.method in ('finance_revenue','finance_profit','finance_collected') and k.active
group by k.id, k.method, f.scope, f.member_id, f.department_id, f.period_id
union all
select k.id, m.scope, m.s_member, m.s_dept, m.target_period_id,
  case when k.aggregation='sum' then sum(m.value) else max(m.value) filter (where m.rn = 1) end,
  count(*)::int, null
from kpi_definitions k join manual m on m.kpi_id = k.id
where k.method='manual' and k.active
group by k.id, k.aggregation, m.scope, m.s_member, m.s_dept, m.target_period_id;

-- target vs actual; a KPI nobody measured shows NULL ("not measured"), never 0
create view kpi_scorecard with (security_invoker = on) as
select tg.id as target_id, tg.kpi_id, k.code, k.n, k.unit, tg.scope, tg.member_id, tg.department_id, tg.period_id,
  tg.target_value, a.actual, a.rows_counted, a.lines_cost_missing,
  case when a.actual is null or tg.target_value = 0 then null
       when k.direction='higher' then round(100 * a.actual / tg.target_value, 1)
       else round(100 * tg.target_value / nullif(a.actual,0), 1) end as pct_of_target,
  case when a.actual is null or tg.target_value = 0 then null
       else least(120, case when k.direction='higher' then round(100 * a.actual / tg.target_value, 1)
                            else round(100 * tg.target_value / nullif(a.actual,0), 1) end) end as pct_capped
from kpi_targets tg join kpi_definitions k on k.id=tg.kpi_id
left join kpi_actuals a on a.kpi_id=tg.kpi_id and a.scope=tg.scope and a.period_id=tg.period_id
  and a.member_id is not distinct from tg.member_id and a.department_id is not distinct from tg.department_id;

-- Clients / Leads card "Work" tab and the next action: the company's open tasks, soonest first
create view company_open_work with (security_invoker = on) as
select t.business_id, t.id as task_id, t.code, t.title, t.status, t.due_date, t.owner_id,
  row_number() over (partition by t.business_id order by t.due_date nulls last, t.created_at) = 1 as is_next
from tasks t join task_statuses s on s.code = t.status
where t.deleted_at is null and not s.is_closed and t.business_id is not null;

-- weekly rhythm: open, started tasks with no dated update in the last 7 days
create view tasks_missing_weekly_update with (security_invoker = on) as
select t.id as task_id, t.code, t.owner_id, t.department_id,
  (select max(c.created_at) from task_comments c where c.task_id=t.id and c.kind='weekly_update' and c.deleted_at is null) as last_update_at
from tasks t
where t.deleted_at is null and t.status in ('in_progress','waiting')
  and not exists (select 1 from task_comments c where c.task_id=t.id and c.kind='weekly_update' and c.deleted_at is null
                  and c.created_at > now() - interval '7 days');

-- KPI danger light: on track / at risk / behind / missed / achieved, for month, quarter and year.
-- pace = how much of the period has passed (Riyadh today); % KPIs compare straight to target.
create or replace function work_today() returns date language sql stable as
$$ select coalesce(nullif(current_setting('app.today', true), '')::date, (now() at time zone 'Asia/Riyadh')::date) $$;
create view kpi_pace with (security_invoker = on) as
select s.*, p.kind as period_kind, p.start_date, p.end_date,
  least(1, greatest(0, (work_today() - p.start_date + 1)::numeric / (p.end_date - p.start_date + 1))) as elapsed,
  case
    when work_today() < p.start_date then 'not_started'
    when s.actual is null then case when work_today() > p.end_date then 'missed' else 'not_measured' end
    when s.pct_of_target >= 100 then 'achieved'
    when work_today() > p.end_date then 'missed'
    else (select case when r >= 1 then 'on_track' when r >= 0.7 then 'at_risk' else 'behind' end
          from (select case when k.aggregation = 'latest' then s.pct_of_target / 100
                            else s.pct_of_target / 100 / nullif(least(1, greatest(0, (work_today() - p.start_date + 1)::numeric / (p.end_date - p.start_date + 1))), 0) end as r) z)
  end as light
from kpi_scorecard s join periods p on p.id = s.period_id join kpi_definitions k on k.id = s.kpi_id;

-- proofs for an achievement: its own files + the files on the task it came from
create view entry_proofs with (security_invoker = on) as
select e.id as entry_id, 'achievement' as attached_to, f.storage_path, f.file_name, f.created_at from report_entries e join evidence_files f on f.entry_id = e.id and f.deleted_at is null
union all
select e.id, 'task', f.storage_path, f.file_name, f.created_at from report_entries e join task_files f on e.source = 'task' and f.task_id = e.source_id and f.deleted_at is null;

-- the trail anyone can check (read-only for Quality, Strategy, Integrity): task → achievement → month → KPI → proof → who finalized
create view achievement_trail with (security_invoker = on) as
select e.id as entry_id, e.section, e.title, e.entry_date, pm.label_en as month, pm.locked_at is not null as month_issued,
  (select r.doc_number from reports r where r.period_id = e.period_id and r.status = 'issued' and r.kind = 'monthly' limit 1) as report_no,
  t.code as task_code, t.title as task_title, t.created_at as task_started, t.done_at as task_done,
  k.code as kpi_code, k.name_en as kpi_name, o.n as objective_n, e.value,
  (select count(*) from entry_proofs x where x.entry_id = e.id) as proofs,
  (select count(*) from entry_proofs x where x.entry_id = e.id) = 0 as no_proof,
  e.status, e.finalized_by, e.finalized_at,
  (e.kpi_id is not null and e.status = 'final') as counts_toward_kpi,
  e.member_id, e.department_id, e.business_id
from report_entries e join periods pm on pm.id = e.period_id
left join tasks t on e.source = 'task' and t.id = e.source_id
left join kpi_definitions k on k.id = e.kpi_id left join objectives o on o.id = coalesce(e.objective_id, k.objective_id);

-- one place per company: client IDs by type, discount codes, files, open work
create view company_card with (security_invoker = on) as
select b.id as business_id, b.name, b.name_ar, b.account_manager, b.cr_vat,
  b.contract_start, b.contract_end, b.contract_scope,       -- agreement details already on the company record
  (select jsonb_agg(jsonb_build_object('client_id', c.direct_client_id, 'type', c.profile_type, 'status', c.status,
      'payment_terms', c.payment_terms, 'credit_limit_sar', c.credit_limit_sar, 'tender_amount_sar', c.tender_amount_sar) order by c.profile_type)
     from client_profiles c where c.business_id = b.id) as client_ids,
  (select count(*) from client_profiles c where c.business_id = b.id) as client_id_count,
  company_owner_member(b.id) as account_manager_member_id,    -- null while the name matches no team member
  (select jsonb_agg(jsonb_build_object('code', p.code, 'kind', p.kind, 'value', p.value_pct, 'services', p.services, 'purpose', p.purpose,
      'valid_from', p.valid_from, 'valid_to', p.valid_to,
      'status', case when not coalesce(p.active,true) then 'off' when coalesce(p.expired,false) or p.valid_to < work_today() then 'expired'
                     when p.valid_from > work_today() then 'upcoming' else 'active' end) order by p.valid_to desc nulls last)
     from promo_codes p where p.partner_business_id = b.id) as discount_codes,
  (select jsonb_object_agg(d.doc_type, d.n) from (select doc_type, count(*) n from company_documents where business_id = b.id and deleted_at is null group by doc_type) d) as documents,
  array(select x from unnest(array['cr','vat','agreement']) x
        where not exists (select 1 from company_documents d where d.business_id = b.id and d.doc_type = x and d.deleted_at is null)) as missing_documents,
  (select count(*) from company_documents d where d.business_id = b.id and d.deleted_at is null and d.valid_to < work_today()) as expired_documents,
  (select count(*) from company_open_work w where w.business_id = b.id) as open_tasks
from businesses b;

-- =====================================================================
-- ROW-LEVEL SECURITY (every policy goes through the app's own app_role / page access)
-- =====================================================================
create or replace function can_see_task(t tasks) returns boolean language sql stable security definer set search_path to public as $$
  select (open_visibility() and app_role() is not null) or is_manager() or page_level('tasks') in ('view','full')   -- View sees all, Full changes all (D2)
      or t.owner_id = my_member_id() or t.created_by = my_member_id()
      or heads_department(t.department_id)
      or exists (select 1 from task_people tp where tp.task_id = t.id and tp.member_id = my_member_id())
$$;
create or replace function can_see_task_id(tid uuid) returns boolean language sql stable security definer set search_path to public as
$$ select coalesce((select can_see_task(t) from tasks t where t.id = tid), false) $$;
create or replace function can_see_project(p projects) returns boolean language sql stable security definer set search_path to public as $$
  select (open_visibility() and app_role() is not null) or is_manager() or page_level('tasks') in ('view','full') or p.owner_id = my_member_id() or p.created_by = my_member_id() or heads_department(p.department_id)
      or exists (select 1 from tasks t where t.project_id = p.id and t.deleted_at is null and can_see_task(t))
$$;

do $$ declare t text; begin
  foreach t in array array['departments','task_statuses','priorities','work_types','service_types','report_categories','tags',
    'team_members','periods','objectives','initiatives','kpi_definitions','kpi_targets','projects','tasks','task_people',
    'task_checklist','task_comments','task_files','task_dependencies','task_tags','task_status_log','work_finance_links',
    'report_entries','reports','evidence_files','company_documents','work_settings'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
  -- Settings lists: everyone signed in reads; admins and managers edit
  foreach t in array array['task_statuses','priorities','work_types','service_types','report_categories','tags',
    'objectives','initiatives','kpi_definitions','kpi_targets'] loop
    execute format('create policy %1$s_read on %1$I for select using (app_role() is not null)', t);
    execute format('create policy %1$s_write on %1$I for all using (is_manager()) with check (is_manager())', t);
  end loop;
  -- people and the calendar: admins only (Team & Access)
  foreach t in array array['departments','team_members','periods'] loop
    execute format('create policy %1$s_read on %1$I for select using (app_role() is not null)', t);
    execute format('create policy %1$s_write on %1$I for all using (app_role() = ''admin'') with check (app_role() = ''admin'')', t);
  end loop;
end $$;

create policy tasks_read on tasks for select using (can_see_page('tasks') and can_see_task(tasks));
create policy tasks_insert on tasks for insert with check (can_work('tasks') and (is_manager() or owner_id = my_member_id() or heads_department((select department_id from team_members where id = owner_id))));
create policy tasks_update on tasks for update using (can_edit_page('tasks') or (can_work('tasks') and can_work_on_task_id(id))) with check (can_work('tasks'));
create policy projects_read on projects for select using (can_see_page('tasks') and can_see_project(projects));
create policy projects_insert on projects for insert with check (can_work('tasks') and (is_manager() or owner_id = my_member_id() or heads_department(department_id)));
create policy projects_update on projects for update using (can_edit_page('tasks') or can_work('tasks') and (is_manager() or owner_id = my_member_id() or heads_department(department_id)));
do $$ declare t text; begin
  foreach t in array array['task_people','task_checklist','task_files','task_dependencies','task_tags'] loop
    execute format('create policy %1$s_read on %1$I for select using (can_see_task_id(task_id))', t);
    execute format('create policy %1$s_write on %1$I for all using (can_edit_page(''tasks'') or (can_work(''tasks'') and can_work_on_task_id(task_id))) with check (can_edit_page(''tasks'') or (can_work(''tasks'') and can_work_on_task_id(task_id)))', t);
  end loop; end $$;
create policy task_status_log_read on task_status_log for select using (can_see_task_id(task_id));
create policy task_comments_read on task_comments for select using (can_see_task_id(task_id));
create policy task_comments_insert on task_comments for insert with check (can_work('tasks') and can_see_task_id(task_id) and author_id = my_member_id());
create policy task_comments_update on task_comments for update using (can_work('tasks') and author_id = my_member_id()) with check (author_id = my_member_id());
-- money links follow the Finance page's own access (same rule as finance_invoices)
create policy wfl_read on work_finance_links for select using (can_see_page('finance') or (open_visibility() and app_role() is not null));
create policy wfl_write on work_finance_links for all using (can_edit_page('finance')) with check (can_edit_page('finance'));
-- report registration: everyone with the Reports page reads; you write your lines, heads/managers write their department's
create policy re_read on report_entries for select using (can_see_page('reports') or (open_visibility() and app_role() is not null));
create policy re_write on report_entries for all using (can_edit_page('reports') or (can_work('reports') and can_edit_entry(report_entries)))
  with check (can_edit_page('reports') or (can_work('reports') and can_edit_entry(report_entries)));
create policy reports_read on reports for select using (can_see_page('reports') or (open_visibility() and app_role() is not null));
create policy ev_read on evidence_files for select using (app_role() is not null);
create policy ev_write on evidence_files for insert with check (uploaded_by = my_member_id() and (can_edit_page('reports') or (can_work('reports') and can_edit_entry_id(entry_id))));
create policy ev_remove on evidence_files for update using (can_edit_page('reports') or (can_work('reports') and can_edit_entry_id(entry_id)))
  with check (can_edit_page('reports') or (can_work('reports') and can_edit_entry_id(entry_id)));
create policy cd_read on company_documents for select using (can_see_page('clients') or can_see_page('leads') or (open_visibility() and app_role() is not null));
create policy cd_write on company_documents for all using (can_edit_page('clients') or can_edit_page('leads')) with check (can_edit_page('clients') or can_edit_page('leads'));
create policy ws_read on work_settings for select using (app_role() is not null);
create policy ws_write on work_settings for all using (app_role() = 'admin') with check (app_role() = 'admin');
create policy reports_write on reports for all using (is_manager()) with check (is_manager());

-- ---------- D7 for tasks: the owner is told ----------
-- Changes somebody ELSE made in the last p_days (1..60, default 7) to your tasks (the task, its checklist,
-- comments, files, people, links, tags) and to your achievements. Same shape and rules as the live
-- changes_to_my_companies(): runs as the caller, newest first, at most 50. Drawn next to it on Today.
create or replace function public.changes_to_my_tasks(p_days int default 7)
returns table(history_id bigint, at timestamptz, actor_name text, table_name text, action text,
              task_id uuid, task_code text, task_title text, before_row jsonb, after_row jsonb)
language sql stable security invoker set search_path to 'public' as $function$
  with h as (
    select h.*,
           case when h.table_name in ('tasks') then h.record_id
                when h.table_name = 'report_entries' then null
                else coalesce(nullif(h.after_row->>'task_id','')::uuid, nullif(h.before_row->>'task_id','')::uuid) end as tid,
           case when h.table_name = 'report_entries'
                then coalesce(nullif(h.after_row->>'member_id','')::uuid, nullif(h.before_row->>'member_id','')::uuid) end as entry_member
      from record_history h
     where h.table_name in ('tasks','task_checklist','task_comments','task_files','task_people','task_dependencies','task_tags','report_entries')
       and h.at > now() - make_interval(days => greatest(1, least(coalesce(p_days,7), 60)))
       and h.actor is not null and h.actor is distinct from auth.uid()
  )
  select h.id, h.at, h.actor_name, h.table_name, h.action, t.id, t.code,
         coalesce(t.title, h.after_row->>'title', h.before_row->>'title'), h.before_row, h.after_row
    from h left join tasks t on t.id = h.tid
   where auth.uid() is not null and my_member_id() is not null
     and (t.owner_id = my_member_id() or h.entry_member = my_member_id())
   order by h.at desc
   limit 50
$function$;
revoke all on function public.changes_to_my_tasks(int) from public, anon;   -- R1 CHANGE: anon too (live default privileges grant it)
grant execute on function public.changes_to_my_tasks(int) to authenticated;
revoke all on function public.next_work_number(text) from public, anon;
grant execute on function public.next_work_number(text) to authenticated;

-- ---------- R1 CHANGE: the history of tasks and achievements follows their pages ----------
-- live record_history_read was `true` for everything but finance; with open visibility turned off, every
-- task's before/after would still be readable by all
drop policy if exists record_history_read on public.record_history;
create policy record_history_read on public.record_history for select to authenticated using (
  case
    when table_name = any (array['finance_invoices','finance_transactions','finance_client_links']) then public.can_see_page('finance')
    when table_name = 'tasks' then public.can_see_page('tasks') and public.can_see_task_id(record_id)
    when table_name = any (array['task_people','task_checklist','task_comments','task_files','task_dependencies','task_tags'])
      then public.can_see_page('tasks') and public.can_see_task_id(coalesce(nullif(after_row->>'task_id','')::uuid, nullif(before_row->>'task_id','')::uuid))
    when table_name = 'projects' then public.can_see_page('tasks')
    when table_name = any (array['report_entries','reports','evidence_files','kpi_targets']) then public.can_see_page('reports')
    else true
  end);

-- ---------- R1 CHANGE: Undo knows the task tables (D7: every change can be undone within 24 h) ----------
do $u$ declare d text; begin
  d := pg_get_functiondef('public.undo_change(bigint)'::regprocedure);
  if position('R1: tasks' in d) = 0 then
    d := replace(d, $x$  elsif h.table_name in ('finance_invoices','finance_transactions','finance_client_links') then
    pg := 'finance';$x$, $x$  elsif h.table_name in ('finance_invoices','finance_transactions','finance_client_links') then
    pg := 'finance';
  elsif h.table_name in ('tasks','projects','task_people','task_checklist','task_comments','task_files','task_dependencies','task_tags') then
    pg := 'tasks';   -- R1: tasks$x$);
    d := replace(d, $x$when 'finance' then 'Finance' else pg end;$x$, $x$when 'finance' then 'Finance' when 'tasks' then 'Tasks' else pg end;$x$);
    if position('R1: tasks' in d) = 0 then raise exception 'undo_change did not take the tasks mapping'; end if;
    execute d;
  end if;
end $u$;
-- ---------- SEED: the 2026 company plan, verbatim from js/core/core-10-v29-reports.js (14 · 30 · 12) ----------
insert into objectives(year,n,title_en,title_ar,strategy_link,owner_text) values
 (2026,1,'Increase revenue from commercial contracts and direct sales','زيادة الإيرادات من العقود التجارية والمبيعات المباشرة','4.1 - 5.1','Visas & Study + Hotels & Flights'),
 (2026,2,'Expand participation in public and private tenders as a revenue stream','توسيع المشاركة في المناقصات الحكومية والخاصة كمصدر للإيرادات','5.2','Visas & Study + Hotels & Flights'),
 (2026,3,'Improve supplier terms and contract conditions','تحسين شروط الموردين وبنود العقود','4.3','All Departments'),
 (2026,4,'Increase the number of payment solutions','زيادة عدد حلول الدفع','4.1','Products and Tech'),
 (2026,5,'Raise customer satisfaction by improving complaint handling','رفع رضا العملاء من خلال تحسين التعامل مع الشكاوى','1.1','All Departments'),
 (2026,6,'Expand strategic partnerships to enhance travel and service integration','توسيع الشراكات الاستراتيجية لتعزيز تكامل السفر والخدمات','3.1','Products and Tech'),
 (2026,7,'Explore new travel services "support services" and increase the number of embassies for visas business','استكشاف خدمات سفر جديدة "خدمات الدعم" وزيادة عدد السفارات لأعمال التأشيرات','3.1','Products and Tech'),
 (2026,8,'Achieve recognition through a local or international award in tourism or education','تحقيق تقدير عبر جائزة محلية أو دولية في السياحة أو التعليم','2','NA'),
 (2026,9,'Drive innovation by engaging employees to generate and implement creative ideas','دفع الابتكار من خلال إشراك الموظفين في توليد الأفكار الإبداعية وتنفيذها','7.3','NA'),
 (2026,10,'Apply unified quality standards across all departments','تطبيق معايير جودة موحدة في جميع الإدارات','8.3','All Departments'),
 (2026,11,'Manage the commercial pricing across all products','إدارة التسعير التجاري عبر جميع المنتجات','5.1','NA'),
 (2026,12,'Direct''s presence at key B2B travel and exhibitions and conferences','حضور دايركت في معارض ومؤتمرات السفر التجارية الرئيسية (B2B)','2','NA'),
 (2026,13,'Build a centralised commercial platform providing all departments with real-time data and insights','بناء منصة تجارية مركزية تزوّد جميع الإدارات ببيانات ورؤى فورية','8.2','NA'),
 (2026,14,'Commercially launch and grow a full suite of luxury travel services','إطلاق وتنمية مجموعة كاملة من خدمات السفر الفاخرة تجاريًا','3.1','NA');
insert into initiatives(year,n,title_en,objective_id) values
 (2026,1,'Develop an updated and categorized database of target companies across sectors',(select id from objectives where year=2026 and n=1)),
 (2026,2,'Create an executive plan focused on growth and optimization',(select id from objectives where year=2026 and n=1)),
 (2026,3,'Analyze winning tenders in the market',(select id from objectives where year=2026 and n=2)),
 (2026,4,'Conduct semi-annual partner evaluations',(select id from objectives where year=2026 and n=2)),
 (2026,5,'Assess providers twice a year based on complaints and service quality',(select id from objectives where year=2026 and n=3)),
 (2026,6,'Review active contracts and analyze clauses',(select id from objectives where year=2026 and n=3)),
 (2026,7,'Enhance complaint resolution skills via scenario-based training',(select id from objectives where year=2026 and n=5)),
 (2026,8,'Explore integration opportunities with service providers (flights & hotels)',(select id from objectives where year=2026 and n=6)),
 (2026,9,'Launching the cruise reservations service',(select id from objectives where year=2026 and n=7)),
 (2026,10,'Launching the private jet reservation service',(select id from objectives where year=2026 and n=7)),
 (2026,11,'Launch a company-wide quality rollout covering all departments',(select id from objectives where year=2026 and n=10)),
 (2026,12,'Explore new payment solutions and nominate the best option',(select id from objectives where year=2026 and n=4));
insert into kpi_definitions(code,n,name_en,unit,aggregation,method,objective_id,focus,is_draft) values
 ('K01',1,'Improvement of suppliers contracts terms','percent','latest','manual',(select id from objectives where year=2026 and n=3),array['Improve contract conditions with service suppliers','Reduce operational service costs','Achieve higher discount rates from suppliers']::text[],false),
 ('K02',2,'Number of embassies added to the platform','count','sum','manual',(select id from objectives where year=2026 and n=7),array['Add new embassies to the platform','Expand geographical coverage of embassy services','Develop digital integration with embassy systems']::text[],false),
 ('K03',3,'Number of tenders submitted','count','sum','manual',(select id from objectives where year=2026 and n=2),array['Increase participation in public and private tenders','Improve the quality of tender submissions','Establish contracts with clear payment schedules']::text[],false),
 ('K04',4,'Number of new support services','count','sum','manual',(select id from objectives where year=2026 and n=7),array['Develop and launch new travel support services','Design innovative services aligned with customer needs','Expand VIP and value-added services']::text[],false),
 ('K05',5,'Number of employee-generated development ideas','count','sum','manual',(select id from objectives where year=2026 and n=9),array['Promote a culture of innovation among employees','Encourage staff participation in idea generation','Implement an internal platform for collecting ideas']::text[],false),
 ('K06',6,'Overall customer satisfaction rate','percent','latest','manual',(select id from objectives where year=2026 and n=5),array['Enhance customer experience across services','Analyze customer feedback to improve services','Improve responsiveness and service quality']::text[],false),
 ('K07',7,'Technical Integration Options in Hotel and Airline products','count','sum','manual',(select id from objectives where year=2026 and n=6),array['Strengthen integration with global booking systems','Expand hotel and airline supplier network','Develop technical API integrations for the platform']::text[],false),
 ('K08',8,'Value of commercial agreements and direct sales closed','SAR','sum','manual',(select id from objectives where year=2026 and n=1),array['Expand new commercial partnerships','Strengthen collaboration with existing partners','Activate additional sales channels']::text[],false),
 ('K09',9,'Number of nominations submitted for awards in tourism or education','count','sum','manual',(select id from objectives where year=2026 and n=8),array['Identify relevant industry awards','Prepare high-quality nomination submissions','Increase company visibility in sector awards']::text[],false),
 ('K10',10,'Number of available payment solutions','count','sum','manual',(select id from objectives where year=2026 and n=4),array['Expand available payment options','Integrate additional digital payment gateways','Enhance the payment management system']::text[],false),
 ('K11',11,'First attempt resolution rate for complaints','percent','latest','manual',(select id from objectives where year=2026 and n=5),array['Improve customer support team performance','Enhance complaint resolution procedures','Reduce resolution time on first contact']::text[],false),
 ('K12',12,'Departments with implemented quality standards','percent','latest','manual',(select id from objectives where year=2026 and n=10),array['Develop and implement quality standards framework','Improve internal operational procedures','Ensure departmental compliance with quality standards']::text[],false),
 ('K13',13,'Internal operational improvement rate','percent','latest','manual',(select id from objectives where year=2026 and n=5),array['Enhance operational efficiency','Implement internal process improvement initiatives','Automate operational workflows']::text[],false),
 ('K14',14,'Number of countries offering chauffeur service','count','sum','manual',(select id from objectives where year=2026 and n=7),array['Expand chauffeur service to additional countries','Increase geographical service coverage','Add service through local transportation partners']::text[],false),
 ('K15',15,'Number of B2B deal contracts','count','sum','manual',(select id from objectives where year=2026 and n=1),array['Strengthen engagement with target companies','Sign new corporate partnership agreements','Activate corporate client management systems']::text[],false),
 ('K16',16,'Tenders awarded value','SAR','sum','manual',(select id from objectives where year=2026 and n=2),array['Improve competitiveness of tender proposals','Analyze competitors in tender processes','Increase success rate in tender awards']::text[],false),
 ('K17',17,'Number of Commercial employees','count','sum','manual',(select id from objectives where year=2026 and n=1),array['Recruit qualified sales professionals','Strengthen departmental workforce structure','Clarify roles and responsibilities within the team']::text[],false),
 ('K18',18,'Number of sales channels/platforms for our products','count','sum','manual',(select id from objectives where year=2026 and n=1),array['Launch new digital sales platforms','Expand online distribution channels','Increase product availability across platforms']::text[],false),
 ('K19',19,'Commercial Total Revenue','SAR','sum','finance_revenue',(select id from objectives where year=2026 and n=1),array['Expand commercial partnerships','Increase participation in tenders','Develop new services and products']::text[],false),
 ('K20',20,'Government entity corporate contracts signed','count','sum','manual',(select id from objectives where year=2026 and n=1),array['Engage with government entities','Submit proposals for government contracts','Strengthen government relations']::text[],false),
 ('K21',21,'Corporate client satisfaction score','score','latest','manual',(select id from objectives where year=2026 and n=5),array['Enhance corporate client experience','Conduct regular satisfaction surveys','Implement feedback-driven improvements']::text[],false),
 ('K22',22,'Products with approved pricing structure','percent','latest','manual',(select id from objectives where year=2026 and n=11),array['Review and standardize product pricing','Align pricing with market benchmarks','Obtain management approval on pricing']::text[],false),
 ('K23',23,'Number of luxury travel service','count','sum','manual',(select id from objectives where year=2026 and n=14),array['Develop luxury travel offerings','Partner with premium service providers','Market luxury services to target segments']::text[],false),
 ('K24',24,'Number of qualified B2B leads generated from events','count','sum','manual',(select id from objectives where year=2026 and n=12),array['Participate in key B2B events','Capture and qualify leads at events','Follow up on event-generated leads']::text[],false),
 ('K25',25,'Departments actively using the commercial Tool','percent','latest','manual',(select id from objectives where year=2026 and n=13),array['Roll out commercial tool across departments','Train departments on tool usage','Monitor adoption and usage rates']::text[],false),
 ('K26',26,'Airlines with active agreements (IATA/platform)','count','sum','manual',(select id from objectives where year=2026 and n=6),array['Tracked quarterly since 2023 (9 then, 82 by Q4 2025)','Draft target - confirm with Ahmed']::text[],true),
 ('K27',27,'External biometric passports processed','count','sum','manual',(select id from objectives where year=2026 and n=7),array['Tracked quarterly in 2024-2025 dept reports','Draft target - confirm with Ahmed']::text[],true),
 ('K28',28,'New partnerships signed','count','sum','manual',(select id from objectives where year=2026 and n=6),array['Q4 2025 reported 3 new partnerships','Draft target - confirm with Ahmed']::text[],true),
 ('K29',29,'Exhibitions and conferences participated','count','sum','manual',(select id from objectives where year=2026 and n=12),array['Q4 2025 reported 3 participations','Draft target - confirm with Ahmed']::text[],true),
 ('K30',30,'Tenders awarded (count)','count','sum','manual',(select id from objectives where year=2026 and n=2),array['Q4 2025: 4 tenders won + completion certificates','KPI 16 tracks value; this tracks the count','Draft target - confirm with Ahmed']::text[],true);
-- the 2026 company targets, as set on the Reports page
insert into kpi_targets(kpi_id,scope,period_id,target_value)
select k.id,'company',(select id from periods where kind='year' and year=2026),v.t from (values
 (1,20),
 (2,60),
 (3,50),
 (4,33),
 (5,5000),
 (6,93),
 (7,13),
 (8,20000000),
 (9,4),
 (10,12),
 (11,97),
 (12,95),
 (13,20),
 (14,50),
 (15,80),
 (16,5000000),
 (17,50),
 (18,8),
 (19,6000000),
 (20,5),
 (21,4.5),
 (22,15),
 (23,7),
 (24,50),
 (25,7),
 (26,100),
 (27,400),
 (28,12),
 (29,8),
 (30,10)) v(n,t) join kpi_definitions k on k.n=v.n;
