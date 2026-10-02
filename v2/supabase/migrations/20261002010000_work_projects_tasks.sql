-- P5-1 · Projects and tasks, the core (TECH-SPEC §3.7; V400, V401, V438, V456, V464, V465, V466, V491, V506). Projects
-- with their health; tasks on the four locked status meanings, Blocked inside In progress with its reason; task types;
-- helpers; action items as the task's checklist; Direct references and contacts; the status history; the dates rule
-- on every entry; past work (owner Unknown, no notices, no flags); the doors to create, change, assign, block, close
-- and remove, and the reads My work, the task list with its filters, one task, one project. Templates, recurring
-- generation, team load, Escalate, next-step and follow-up tasks, the measures and the Past work grid's door follow in
-- the next step's PRs. V189–V195. Every function the Data API reaches is a security-invoker wrapper (V124).
-- Forward-only (V103).

-- ================================================================ the lists (§3.7)
-- Each a settings list (V76): key, both names, sort, active; archived or removed only while unused. A task status
-- carries one of four locked meanings (V401) — its names editable, its meaning never; a project status a category.
create table work.project_status (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  sort int not null default 0, active boolean not null default true,
  category text not null check (category in ('planned', 'active', 'on_hold', 'done', 'cancelled')),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create table work.task_status (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  sort int not null default 0, active boolean not null default true,
  meaning text not null check (meaning in ('not_started', 'in_progress', 'done', 'cancelled')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index task_status_one_per_meaning on work.task_status (meaning) where deleted_at is null;
create unique index task_status_one_default on work.task_status (is_default) where is_default and deleted_at is null;
create table work.task_type (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null check (pg_catalog.btrim(name_en) <> ''), name_ar text not null check (pg_catalog.btrim(name_ar) <> ''),
  sort int not null default 0, active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
comment on table work.task_status is 'Task statuses on four locked meanings (V401): Not started · In progress · Done · Cancelled.';
comment on table work.task_type is 'A task''s category (V438), a settings list with a default per template.';
comment on table work.project_status is 'Project statuses, each in a category: planned, active, on hold, done, cancelled.';

-- ================================================================ projects (§3.7)
create table work.project (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  name text not null check (pg_catalog.btrim(name) <> '' and pg_catalog.length(name) <= 200),
  description text check (description is null or pg_catalog.length(description) <= 20000),
  work_type text not null default 'client' check (work_type in ('client', 'internal')),
  partner_id uuid references partner.partner (id),
  owner_id uuid not null references core.person (id),
  department_id uuid not null references core.department (id),
  status_id uuid not null references work.project_status (id),
  start_on date,
  due_on date,
  closed_at timestamptz,
  segment_id uuid references partner.side_type (id),                   -- V64: an override (a Client side type); null = the partner's
  happened_on date not null default core.riyadh_today(),
  logged_at timestamptz not null default core.clock(),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint project_client_has_partner check ((work_type = 'client') = (partner_id is not null)),
  constraint project_due_after_start check (due_on is null or start_on is null or due_on >= start_on),
  constraint project_not_after_logged check (happened_on <= core.riyadh_day(logged_at))
);
comment on table work.project is
  'A project (§3.7): client work on one organisation, or internal work on none (V466); its health is work.project_health.';

-- The health chip and its one-line update (V401): the latest row is the project's.
create table work.project_health (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references work.project (id),
  health text not null check (health in ('on_track', 'at_risk', 'off_track')),
  line text not null check (pg_catalog.btrim(line) <> '' and pg_catalog.length(line) <= 300),
  happened_on date not null default core.riyadh_today(),
  logged_at timestamptz not null default core.clock(),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint project_health_not_after_logged check (happened_on <= core.riyadh_day(logged_at))
);
create index project_health_latest on work.project_health (project_id, happened_on desc, logged_at desc)
  where deleted_at is null;

-- ================================================================ tasks (§3.7)
create table work.task (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  title text not null check (pg_catalog.btrim(title) <> '' and pg_catalog.length(title) <= 300),
  notes text check (notes is null or pg_catalog.length(notes) <= 20000),
  owner_id uuid references core.person (id),                            -- null = Unknown: past work only (V491)
  team_id uuid not null references core.team (id),
  department_id uuid not null references core.department (id),
  priority_id uuid references work.priority (id),
  status_id uuid not null references work.task_status (id),
  type_id uuid references work.task_type (id),
  work_type text not null default 'client' check (work_type in ('client', 'internal')),
  start_on date,
  due_on date,
  partner_id uuid references partner.partner (id),
  project_id uuid references work.project (id),
  origin text not null default 'manual'
    check (origin in ('manual', 'template', 'period_target', 'meeting', 'next_step', 'alert', 'backfill')),
  assigned_by uuid references core.person (id),
  closed_at timestamptz,
  closed_by uuid references core.person (id),
  blocked_reason text check (blocked_reason is null or (pg_catalog.btrim(blocked_reason) <> ''
                                                        and pg_catalog.length(blocked_reason) <= 500)),
  blocked_on date,
  happened_on date not null default core.riyadh_today(),
  logged_at timestamptz not null default core.clock(),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint task_client_work check (work_type = 'internal' or partner_id is not null or project_id is not null),
  constraint task_internal_no_partner check (work_type = 'client' or partner_id is null),
  constraint task_due_after_start check (due_on is null or start_on is null or due_on >= start_on),
  constraint task_not_after_logged check (happened_on <= core.riyadh_day(logged_at)),
  constraint task_blocked_has_reason check ((blocked_reason is null) = (blocked_on is null))
);
create index task_owner_open on work.task (owner_id, due_on) where deleted_at is null and closed_at is null;
create index task_department on work.task (department_id, happened_on desc) where deleted_at is null;
comment on table work.task is
  'A task (§3.7) under the dates rule (V400): owner Unknown only on past work (V491); action items are its checklist (V438).';

-- Helpers on a task: they add notes and tick the action items they own or help on.
create table work.task_helper (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references work.task (id),
  person_id uuid not null references core.person (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index task_helper_live on work.task_helper (task_id, person_id) where deleted_at is null;

-- The task's checklist (V438): each item its owner, its due day and its completion day (V400).
create table work.action_item (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references work.task (id),
  text text not null check (pg_catalog.btrim(text) <> '' and pg_catalog.length(text) <= 500),
  owner_id uuid not null references core.person (id),
  due_on date,
  done_on date,
  done_by uuid references core.person (id),
  sort int not null default 0,
  source_note_id uuid references core.note (id),
  happened_on date not null default core.riyadh_today(),
  logged_at timestamptz not null default core.clock(),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint action_item_done_together check ((done_on is null) = (done_by is null)),
  constraint action_item_not_after_logged check (happened_on <= core.riyadh_day(logged_at)),
  constraint action_item_done_after check (done_on is null or done_on >= happened_on)
);
create index action_item_task on work.action_item (task_id, sort) where deleted_at is null;
create index action_item_owner_open on work.action_item (owner_id) where deleted_at is null and done_on is null;

create table work.action_item_helper (
  id uuid primary key default gen_random_uuid(),
  action_item_id uuid not null references work.action_item (id),
  person_id uuid not null references core.person (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index action_item_helper_live on work.action_item_helper (action_item_id, person_id) where deleted_at is null;

-- A Direct system reference on a task (booking, invoice, ticket): its URL comes from the system's pattern.
create table work.task_ref (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references work.task (id),
  system_id uuid not null references work.ref_system (id),
  value text not null check (pg_catalog.btrim(value) <> '' and pg_catalog.length(value) <= 200),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index task_ref_live on work.task_ref (task_id, system_id, value) where deleted_at is null;

-- A contact of the task's organisation (V466).
create table work.task_contact (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references work.task (id),
  contact_id uuid not null references partner.contact (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index task_contact_live on work.task_contact (task_id, contact_id) where deleted_at is null;

-- Every status change with the day it happened (V400): the Done change's day is the completion date; blocking needs a
-- reason (V401).
create table work.task_status_change (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references work.task (id),
  from_status_id uuid references work.task_status (id),
  to_status_id uuid not null references work.task_status (id),
  blocked boolean not null default false,
  reason text check (reason is null or pg_catalog.length(reason) <= 500),
  happened_on date not null default core.riyadh_today(),
  logged_at timestamptz not null default core.clock(),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint task_status_change_not_after_logged check (happened_on <= core.riyadh_day(logged_at)),
  constraint task_status_change_blocked_reason check (not blocked or pg_catalog.btrim(coalesce(reason, '')) <> '')
);
create index task_status_change_task on work.task_status_change (task_id, happened_on desc) where deleted_at is null;

do $$
declare
  t text;
begin
  foreach t in array array['work.project_status', 'work.task_status', 'work.task_type', 'work.project',
                           'work.project_health', 'work.task', 'work.task_helper', 'work.action_item',
                           'work.action_item_helper', 'work.task_ref', 'work.task_contact', 'work.task_status_change'] loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;
select core.index_foreign_keys('work');

-- ================================================================ the seeds (§3.7; V401)
select audit.begin('system', 'list.seeded');
insert into work.task_status (key, name_en, name_ar, sort, meaning, is_default) values
  ('not_started', 'Not started', 'لم تبدأ', 10, 'not_started', true),
  ('in_progress', 'In progress', 'قيد التنفيذ', 20, 'in_progress', false),
  ('done', 'Done', 'منجزة', 30, 'done', false),
  ('cancelled', 'Cancelled', 'ملغاة', 40, 'cancelled', false);
insert into work.project_status (key, name_en, name_ar, sort, category) values
  ('planned', 'Planned', 'مخطط', 10, 'planned'),
  ('active', 'Active', 'نشط', 20, 'active'),
  ('on_hold', 'On hold', 'معلّق', 30, 'on_hold'),
  ('done', 'Done', 'منجز', 40, 'done'),
  ('cancelled', 'Cancelled', 'ملغى', 50, 'cancelled');
insert into work.task_type (key, name_en, name_ar, sort) values
  ('follow_up', 'Follow-up', 'متابعة', 10),
  ('meeting', 'Meeting', 'اجتماع', 20),
  ('request', 'Request', 'طلب', 30),
  ('report', 'Report', 'تقرير', 40),
  ('other', 'Other', 'أخرى', 90);
select audit.end();

-- ================================================================ who may be named (V465)
-- An owner, a helper or an item's owner can work here: staff, switched on, allowed to sign in, not removed, not past
-- the day they left — and a team member: never the owner's admin account (his work is on his employee account, V444)
-- nor the test account (V445) (QA-214).
create function work.person_ok(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select core.person_available(p_person) and core.is_team_member(p_person) $$;
create function work.require_person(p_person uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_person is not null and not work.person_ok(p_person) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p_person::text;
  end if;
end
$$;

-- ================================================================ past work (V491, V506)
-- Work dated before the go-live day, and every backfilled entry, is past work: no notices, no overdue or stale flag,
-- never on My day; its owner may be Unknown.
create function work.is_past(p_on date) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(p_on < nullif(core.setting_at('app.go_live_on', null, core.riyadh_today()) #>> '{}', '')::date, false)
$$;
create function work.task_is_past(t work.task) returns boolean
language sql stable security definer set search_path = ''
as $$ select t.origin = 'backfill' or work.is_past(t.happened_on) $$;

-- A change to past work tells nobody (V491): the open request is dated on the work's own day — never later than
-- yesterday — and a past-dated request raises no notice (V400). Only when every task it touches is past work.
create function work.quiet_if_past(p_tasks uuid[]) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  d date;
begin
  if not exists (select 1 from work.task t where t.id = any (p_tasks) and not work.task_is_past(t)) then
    select pg_catalog.min(t.happened_on) into d from work.task t where t.id = any (p_tasks);
    if d is not null then
      perform audit.happened(least(d, core.riyadh_today() - 1));
    end if;
  end if;
end
$$;

-- ================================================================ who sees and who changes (§5; V96)
-- The whole team sees every task and project of its departments (V96): a person's level on one is their level on the
-- Tasks or Projects page while it belongs to one of their departments — their own, or one an admin lets them see.
create function work.sees_department(p_person uuid, p_department uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select coalesce(r.is_admin, false) or p.department_id = p_department
           or exists (select 1 from core.person_department pd
                      where pd.person_id = p.id and pd.department_id = p_department and pd.deleted_at is null)
    from core.person p left join core.role r on r.id = p.role_id
    where p.id = p_person), false)
$$;

-- The task or project a work row belongs to.
create function work.row_of(p_table text, p_id uuid, out task_id uuid, out project_id uuid, out department_id uuid)
language plpgsql stable security definer set search_path = ''
as $$
begin
  case p_table
    when 'work.task' then task_id := p_id;
    when 'work.task_helper' then select x.task_id into task_id from work.task_helper x where x.id = p_id;
    when 'work.action_item' then select x.task_id into task_id from work.action_item x where x.id = p_id;
    when 'work.action_item_helper' then
      select a.task_id into task_id from work.action_item_helper x join work.action_item a on a.id = x.action_item_id
      where x.id = p_id;
    when 'work.task_ref' then select x.task_id into task_id from work.task_ref x where x.id = p_id;
    when 'work.task_contact' then select x.task_id into task_id from work.task_contact x where x.id = p_id;
    when 'work.task_status_change' then select x.task_id into task_id from work.task_status_change x where x.id = p_id;
    when 'work.project' then project_id := p_id;
    when 'work.project_health' then select x.project_id into project_id from work.project_health x where x.id = p_id;
    else null;
  end case;
  department_id := coalesce((select x.department_id from work.task x where x.id = task_id),
                            (select x.department_id from work.project x where x.id = project_id));
end
$$;

-- The record types' level function (core.entity.level): the page's level, in the person's departments.
create function work.row_level(p_table text, p_id uuid, p_person uuid) returns core.level
language plpgsql stable security definer set search_path = ''
as $$
declare
  o record;
begin
  select * into o from work.row_of(p_table, p_id);
  if o.department_id is null or not work.sees_department(p_person, o.department_id) then
    return 'none';
  end if;
  return authz.level_of(p_person, case when o.project_id is not null then 'projects' else 'tasks' end);
end
$$;

-- A task's own people (§5): its owner and creator, and its helpers — told when someone else changes it.
create function work.task_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select t.owner_id from work.task t where t.id = p_id and t.owner_id is not null
  union select t.created_by from work.task t where t.id = p_id
  union select h.person_id from work.task_helper h where h.task_id = p_id and h.deleted_at is null
$$;
create function work.action_item_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select a.owner_id from work.action_item a where a.id = p_id
  union select h.person_id from work.action_item_helper h where h.action_item_id = p_id and h.deleted_at is null
$$;
create function work.owners_via_task(p_table text, p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select o from work.task_owners((work.row_of(p_table, p_id)).task_id) o $$;
create function work.task_helper_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select work.owners_via_task('work.task_helper', p_id) $$;
create function work.action_item_helper_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select work.action_item_owners((select x.action_item_id from work.action_item_helper x where x.id = p_id)) $$;
create function work.task_ref_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select work.owners_via_task('work.task_ref', p_id) $$;
create function work.task_contact_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$ select work.owners_via_task('work.task_contact', p_id) $$;
create function work.task_status_change_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select work.owners_via_task('work.task_status_change', p_id) $$;
create function work.project_health_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$ select p.owner_id from work.project_health h join work.project p on p.id = h.project_id where h.id = p_id $$;

-- Who may change a task's own fields, status and checklist: Full on Tasks, or Own and its owner or creator. A helper
-- adds notes (core.note_add) and ticks the items they own or help on.
create function work.can_edit_task(p_person uuid, t work.task) returns boolean
language sql stable security definer set search_path = ''
as $$
  select case work.row_level('work.task', t.id, p_person)
           when 'full' then true
           when 'own' then p_person = t.owner_id or p_person = t.created_by
           else false end
$$;
create function work.task_editable(p_id uuid) returns work.task
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into t from work.task where id = p_id and deleted_at is null;
  if t.id is null or work.row_level('work.task', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not work.can_edit_task(me, t) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'tasks', 'level', 'own')::text;
  end if;
  return t;
end
$$;

-- ================================================================ the rules every write meets (V464, V465, V466)
-- A task's organisation is its project's, and its work type too; a contact belongs to its organisation; every person it
-- names can work here; the owner is Unknown only on past work; its department is its team's.
create function work.task_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  p work.project;
begin
  if new.project_id is not null and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id
                                     or new.partner_id is distinct from old.partner_id
                                     or new.work_type is distinct from old.work_type) then
    select * into p from work.project where id = new.project_id;
    if p.id is null or p.deleted_at is not null then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.project';
    end if;
    if new.work_type <> p.work_type then
      raise exception using errcode = 'P0001', message = 'task.work_type_not_projects';
    end if;
    if new.partner_id is distinct from p.partner_id then
      raise exception using errcode = 'P0001', message = 'task.partner_not_projects';
    end if;
  end if;
  if tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id then
    if new.owner_id is null and not work.task_is_past(new) then
      raise exception using errcode = 'P0001', message = 'task.owner_required';
    end if;
    perform work.require_person(new.owner_id);
  end if;
  if tg_op = 'INSERT' or new.team_id is distinct from old.team_id then
    select t.department_id into new.department_id from core.team t where t.id = new.team_id and t.active;
    if new.department_id is null then
      raise exception using errcode = 'P0001', message = 'task.team_inactive';
    end if;
  end if;
  return new;
end
$$;
create trigger guard before insert or update on work.task for each row execute function work.task_guard();

create function work.project_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.partner_id is distinct from old.partner_id
     and exists (select 1 from work.task t where t.project_id = new.id and t.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'project.partner_fixed';   -- OLD-018: never moved
  end if;
  if tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id then
    perform work.require_person(new.owner_id);
  end if;
  return new;
end
$$;
create trigger guard before insert or update on work.project for each row execute function work.project_guard();

create function work.person_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  p uuid := (pg_catalog.to_jsonb(new) ->> case tg_table_name when 'action_item' then 'owner_id' else 'person_id' end)::uuid;
  o uuid := case when tg_op = 'UPDATE'
                 then (pg_catalog.to_jsonb(old) ->> case tg_table_name when 'action_item' then 'owner_id' else 'person_id' end)::uuid
            end;
begin
  if (tg_op = 'INSERT' or p is distinct from o) and new.deleted_at is null then
    perform work.require_person(p);
  end if;
  return new;
end
$$;
create trigger person before insert or update on work.task_helper for each row execute function work.person_guard();
create trigger person before insert or update on work.action_item for each row execute function work.person_guard();
create trigger person before insert or update on work.action_item_helper for each row execute function work.person_guard();

create function work.task_contact_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from partner.contact c join work.task t on t.partner_id = c.partner_id
                 where c.id = new.contact_id and t.id = new.task_id and c.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'task.contact_not_partners';
  end if;
  return new;
end
$$;
create trigger guard before insert or update of contact_id, task_id on work.task_contact
  for each row execute function work.task_contact_guard();

create function work.task_refused(p_constraint text) returns text
language sql immutable set search_path = ''
as $$
  select case p_constraint
    when 'task_title_check' then 'task.title_required'
    when 'task_notes_check' then 'task.notes_too_long'
    when 'task_client_work' then 'task.client_work_needs_partner'
    when 'task_internal_no_partner' then 'task.internal_has_no_partner'
    when 'task_due_after_start' then 'task.due_before_start'
    when 'task_not_after_logged' then 'common.date_in_future'
    when 'task_blocked_has_reason' then 'task.blocked_needs_reason'
    when 'task_blocked_reason_check' then 'task.blocked_needs_reason'
    when 'project_name_check' then 'project.name_required'
    when 'project_client_has_partner' then 'project.client_needs_partner'
    when 'project_due_after_start' then 'project.due_before_start'
    when 'project_not_after_logged' then 'common.date_in_future'
    when 'action_item_text_check' then 'action_item.text_required'
    when 'action_item_done_after' then 'action_item.done_before_raised'
    when 'action_item_not_after_logged' then 'common.date_in_future'
    when 'project_health_line_check' then 'project.health_line_required'
    when 'task_status_change_blocked_reason' then 'task.blocked_needs_reason'
    when 'task_ref_value_check' then 'task.ref_value_required'
    else 'common.invalid' end
$$;

-- An "assigned" or "helper added" notice reaches the person even when the work is dated in the past (V456) — but past
-- work sends none (V491), and nobody is told of their own act or of a record they may not see.
create function notify.push_assigned(p_person uuid, p_kind text, p_table text, p_id uuid, p_label_args jsonb default null)
  returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r uuid := nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid;
  q audit.request;
begin
  select * into q from audit.request where id = r;
  if p_person is null or q.id is null or p_person = q.actor_id or not notify.may_notify(p_person, p_kind)
     or not authz.can_see_as(p_person, p_table, p_id) then
    return false;
  end if;
  insert into notify.notification (person_id, kind, entity_table, entity_id, request_id, actor_id, label_key, label_args)
  values (p_person, p_kind, p_table, p_id, r, q.actor_id, 'notify.' || p_kind, p_label_args);
  return true;
end
$$;

-- ================================================================ lookups by key or id
create function work.status_of(p text) returns work.task_status
language sql stable security definer set search_path = ''
as $$
  select s from work.task_status s
  where (s.key = p or s.id::text = p) and s.active and s.deleted_at is null
$$;
create function work.list_id(p_table text, p text) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  r uuid;
begin
  if p is null or p = '' then
    return null;
  end if;
  execute pg_catalog.format('select t.id from %s t where (t.key = $1 or t.id::text = $1) and t.active and t.deleted_at is null',
                            pg_catalog.to_regclass(p_table))
    into r using p;
  if r is null then
    raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = p_table || ':' || p;
  end if;
  return r;
end
$$;

-- A project's segment (V64): a type of the Client side, by id.
create function work.segment_of(p text) returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  r uuid;
begin
  if p is null or p = '' then
    return null;
  end if;
  select t.id into r from partner.side_type t
  where t.id::text = p and t.side = 'client' and t.active and t.deleted_at is null;
  if r is null then
    raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = 'partner.side_type:' || p;
  end if;
  return r;
end
$$;

-- ================================================================ projects: create, change, health, remove
create function work.project_save(p_id uuid, p_values jsonb, p_version int default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  p work.project;
  pid uuid;
  req uuid;
  what text;
  dept uuid;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if pg_catalog.jsonb_typeof(v) <> 'object' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('name', 'description', 'work_type', 'partner_id', 'owner_id', 'status', 'start_on', 'due_on',
                 'segment_id', 'happened_on') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if nullif(v ->> 'partner_id', '') is not null
     and not authz.can_see_as(me, 'partner.partner', (v ->> 'partner_id')::uuid) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
  if p_id is null then
    perform authz.require('projects', 'own');
    if nullif(v ->> 'owner_id', '') is not null and (v ->> 'owner_id')::uuid <> me and not authz.can('tasks.assign') then
      raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
    end if;
    select x.department_id into dept from core.person x
    where x.id = coalesce(nullif(v ->> 'owner_id', '')::uuid, me);
    if dept is null then
      raise exception using errcode = 'P0001', message = 'project.owner_has_no_department';
    end if;
    req := audit.begin('ui', 'project.created', null);
    perform audit.happened(nullif(v ->> 'happened_on', '')::date);
    begin
      insert into work.project (number, name, description, work_type, partner_id, owner_id, department_id, status_id,
                                start_on, due_on, segment_id, happened_on)
      values (core.format_number('PRJ', pg_catalog.date_part('year', core.riyadh_today())::int,
                                 core.next_number('project', pg_catalog.date_part('year', core.riyadh_today())::int), 3),
              pg_catalog.btrim(v ->> 'name'), nullif(pg_catalog.btrim(v ->> 'description'), ''),
              coalesce(nullif(v ->> 'work_type', ''), 'client'), nullif(v ->> 'partner_id', '')::uuid,
              coalesce(nullif(v ->> 'owner_id', '')::uuid, me), dept,
              coalesce(work.list_id('work.project_status', v ->> 'status'), work.list_id('work.project_status', 'active')),
              nullif(v ->> 'start_on', '')::date, nullif(v ->> 'due_on', '')::date,
              work.segment_of(v ->> 'segment_id'),
              coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today()))
      returning id into pid;
    exception when check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = work.task_refused(what);
    end;
  else
    select * into p from work.project where id = p_id and deleted_at is null;
    if p.id is null or work.row_level('work.project', p_id, me) < 'view' then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if not (work.row_level('work.project', p_id, me) = 'full'
            or (work.row_level('work.project', p_id, me) = 'own' and me in (p.owner_id, p.created_by))) then
      raise exception using errcode = '42501', message = 'access.needs_level',
        detail = pg_catalog.jsonb_build_object('page', 'projects', 'level', 'own')::text;
    end if;
    if v ? 'owner_id' and (v ->> 'owner_id')::uuid is distinct from p.owner_id and not authz.can('tasks.assign') then
      raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
    end if;
    perform core.check_version('work.project', p_id, p_version, array(select pg_catalog.jsonb_object_keys(v)));
    req := audit.begin('ui', 'project.changed', null);
    begin
      update work.project set
        name = case when v ? 'name' then pg_catalog.btrim(v ->> 'name') else name end,
        description = case when v ? 'description' then nullif(pg_catalog.btrim(v ->> 'description'), '') else description end,
        work_type = case when v ? 'work_type' then coalesce(nullif(v ->> 'work_type', ''), work_type) else work_type end,
        partner_id = case when v ? 'partner_id' then nullif(v ->> 'partner_id', '')::uuid else partner_id end,
        owner_id = case when v ? 'owner_id' then coalesce(nullif(v ->> 'owner_id', '')::uuid, owner_id) else owner_id end,
        status_id = case when v ? 'status' then work.list_id('work.project_status', v ->> 'status') else status_id end,
        start_on = case when v ? 'start_on' then nullif(v ->> 'start_on', '')::date else start_on end,
        due_on = case when v ? 'due_on' then nullif(v ->> 'due_on', '')::date else due_on end,
        segment_id = case when v ? 'segment_id' then work.segment_of(v ->> 'segment_id') else segment_id end,
        happened_on = case when v ? 'happened_on' then coalesce(nullif(v ->> 'happened_on', '')::date, happened_on)
                           else happened_on end
      where id = p_id;
      update work.project x set closed_at = case when s.category in ('done', 'cancelled')
                                                 then coalesce(x.closed_at, core.clock()) end
      from work.project_status s where s.id = x.status_id and x.id = p_id;
    exception when check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = work.task_refused(what);
    end;
    pid := p_id;
  end if;
  if p_id is null or (v ? 'owner_id' and (v ->> 'owner_id')::uuid is distinct from p.owner_id) then
    perform notify.push_assigned((select x.owner_id from work.project x where x.id = pid), 'assigned', 'work.project', pid,
                                 pg_catalog.jsonb_build_object('what', 'project'));
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'request_id', req,
    'number', (select x.number from work.project x where x.id = pid),
    'version', (select x.version from work.project x where x.id = pid));
end
$$;

-- The health chip and its one-line update (V401): the project's owner or Full on Projects.
create function work.project_health_set(p_project uuid, p_health text, p_line text, p_happened_on date default null)
  returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  p work.project;
  hid uuid;
  req uuid;
  what text;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into p from work.project where id = p_project and deleted_at is null;
  if p.id is null or work.row_level('work.project', p_project, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if not (work.row_level('work.project', p_project, me) = 'full'
          or (work.row_level('work.project', p_project, me) = 'own' and me = p.owner_id)) then
    raise exception using errcode = '42501', message = 'access.needs_level',
      detail = pg_catalog.jsonb_build_object('page', 'projects', 'level', 'own')::text;
  end if;
  req := audit.begin('ui', 'project.health_set', pg_catalog.jsonb_build_object('health', p_health));
  perform audit.happened(p_happened_on);
  begin
    insert into work.project_health (project_id, health, line, happened_on)
    values (p_project, p_health, pg_catalog.btrim(p_line), coalesce(p_happened_on, core.riyadh_today()))
    returning id into hid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001',
      message = case when what = 'project_health_health_check' then 'project.health_invalid' else work.task_refused(what) end;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', hid, 'request_id', req);
end
$$;

-- A project with live tasks stays (its tasks would lose their place); one without is removed, and Undo brings it back.
create function work.projects_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  i uuid;
  p work.project;
  req uuid;
  k int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  foreach i in array p_ids loop
    select * into p from work.project where id = i and deleted_at is null;
    if p.id is null or work.row_level('work.project', i, me) < 'view' then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if not (work.row_level('work.project', i, me) = 'full'
            or (work.row_level('work.project', i, me) = 'own' and me in (p.owner_id, p.created_by))) then
      raise exception using errcode = '42501', message = 'access.needs_level',
        detail = pg_catalog.jsonb_build_object('page', 'projects', 'level', 'own')::text;
    end if;
    if exists (select 1 from work.task t where t.project_id = i and t.deleted_at is null) then
      raise exception using errcode = 'P0001', message = 'project.has_tasks', detail = p.number;
    end if;
  end loop;
  req := audit.begin('ui', 'project.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update work.project set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- ================================================================ tasks: create, change, assign, helpers
-- V464: the owner named, else the project's owner, else the organisation's account manager (while active), else the
-- creator. The team: the one named, else the owner's home team, else the creator's.
create function work.default_owner(p_named uuid, p_project uuid, p_partner uuid, p_me uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    p_named,
    (select p.owner_id from work.project p where p.id = p_project and work.person_ok(p.owner_id)),
    (select o.person_id from partner.side_owners(p_partner, 'client') o(person_id) where work.person_ok(o.person_id) limit 1),
    p_me)
$$;

create function work.task_create(p_values jsonb, p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'own');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  owner uuid;
  named uuid := nullif(v ->> 'owner_id', '')::uuid;
  pid uuid := nullif(v ->> 'partner_id', '')::uuid;
  prj uuid := nullif(v ->> 'project_id', '')::uuid;
  team uuid;
  day date := coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today());
  origin text := coalesce(nullif(v ->> 'origin', ''), 'manual');
  past boolean;
  tid uuid;
  req uuid;
  what text;
  h uuid;
begin
  if pg_catalog.jsonb_typeof(v) <> 'object' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('title', 'notes', 'owner_id', 'owner_unknown', 'team_id', 'priority', 'status', 'type', 'work_type',
                 'start_on', 'due_on', 'partner_id', 'project_id', 'happened_on', 'helper_ids', 'origin') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if origin not in ('manual', 'meeting') then
    raise exception using errcode = 'P0001', message = 'task.origin_invalid', detail = origin;
  end if;
  if pid is not null and not authz.can_see_as(me, 'partner.partner', pid) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
  if prj is not null then
    if work.row_level('work.project', prj, me) < 'view' then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.project';
    end if;
    pid := coalesce(pid, (select p.partner_id from work.project p where p.id = prj));
  end if;
  past := work.is_past(day);
  if coalesce((v ->> 'owner_unknown')::boolean, false) then
    if not past then
      raise exception using errcode = 'P0001', message = 'task.owner_required';
    end if;
    owner := null;
  else
    owner := work.default_owner(named, prj, pid, me);
  end if;
  if owner is distinct from me and (named is not null or owner is null) and not authz.can('tasks.assign') then
    raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
  end if;
  team := coalesce(nullif(v ->> 'team_id', '')::uuid,
                   (select p.team_id from core.person p where p.id = owner),
                   (select p.team_id from core.person p where p.id = me));
  if team is null then
    raise exception using errcode = 'P0001', message = 'task.team_required';
  end if;
  req := audit.begin('ui', 'task.created', null);
  perform audit.happened(nullif(v ->> 'happened_on', '')::date);
  begin
    insert into work.task (number, title, notes, owner_id, team_id, department_id, priority_id, status_id, type_id,
                           work_type, start_on, due_on, partner_id, project_id, origin, assigned_by, happened_on)
    -- V531: numbered in the year it happened, so a 2025 entry is TSK-2025-… and an annual report agrees with it
    values (core.format_number('TSK', pg_catalog.date_part('year', day)::int,
                               core.next_number('task', pg_catalog.date_part('year', day)::int)),
            pg_catalog.btrim(v ->> 'title'), nullif(pg_catalog.btrim(v ->> 'notes'), ''), owner, team,
            (select t.department_id from core.team t where t.id = team),
            work.list_id('work.priority', v ->> 'priority'),
            coalesce((work.status_of(nullif(v ->> 'status', ''))).id,
                     (select s.id from work.task_status s where s.is_default and s.deleted_at is null)),
            work.list_id('work.task_type', v ->> 'type'),
            coalesce(nullif(v ->> 'work_type', ''), case when pid is null and prj is null then 'internal' else 'client' end),
            nullif(v ->> 'start_on', '')::date, nullif(v ->> 'due_on', '')::date, pid, prj, origin,
            case when owner is distinct from me then me end, day)
    returning id into tid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  end;
  if (work.status_of(nullif(v ->> 'status', ''))).meaning in ('done', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'task.created_closed';
  end if;
  for h in select x::uuid from pg_catalog.jsonb_array_elements_text(coalesce(v -> 'helper_ids', '[]'::jsonb)) x loop
    insert into work.task_helper (task_id, person_id) values (tid, h);
    if not past then
      perform notify.push_assigned(h, 'helper_added', 'work.task', tid);
    end if;
  end loop;
  if not past then
    perform notify.push_assigned(owner, 'assigned', 'work.task', tid);
  end if;
  if p_mentions is not null and pg_catalog.cardinality(p_mentions) > 0 then
    perform core.note_add('task', tid, 'comment', coalesce(nullif(pg_catalog.btrim(v ->> 'notes'), ''),
                                                           pg_catalog.btrim(v ->> 'title')),
                          nullif(v ->> 'happened_on', '')::date, p_mentions);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', tid, 'request_id', req, 'owner_id', owner,
                                       'number', (select t.number from work.task t where t.id = tid));
end
$$;

-- Its owner, creator or Full changes a task's own fields; the owner through Assign, the status through its own door.
create function work.task_update(p_id uuid, p_values jsonb, p_version int) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t work.task := work.task_editable(p_id);
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  req uuid;
  what text;
begin
  if pg_catalog.jsonb_typeof(v) <> 'object' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('title', 'notes', 'team_id', 'priority', 'type', 'work_type', 'start_on', 'due_on', 'partner_id',
                 'project_id', 'happened_on') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if nullif(v ->> 'partner_id', '') is not null
     and not authz.can_see_as(authz.me(), 'partner.partner', (v ->> 'partner_id')::uuid) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
  if nullif(v ->> 'project_id', '') is not null
     and work.row_level('work.project', (v ->> 'project_id')::uuid, authz.me()) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.project';
  end if;
  perform core.check_version('work.task', p_id, p_version, array(select pg_catalog.jsonb_object_keys(v)));
  req := audit.begin('ui', 'task.changed', pg_catalog.jsonb_build_object('number', t.number));
  perform work.quiet_if_past(array[p_id]);
  begin
    update work.task set
      title = case when v ? 'title' then pg_catalog.btrim(v ->> 'title') else title end,
      notes = case when v ? 'notes' then nullif(pg_catalog.btrim(v ->> 'notes'), '') else notes end,
      team_id = case when v ? 'team_id' then coalesce(nullif(v ->> 'team_id', '')::uuid, team_id) else team_id end,
      priority_id = case when v ? 'priority' then work.list_id('work.priority', v ->> 'priority') else priority_id end,
      type_id = case when v ? 'type' then work.list_id('work.task_type', v ->> 'type') else type_id end,
      work_type = case when v ? 'work_type' then coalesce(nullif(v ->> 'work_type', ''), work_type) else work_type end,
      start_on = case when v ? 'start_on' then nullif(v ->> 'start_on', '')::date else start_on end,
      due_on = case when v ? 'due_on' then nullif(v ->> 'due_on', '')::date else due_on end,
      project_id = case when v ? 'project_id' then nullif(v ->> 'project_id', '')::uuid else project_id end,
      partner_id = case when v ? 'partner_id' then nullif(v ->> 'partner_id', '')::uuid
                        when v ? 'project_id' and nullif(v ->> 'project_id', '') is not null
                          then (select p.partner_id from work.project p where p.id = (v ->> 'project_id')::uuid)
                        else partner_id end,
      happened_on = case when v ? 'happened_on' then coalesce(nullif(v ->> 'happened_on', '')::date, happened_on)
                         else happened_on end
    where id = p_id;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req,
                                       'version', (select x.version from work.task x where x.id = p_id));
end
$$;

-- Assign: one request for every task chosen. Giving work to someone else needs the capability (§3.7); the task keeps
-- its team (OLD-014); the new owner is told — even of back-dated work, never of past work (V456, V491). Past work's
-- Unknown owner is given the same way (Needs an owner), and Undo restores Unknown.
create function work.tasks_assign(p_ids uuid[], p_owner uuid, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  i uuid;
  t work.task;
  req uuid;
  k int := 0;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if p_owner is null then
    raise exception using errcode = 'P0001', message = 'task.owner_required';
  end if;
  foreach i in array p_ids loop
    select * into t from work.task where id = i and deleted_at is null;
    if t.id is null or work.row_level('work.task', i, me) < 'view' then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if not (authz.can('tasks.assign') or (p_owner = me and work.can_edit_task(me, t) and t.owner_id is not null)) then
      raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
    end if;
  end loop;
  req := audit.begin('ui', 'task.assigned', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  perform work.quiet_if_past(p_ids);
  for t in select * from work.task x where x.id = any (p_ids) and x.owner_id is distinct from p_owner loop
    update work.task set owner_id = p_owner, assigned_by = case when p_owner <> me then me end where id = t.id;
    if not work.task_is_past(t) then
      perform notify.push_assigned(p_owner, 'assigned', 'work.task', t.id);
    end if;
    k := k + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- A task's helpers become exactly `p_people`: the dropped ones removed, each new one told (V456).
create function work.task_helpers_set(p_id uuid, p_people uuid[]) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t work.task := work.task_editable(p_id);
  who uuid;
  req uuid;
  k int := 0;
begin
  req := audit.begin('ui', 'task.helpers_set', pg_catalog.jsonb_build_object('number', t.number));
  perform work.quiet_if_past(array[p_id]);
  update work.task_helper set deleted_at = core.clock(), deleted_by = authz.me()
  where task_id = p_id and deleted_at is null and not (person_id = any (coalesce(p_people, '{}')));
  foreach who in array coalesce(p_people, '{}') loop
    continue when who is null or exists (select 1 from work.task_helper h
                                         where h.task_id = p_id and h.person_id = who and h.deleted_at is null);
    insert into work.task_helper (task_id, person_id) values (p_id, who);
    if not work.task_is_past(t) then
      perform notify.push_assigned(who, 'helper_added', 'work.task', p_id);
    end if;
    k := k + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('added', k, 'request_id', req);
end
$$;

-- ================================================================ status: block, resume, close, reopen (V401, V400)
-- One door for every move. Blocked is In progress with its reason. Done asks what to do with open action items: the
-- screen asks, then says close them too (they are done on the same day); a Done or Cancelled task records who closed it.
create function work.task_status_set(p_id uuid, p_status text, p_happened_on date default null, p_reason text default null,
                                     p_close_items boolean default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task := work.task_editable(p_id);
  s work.task_status := work.status_of(p_status);
  cur work.task_status;
  day date := coalesce(p_happened_on, core.riyadh_today());
  blocked boolean := nullif(pg_catalog.btrim(p_reason), '') is not null;
  open_items int;
  req uuid;
  what text;
begin
  if s.id is null then
    raise exception using errcode = 'P0002', message = 'list.unknown_value', detail = p_status;
  end if;
  select * into cur from work.task_status where id = t.status_id;
  if blocked and s.meaning <> 'in_progress' then
    raise exception using errcode = 'P0001', message = 'task.only_in_progress_blocks';
  end if;
  if day < t.happened_on then
    raise exception using errcode = 'P0001', message = 'task.status_before_raised';
  end if;
  select pg_catalog.count(*)::int into open_items from work.action_item a
  where a.task_id = p_id and a.deleted_at is null and a.done_on is null;
  if s.meaning = 'done' and open_items > 0 and not coalesce(p_close_items, false) then
    raise exception using errcode = 'P0001', message = 'task.open_action_items', detail = open_items::text;
  end if;
  if s.id = cur.id and blocked = (t.blocked_reason is not null) and not blocked then
    raise exception using errcode = 'P0001', message = 'task.status_unchanged';
  end if;
  req := audit.begin('ui', 'task.status_set', pg_catalog.jsonb_build_object('number', t.number, 'status', s.key,
                                                                             'blocked', blocked));
  perform audit.happened(p_happened_on);
  perform work.quiet_if_past(array[p_id]);
  begin
    insert into work.task_status_change (task_id, from_status_id, to_status_id, blocked, reason, happened_on)
    values (p_id, t.status_id, s.id, blocked, nullif(pg_catalog.btrim(p_reason), ''), day);
    if s.meaning = 'done' and open_items > 0 then
      update work.action_item set done_on = greatest(day, happened_on), done_by = me
      where task_id = p_id and deleted_at is null and done_on is null;
    end if;
    update work.task set
      status_id = s.id,
      blocked_reason = case when blocked then pg_catalog.btrim(p_reason) end,
      blocked_on = case when blocked then day end,
      closed_at = case when s.meaning in ('done', 'cancelled') then core.clock() end,
      closed_by = case when s.meaning in ('done', 'cancelled') then me end
    where id = p_id;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'status', s.key, 'meaning', s.meaning,
                                       'blocked', blocked, 'items_closed', case when s.meaning = 'done' then open_items else 0 end);
end
$$;

create function work.tasks_remove(p_ids uuid[], p_reason text default null) returns jsonb
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
  foreach i in array p_ids loop
    perform work.task_editable(i);
  end loop;
  req := audit.begin('ui', 'task.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  perform work.quiet_if_past(p_ids);
  update work.task set deleted_at = core.clock(), deleted_by = authz.me(), delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- ================================================================ action items (V438, V400)
-- The task's editors add and change items; an item's owner and helpers tick it, and so do the task's editors.
create function work.action_item_insert(t work.task, v jsonb, p_note uuid) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  aid uuid;
  owner uuid := coalesce(nullif(v ->> 'owner_id', '')::uuid, t.owner_id, authz.me());
  what text;
  h uuid;
begin
  begin
    insert into work.action_item (task_id, text, owner_id, due_on, sort, source_note_id, happened_on)
    values (t.id, pg_catalog.btrim(v ->> 'text'), owner, nullif(v ->> 'due_on', '')::date,
            coalesce((v ->> 'sort')::int, (select coalesce(pg_catalog.max(a.sort), 0) + 10 from work.action_item a
                                          where a.task_id = t.id)),
            p_note, coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today()))
    returning id into aid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  when not_null_violation then
    raise exception using errcode = 'P0001', message = 'action_item.text_required';
  end;
  for h in select x::uuid from pg_catalog.jsonb_array_elements_text(coalesce(v -> 'helper_ids', '[]'::jsonb)) x loop
    insert into work.action_item_helper (action_item_id, person_id) values (aid, h);
    if not work.task_is_past(t) then
      perform notify.push_assigned(h, 'helper_added', 'work.action_item', aid);
    end if;
  end loop;
  if not work.task_is_past(t) then
    perform notify.push_assigned(owner, 'assigned', 'work.action_item', aid);
  end if;
  return aid;
end
$$;

create function work.action_item_add(p_task uuid, p_values jsonb) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t work.task := work.task_editable(p_task);
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  aid uuid;
  req uuid;
begin
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('text', 'owner_id', 'due_on', 'sort', 'happened_on', 'helper_ids') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if nullif(v ->> 'owner_id', '') is not null and (v ->> 'owner_id')::uuid <> authz.me()
     and (v ->> 'owner_id')::uuid is distinct from t.owner_id and not authz.can('tasks.assign') then
    raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
  end if;
  req := audit.begin('ui', 'action_item.added', pg_catalog.jsonb_build_object('number', t.number));
  perform audit.happened(nullif(v ->> 'happened_on', '')::date);
  perform work.quiet_if_past(array[p_task]);
  aid := work.action_item_insert(t, v, null);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', aid, 'request_id', req);
end
$$;

create function work.action_item_update(p_id uuid, p_values jsonb, p_version int) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  a work.action_item;
  t work.task;
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  req uuid;
  what text;
begin
  select * into a from work.action_item where id = p_id and deleted_at is null;
  if a.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  t := work.task_editable(a.task_id);
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('text', 'owner_id', 'due_on', 'sort') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if v ? 'owner_id' and (v ->> 'owner_id')::uuid is distinct from a.owner_id and (v ->> 'owner_id')::uuid <> authz.me()
     and not authz.can('tasks.assign') then
    raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
  end if;
  perform core.check_version('work.action_item', p_id, p_version, array(select pg_catalog.jsonb_object_keys(v)));
  req := audit.begin('ui', 'action_item.changed', pg_catalog.jsonb_build_object('number', t.number));
  perform work.quiet_if_past(array[t.id]);
  begin
    update work.action_item set
      text = case when v ? 'text' then pg_catalog.btrim(v ->> 'text') else text end,
      owner_id = case when v ? 'owner_id' then coalesce(nullif(v ->> 'owner_id', '')::uuid, owner_id) else owner_id end,
      due_on = case when v ? 'due_on' then nullif(v ->> 'due_on', '')::date else due_on end,
      sort = case when v ? 'sort' then coalesce((v ->> 'sort')::int, sort) else sort end
    where id = p_id;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  end;
  if v ? 'owner_id' and (v ->> 'owner_id')::uuid is distinct from a.owner_id and not work.task_is_past(t) then
    perform notify.push_assigned((v ->> 'owner_id')::uuid, 'assigned', 'work.action_item', p_id);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req,
                                       'version', (select x.version from work.action_item x where x.id = p_id));
end
$$;

-- Tick or untick: the item's owner or a helper on it, or the task's editors. Done on the day it was done (V400).
create function work.action_item_done(p_id uuid, p_done boolean, p_on date default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  a work.action_item;
  t work.task;
  req uuid;
  what text;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into a from work.action_item where id = p_id and deleted_at is null;
  if a.id is null or work.row_level('work.action_item', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into t from work.task where id = a.task_id;
  if not (me = a.owner_id
          or exists (select 1 from work.action_item_helper h where h.action_item_id = p_id and h.person_id = me
                       and h.deleted_at is null)
          or work.can_edit_task(me, t))
     or work.row_level('work.action_item', p_id, me) < 'own' then
    raise exception using errcode = '42501', message = 'action_item.not_yours';
  end if;
  if p_done is null then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  req := audit.begin('ui', case when p_done then 'action_item.done' else 'action_item.reopened' end,
                     pg_catalog.jsonb_build_object('number', t.number));
  perform audit.happened(p_on);
  perform work.quiet_if_past(array[t.id]);
  begin
    update work.action_item set done_on = case when p_done then coalesce(p_on, core.riyadh_today()) end,
                                done_by = case when p_done then me end
    where id = p_id;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = work.task_refused(what);
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$$;

create function work.action_items_remove(p_ids uuid[], p_reason text default null) returns jsonb
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
  foreach i in array p_ids loop
    if not exists (select 1 from work.action_item a where a.id = i and a.deleted_at is null) then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    perform work.task_editable((select a.task_id from work.action_item a where a.id = i));
  end loop;
  req := audit.begin('ui', 'action_item.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)),
                     p_reason);
  perform work.quiet_if_past(array(select a.task_id from work.action_item a where a.id = any (p_ids)));
  update work.action_item set deleted_at = core.clock(), deleted_by = authz.me(), delete_reason = p_reason
  where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- A meeting on a task (§3.7): its note on the task's timeline, on the meeting's day, and its assigned action items —
-- one request.
create function work.task_add_meeting(p_task uuid, p_happened_on date, p_body text, p_items jsonb default null,
                                      p_mentions uuid[] default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t work.task := work.task_editable(p_task);
  n jsonb;
  i jsonb;
  ids uuid[] := '{}';
  req uuid;
begin
  if p_items is not null and pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  req := audit.begin('ui', 'task.meeting_added', pg_catalog.jsonb_build_object('number', t.number));
  perform audit.happened(p_happened_on);
  perform work.quiet_if_past(array[p_task]);
  n := core.note_add('task', p_task, 'meeting_note', p_body, p_happened_on, p_mentions);
  for i in select x from pg_catalog.jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) x loop
    ids := ids || work.action_item_insert(t, i || pg_catalog.jsonb_build_object(
                    'happened_on', coalesce(p_happened_on, core.riyadh_today())), (n ->> 'id')::uuid);
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('note_id', n ->> 'id', 'action_item_ids', pg_catalog.to_jsonb(ids),
                                       'request_id', req);
end
$$;

-- ================================================================ references and contacts
create function work.task_ref_add(p_task uuid, p_system text, p_value text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t work.task := work.task_editable(p_task);
  rid uuid;
  req uuid;
  what text;
begin
  req := audit.begin('ui', 'task.ref_added', pg_catalog.jsonb_build_object('number', t.number));
  perform work.quiet_if_past(array[p_task]);
  begin
    insert into work.task_ref (task_id, system_id, value)
    values (p_task, work.list_id('work.ref_system', p_system), pg_catalog.btrim(p_value))
    returning id into rid;
  exception
    when check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = work.task_refused(what);
    when not_null_violation then
      raise exception using errcode = 'P0001', message = 'task.ref_value_required';
    when unique_violation then
      raise exception using errcode = '23505', message = 'task.ref_taken';
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'request_id', req);
end
$$;

create function work.task_refs_remove(p_ids uuid[], p_reason text default null) returns jsonb
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
  foreach i in array p_ids loop
    if not exists (select 1 from work.task_ref r where r.id = i and r.deleted_at is null) then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    perform work.task_editable((select r.task_id from work.task_ref r where r.id = i));
  end loop;
  req := audit.begin('ui', 'task.ref_removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)),
                     p_reason);
  perform work.quiet_if_past(array(select r.task_id from work.task_ref r where r.id = any (p_ids)));
  update work.task_ref set deleted_at = core.clock(), deleted_by = authz.me(), delete_reason = p_reason
  where id = any (p_ids);
  get diagnostics k = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

-- A task's contacts become exactly `p_contacts`, each one of the task's organisation (V466).
create function work.task_contacts_set(p_task uuid, p_contacts uuid[]) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t work.task := work.task_editable(p_task);
  c uuid;
  req uuid;
begin
  req := audit.begin('ui', 'task.contacts_set', pg_catalog.jsonb_build_object('number', t.number));
  perform work.quiet_if_past(array[p_task]);
  update work.task_contact set deleted_at = core.clock(), deleted_by = authz.me()
  where task_id = p_task and deleted_at is null and not (contact_id = any (coalesce(p_contacts, '{}')));
  foreach c in array coalesce(p_contacts, '{}') loop
    continue when c is null or exists (select 1 from work.task_contact x
                                       where x.task_id = p_task and x.contact_id = c and x.deleted_at is null);
    insert into work.task_contact (task_id, contact_id) values (p_task, c);
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('request_id', req);
end
$$;

-- ================================================================ the reads: flags, My work, the list, one task (§3.7)
-- The day of a task's last activity: its own, its notes', its items' and its status changes' — on happened_on (V400).
create function work.last_activity_on(p_task uuid) returns date
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.max(d) from (
    select t.happened_on as d from work.task t where t.id = p_task
    union all select pg_catalog.max(n.happened_on) from core.note n
      where n.entity_table = 'work.task' and n.entity_id = p_task and n.deleted_at is null
    union all select pg_catalog.max(greatest(a.happened_on, a.done_on)) from work.action_item a
      where a.task_id = p_task and a.deleted_at is null
    union all select pg_catalog.max(c.happened_on) from work.task_status_change c
      where c.task_id = p_task and c.deleted_at is null) x
$$;

-- Flags judged today only (V400): overdue — due before Riyadh today and not Done or Cancelled; stale — in progress
-- (Blocked too, OLD-WRK-043) with nothing for `work.no_update_days`; neither for past work (V491).
create function work.task_flags(t work.task) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'past_work', work.task_is_past(t),
    'needs_owner', t.owner_id is null,
    'overdue', not work.task_is_past(t) and t.due_on < core.riyadh_today() and s.meaning not in ('done', 'cancelled'),
    'stale', not work.task_is_past(t) and s.meaning = 'in_progress'
             and work.last_activity_on(t.id) < core.riyadh_today()
               - coalesce((core.setting_at('work.no_update_days', null, core.riyadh_today()) #>> '{}')::int, 7),
    'blocked', t.blocked_reason is not null,
    'logged_late', t.origin <> 'backfill' and core.logged_late(t.happened_on, t.logged_at),
    'backfilled', t.origin = 'backfill',
    'last_activity_on', work.last_activity_on(t.id))
  from work.task_status s where s.id = t.status_id
$$;

create function work.task_row(t work.task, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', t.id, 'number', t.number, 'title', t.title, 'owner_id', t.owner_id, 'team_id', t.team_id,
    'priority', pr.key, 'priority_en', pr.name_en, 'priority_ar', pr.name_ar, 'executive_directive', pr.meaning is not null,
    'status', s.key, 'status_en', s.name_en, 'status_ar', s.name_ar, 'meaning', s.meaning,
    'type', ty.key, 'type_en', ty.name_en, 'type_ar', ty.name_ar, 'work_type', t.work_type,
    'start_on', t.start_on, 'due_on', t.due_on, 'partner_id', t.partner_id, 'project_id', t.project_id,
    'origin', t.origin, 'happened_on', t.happened_on, 'logged_at', t.logged_at, 'closed_at', t.closed_at,
    'blocked_reason', t.blocked_reason, 'blocked_on', t.blocked_on, 'version', t.version,
    'can_edit', work.can_edit_task(p_reader, t),
    'open_action_items', (select pg_catalog.count(*)::int from work.action_item a
                          where a.task_id = t.id and a.deleted_at is null and a.done_on is null),
    'helpers', coalesce((select pg_catalog.jsonb_agg(h.person_id order by h.created_at, h.person_id)
                         from work.task_helper h where h.task_id = t.id and h.deleted_at is null), '[]'::jsonb)
  ) || work.task_flags(t)
  from work.task_status s
  left join work.priority pr on pr.id = t.priority_id
  left join work.task_type ty on ty.id = t.type_id
  where s.id = t.status_id
$$;

-- My work (§3.7): tasks I own ∪ tasks where I own an action item ∪ tasks and action items I help on — live work only;
-- past work sits under its own filter (V491).
create function work.in_my_work(t work.task, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select t.owner_id = p_person
      or exists (select 1 from work.action_item a where a.task_id = t.id and a.deleted_at is null and a.owner_id = p_person)
      or exists (select 1 from work.task_helper h where h.task_id = t.id and h.deleted_at is null and h.person_id = p_person)
      or exists (select 1 from work.action_item a join work.action_item_helper h on h.action_item_id = a.id
                 where a.task_id = t.id and a.deleted_at is null and h.deleted_at is null and h.person_id = p_person)
$$;

-- The task list (§3.7): the reader's departments, a filter, Executive directive first (OLD-WRK-041), then by due day.
-- Filters: scope ('all', 'mine' — owned, 'my_work'), meanings, owner_id, partner_id, project_id, type, overdue, stale,
-- blocked, past_work (false by default: past work only under its own filter), needs_owner, q.
create function work.task_list(p_filter jsonb default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'view');
  f jsonb := coalesce(p_filter, '{}'::jsonb);
  lim int := greatest(1, least(coalesce(p_limit, 50), 200));
  off int := greatest(coalesce(p_offset, 0), 0);
  q text := norm.fold(f ->> 'q');
  past boolean := coalesce((f ->> 'past_work')::boolean, false) or coalesce((f ->> 'needs_owner')::boolean, false);
  rows jsonb;
  total int;
begin
  with hits as (
    select t, work.task_flags(t) as fl, pr.meaning as directive, s.meaning
    from work.task t
    join work.task_status s on s.id = t.status_id
    left join work.priority pr on pr.id = t.priority_id
    where t.deleted_at is null and work.row_level('work.task', t.id, me) >= 'view'
      and work.task_is_past(t) = past
      and (not coalesce((f ->> 'needs_owner')::boolean, false) or t.owner_id is null)
      and case coalesce(f ->> 'scope', 'all')
            when 'mine' then t.owner_id = me
            when 'my_work' then work.in_my_work(t, me)
            else true end
      and (f -> 'meanings' is null or s.meaning in (select pg_catalog.jsonb_array_elements_text(f -> 'meanings')))
      and (nullif(f ->> 'owner_id', '') is null or t.owner_id = (f ->> 'owner_id')::uuid)
      and (nullif(f ->> 'partner_id', '') is null or t.partner_id = (f ->> 'partner_id')::uuid)
      and (nullif(f ->> 'project_id', '') is null or t.project_id = (f ->> 'project_id')::uuid)
      and (nullif(f ->> 'type', '') is null or t.type_id = work.list_id('work.task_type', f ->> 'type'))
      and (q is null or norm.fold(t.title) like '%' || q || '%' or norm.fold(t.number) like '%' || q || '%')
  ), flagged as (
    select * from hits
    where (not coalesce((f ->> 'overdue')::boolean, false) or (fl ->> 'overdue')::boolean)
      and (not coalesce((f ->> 'stale')::boolean, false) or (fl ->> 'stale')::boolean)
      and (not coalesce((f ->> 'blocked')::boolean, false) or (fl ->> 'blocked')::boolean)
  )
  select (select pg_catalog.count(*)::int from flagged),
         coalesce((select pg_catalog.jsonb_agg(work.task_row(x.t, me) order by x.o)
                   from (select y.t, pg_catalog.row_number() over (
                                  order by (y.directive is not null) desc, (y.meaning in ('done', 'cancelled')),
                                           (y.t).due_on nulls last, (y.t).number) o
                         from flagged y) x
                   where x.o > off and x.o <= off + lim), '[]'::jsonb)
    into total, rows;
  return pg_catalog.jsonb_build_object('rows', rows, 'total', total, 'more', total > off + lim);
end
$$;

-- One task, with its checklist, helpers, references, contacts and status history — for whoever may see it.
create function work.task_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into t from work.task where id = p_id and deleted_at is null;
  if t.id is null or work.row_level('work.task', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return work.task_row(t, me) || pg_catalog.jsonb_build_object(
    'notes', t.notes, 'assigned_by', t.assigned_by, 'closed_by', t.closed_by, 'created_by', t.created_by,
    'action_items', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', a.id, 'text', a.text, 'owner_id', a.owner_id, 'due_on', a.due_on, 'done_on', a.done_on, 'done_by', a.done_by,
        'sort', a.sort, 'source_note_id', a.source_note_id, 'happened_on', a.happened_on, 'version', a.version,
        'overdue', not work.task_is_past(t) and a.done_on is null and a.due_on < core.riyadh_today(),
        'helpers', coalesce((select pg_catalog.jsonb_agg(h.person_id order by h.created_at)
                             from work.action_item_helper h where h.action_item_id = a.id and h.deleted_at is null),
                            '[]'::jsonb)) order by a.sort, a.created_at)
      from work.action_item a where a.task_id = p_id and a.deleted_at is null), '[]'::jsonb),
    'refs', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', r.id, 'system', s.key, 'system_en', s.name_en, 'system_ar', s.name_ar, 'value', r.value) order by r.created_at)
      from work.task_ref r join work.ref_system s on s.id = r.system_id
      where r.task_id = p_id and r.deleted_at is null), '[]'::jsonb),
    'contacts', coalesce((select pg_catalog.jsonb_agg(c.contact_id order by c.created_at)
      from work.task_contact c where c.task_id = p_id and c.deleted_at is null), '[]'::jsonb),
    'status_history', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'from', f.key, 'to', s.key, 'meaning', s.meaning, 'blocked', c.blocked, 'reason', c.reason,
        'happened_on', c.happened_on, 'logged_at', c.logged_at, 'by', c.created_by)
        order by c.happened_on desc, c.logged_at desc)
      from work.task_status_change c join work.task_status s on s.id = c.to_status_id
      left join work.task_status f on f.id = c.from_status_id
      where c.task_id = p_id and c.deleted_at is null), '[]'::jsonb));
end
$$;

create function work.project_row(p work.project, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', p.id, 'number', p.number, 'name', p.name, 'description', p.description, 'work_type', p.work_type,
    'partner_id', p.partner_id, 'owner_id', p.owner_id, 'department_id', p.department_id,
    'status', s.key, 'status_en', s.name_en, 'status_ar', s.name_ar, 'category', s.category,
    'start_on', p.start_on, 'due_on', p.due_on, 'closed_at', p.closed_at, 'segment_id', p.segment_id,
    'happened_on', p.happened_on, 'version', p.version,
    'health', (select pg_catalog.jsonb_build_object('health', h.health, 'line', h.line, 'happened_on', h.happened_on,
                                                    'by', h.created_by)
               from work.project_health h where h.project_id = p.id and h.deleted_at is null
               order by h.happened_on desc, h.logged_at desc limit 1),
    'open_tasks', (select pg_catalog.count(*)::int from work.task t join work.task_status ts on ts.id = t.status_id
                   where t.project_id = p.id and t.deleted_at is null and ts.meaning not in ('done', 'cancelled')))
  from work.project_status s where s.id = p.status_id
$$;

create function work.project_list(p_filter jsonb default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('projects', 'view');
  f jsonb := coalesce(p_filter, '{}'::jsonb);
  lim int := greatest(1, least(coalesce(p_limit, 50), 200));
  off int := greatest(coalesce(p_offset, 0), 0);
  q text := norm.fold(f ->> 'q');
begin
  return (
    with hits as (
      select p from work.project p join work.project_status s on s.id = p.status_id
      where p.deleted_at is null and work.row_level('work.project', p.id, me) >= 'view'
        and (nullif(f ->> 'partner_id', '') is null or p.partner_id = (f ->> 'partner_id')::uuid)
        and (nullif(f ->> 'owner_id', '') is null or p.owner_id = (f ->> 'owner_id')::uuid)
        and (f -> 'categories' is null or s.category in (select pg_catalog.jsonb_array_elements_text(f -> 'categories')))
        and (q is null or norm.fold(p.name) like '%' || q || '%' or norm.fold(p.number) like '%' || q || '%')
    )
    select pg_catalog.jsonb_build_object(
      'total', (select pg_catalog.count(*)::int from hits),
      'rows', coalesce((select pg_catalog.jsonb_agg(work.project_row(x.p, me) order by (x.p).number desc)
                        from (select h.p from hits h order by (h.p).number desc limit lim offset off) x), '[]'::jsonb)));
end
$$;

create function work.project_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  p work.project;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into p from work.project where id = p_id and deleted_at is null;
  if p.id is null or work.row_level('work.project', p_id, me) < 'view' then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return work.project_row(p, me) || pg_catalog.jsonb_build_object(
    'health_history', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'health', h.health, 'line', h.line, 'happened_on', h.happened_on, 'by', h.created_by)
        order by h.happened_on desc, h.logged_at desc)
      from work.project_health h where h.project_id = p_id and h.deleted_at is null), '[]'::jsonb));
end
$$;

-- ================================================================ grants and the doors (V124)
grant usage on schema work to authenticated;
grant execute on function work.project_save(uuid, jsonb, int), work.project_health_set(uuid, text, text, date),
  work.projects_remove(uuid[], text), work.task_create(jsonb, uuid[]), work.task_update(uuid, jsonb, int),
  work.tasks_assign(uuid[], uuid, text), work.task_helpers_set(uuid, uuid[]),
  work.task_status_set(uuid, text, date, text, boolean), work.tasks_remove(uuid[], text),
  work.action_item_add(uuid, jsonb), work.action_item_update(uuid, jsonb, int), work.action_item_done(uuid, boolean, date),
  work.action_items_remove(uuid[], text), work.task_add_meeting(uuid, date, text, jsonb, uuid[]),
  work.task_ref_add(uuid, text, text), work.task_refs_remove(uuid[], text), work.task_contacts_set(uuid, uuid[]),
  work.task_list(jsonb, int, int), work.task_get(uuid), work.project_list(jsonb, int, int), work.project_get(uuid)
  to authenticated;

create function api.project_save(p_id uuid, p_values jsonb, p_version int default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.project_save(p_id, p_values, p_version) $$;
create function api.project_health_set(p_project uuid, p_health text, p_line text, p_happened_on date default null)
  returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select work.project_health_set(p_project, p_health, p_line, p_happened_on) $$;
create function api.projects_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.projects_remove(p_ids, p_reason) $$;
create function api.task_create(p_values jsonb, p_mentions uuid[] default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_create(p_values, p_mentions) $$;
create function api.task_update(p_id uuid, p_values jsonb, p_version int) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_update(p_id, p_values, p_version) $$;
create function api.tasks_assign(p_ids uuid[], p_owner uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.tasks_assign(p_ids, p_owner, p_reason) $$;
create function api.task_helpers_set(p_id uuid, p_people uuid[]) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_helpers_set(p_id, p_people) $$;
create function api.task_status_set(p_id uuid, p_status text, p_happened_on date default null, p_reason text default null,
                                    p_close_items boolean default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select work.task_status_set(p_id, p_status, p_happened_on, p_reason, p_close_items) $$;
create function api.tasks_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.tasks_remove(p_ids, p_reason) $$;
create function api.action_item_add(p_task uuid, p_values jsonb) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.action_item_add(p_task, p_values) $$;
create function api.action_item_update(p_id uuid, p_values jsonb, p_version int) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select work.action_item_update(p_id, p_values, p_version) $$;
create function api.action_item_done(p_id uuid, p_done boolean, p_on date default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.action_item_done(p_id, p_done, p_on) $$;
create function api.action_items_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.action_items_remove(p_ids, p_reason) $$;
create function api.task_add_meeting(p_task uuid, p_happened_on date, p_body text, p_items jsonb default null,
                                     p_mentions uuid[] default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select work.task_add_meeting(p_task, p_happened_on, p_body, p_items, p_mentions) $$;
create function api.task_ref_add(p_task uuid, p_system text, p_value text) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_ref_add(p_task, p_system, p_value) $$;
create function api.task_refs_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_refs_remove(p_ids, p_reason) $$;
create function api.task_contacts_set(p_task uuid, p_contacts uuid[]) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_contacts_set(p_task, p_contacts) $$;
create function api.tasks(p_filter jsonb default null, p_limit int default 50, p_offset int default 0) returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.task_list(p_filter, p_limit, p_offset) $$;
create function api.task(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.task_get(p_id) $$;
create function api.projects(p_filter jsonb default null, p_limit int default 50, p_offset int default 0) returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.project_list(p_filter, p_limit, p_offset) $$;
create function api.project(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.project_get(p_id) $$;

grant execute on function api.project_save(uuid, jsonb, int), api.project_health_set(uuid, text, text, date),
  api.projects_remove(uuid[], text), api.task_create(jsonb, uuid[]), api.task_update(uuid, jsonb, int),
  api.tasks_assign(uuid[], uuid, text), api.task_helpers_set(uuid, uuid[]),
  api.task_status_set(uuid, text, date, text, boolean), api.tasks_remove(uuid[], text),
  api.action_item_add(uuid, jsonb), api.action_item_update(uuid, jsonb, int), api.action_item_done(uuid, boolean, date),
  api.action_items_remove(uuid[], text), api.task_add_meeting(uuid, date, text, jsonb, uuid[]),
  api.task_ref_add(uuid, text, text), api.task_refs_remove(uuid[], text), api.task_contacts_set(uuid, uuid[]),
  api.tasks(jsonb, int, int), api.task(uuid), api.projects(jsonb, int, int), api.project(uuid)
  to authenticated;
