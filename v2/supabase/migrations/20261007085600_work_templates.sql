-- P5-1 · Task templates and recurring tasks (TECH-SPEC §3.7; V72, V89, V401, V438, V479). A template is either
-- generated on a schedule (`rule`) by the job at 00:05 Riyadh — once per occurrence, for one organisation, none, each
-- key client or each organisation of a side type — or offered by an event (`offered_on`) and made when a person presses
-- it. Its checklist becomes the task's action items. The seeds start switched off: an admin names their owners and
-- switches them on in Settings › Work (V479 "each with a named owner at go-live"). Forward-only (V103).

-- ================================================================ the shapes a template may hold
-- A checklist row: {text, owner: 'task_owner' | a person's id, due_offset_days: days after the task is made}.
create function work.checklist_ok(p jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p) = 'array' and pg_catalog.jsonb_array_length(p) <= 50
    and not exists (
      select 1 from pg_catalog.jsonb_array_elements(p) i
      where pg_catalog.jsonb_typeof(i) <> 'object'
         or exists (select 1 from pg_catalog.jsonb_object_keys(i) k where k not in ('text', 'owner', 'due_offset_days'))
         or pg_catalog.jsonb_typeof(i -> 'text') is distinct from 'string'
         or pg_catalog.btrim(i ->> 'text') = '' or pg_catalog.length(i ->> 'text') > 500
         or (i ? 'owner' and (i ->> 'owner') <> 'task_owner'
             and (i ->> 'owner') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
         or (i ? 'due_offset_days' and (i ->> 'due_offset_days') !~ '^[0-9]{1,3}$'))
$$;

-- A schedule: {freq: daily | weekly | monthly | quarterly | yearly, interval (every n), weekdays [0 = Sunday … 6]
-- (weekly), month_day 1–31 (monthly and longer; past a month's end, its last day), working_days (daily: not Friday or
-- Saturday), lead_days 0–60 (made that many days before the day it is due)}.
create function work.rule_ok(p jsonb) returns boolean
language sql immutable parallel safe set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p) = 'object'
    and not exists (select 1 from pg_catalog.jsonb_object_keys(p) k
                    where k not in ('freq', 'interval', 'weekdays', 'month_day', 'working_days', 'lead_days'))
    and coalesce(p ->> 'freq', '') in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')
    and (not p ? 'interval' or (p ->> 'interval') ~ '^[1-9][0-9]?$')
    and (not p ? 'weekdays' or (pg_catalog.jsonb_typeof(p -> 'weekdays') = 'array'
                                and pg_catalog.jsonb_array_length(p -> 'weekdays') between 1 and 7
                                and not exists (select 1 from pg_catalog.jsonb_array_elements_text(p -> 'weekdays') d
                                                where d !~ '^[0-6]$')))
    and (not p ? 'month_day' or (p ->> 'month_day') ~ '^([1-9]|[12][0-9]|3[01])$')
    and (not p ? 'working_days' or pg_catalog.jsonb_typeof(p -> 'working_days') = 'boolean')
    and (not p ? 'lead_days' or (p ->> 'lead_days') ~ '^([0-9]|[1-5][0-9]|60)$')
$$;

-- Whether a schedule that starts on `p_start` falls on `p_day`.
create function work.occurs_on(p_rule jsonb, p_start date, p_day date) returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  freq text := p_rule ->> 'freq';
  n int := coalesce((p_rule ->> 'interval')::int, 1);
  dow int := pg_catalog.date_part('dow', p_day)::int;
  months int;
  md int;
  last_day int;
begin
  if p_day < p_start then
    return false;
  end if;
  if freq = 'daily' then
    if coalesce((p_rule ->> 'working_days')::boolean, false) and dow in (5, 6) then
      return false;
    end if;
    return (p_day - p_start) % n = 0;
  elsif freq = 'weekly' then
    if not (case when p_rule ? 'weekdays'
                 then exists (select 1 from pg_catalog.jsonb_array_elements_text(p_rule -> 'weekdays') d where d::int = dow)
                 else dow = pg_catalog.date_part('dow', p_start)::int end) then
      return false;
    end if;
    return ((p_day - (p_start - pg_catalog.date_part('dow', p_start)::int)) / 7) % n = 0;
  end if;
  months := case freq when 'monthly' then n when 'quarterly' then 3 * n else 12 * n end;
  if ((pg_catalog.date_part('year', p_day)::int * 12 + pg_catalog.date_part('month', p_day)::int)
      - (pg_catalog.date_part('year', p_start)::int * 12 + pg_catalog.date_part('month', p_start)::int)) % months <> 0 then
    return false;
  end if;
  md := coalesce((p_rule ->> 'month_day')::int, pg_catalog.date_part('day', p_start)::int);
  last_day := pg_catalog.date_part('day', (pg_catalog.make_date(pg_catalog.date_part('year', p_day)::int,
                                                                pg_catalog.date_part('month', p_day)::int, 1)
                                           + interval '1 month' - interval '1 day'))::int;
  return pg_catalog.date_part('day', p_day)::int = least(md, last_day);
end
$$;

-- ================================================================ the tables
create table work.task_template (
  id uuid primary key default gen_random_uuid(),
  title text not null check (pg_catalog.btrim(title) <> '' and pg_catalog.length(title) <= 300),
  notes text check (notes is null or pg_catalog.length(notes) <= 20000),
  owner_id uuid references core.person (id),          -- per organisation: its side's owner first (the account manager)
  team_id uuid references core.team (id),
  priority_id uuid references work.priority (id),
  type_id uuid references work.task_type (id),         -- V438: a task type per template
  work_type text not null default 'client' check (work_type in ('client', 'internal')),
  partner_id uuid references partner.partner (id),     -- one organisation …
  for_each text check (for_each in ('key_client', 'side_type')),   -- … or each key client, or each of a side type
  side_type_id uuid references partner.side_type (id),
  checklist jsonb not null default '[]'::jsonb,
  rule jsonb,
  starts_on date,
  ends_on date,
  attach_previous boolean not null default false,      -- V479: the new task links the previous one's files
  offered_on text check (offered_on in ('client_on', 'supplier_signed', 'contract_added')),
  active boolean not null default true,
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text,
  constraint template_checklist check (work.checklist_ok(checklist)),
  constraint template_rule check (rule is null or work.rule_ok(rule)),
  constraint template_generated_or_offered check ((rule is null) <> (offered_on is null)),
  constraint template_starts check (rule is null or starts_on is not null),
  constraint template_ends_after_start check (ends_on is null or starts_on is null or ends_on >= starts_on),
  constraint template_one_target check (partner_id is null or for_each is null),
  constraint template_side_type check ((side_type_id is null) or for_each = 'side_type'),
  constraint template_internal_alone check (work_type = 'client' or (partner_id is null and for_each is null)),
  -- a template that runs needs whom it runs for: a named owner, or one per organisation; a side type to run over
  constraint template_runs_for_someone check (not active or rule is null or owner_id is not null or for_each is not null),
  constraint template_runs_over_a_type check (not active or for_each is distinct from 'side_type' or side_type_id is not null)
);
comment on table work.task_template is
  'A task template (TECH-SPEC §3.7, V479): generated on a schedule (rule) or offered by an event (offered_on); its checklist becomes the task''s action items.';

-- One row per occurrence made: the job finds it taken and makes nothing twice.
create table work.task_occurrence (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references work.task_template (id),
  occurs_on date not null,
  partner_id uuid references partner.partner (id),
  task_id uuid references work.task (id),
  created_at timestamptz not null default now(), created_by uuid not null references core.person (id),
  updated_at timestamptz, updated_by uuid references core.person (id), version int not null default 1,
  deleted_at timestamptz, deleted_by uuid references core.person (id), delete_reason text
);
create unique index task_occurrence_once on work.task_occurrence
  (template_id, occurs_on, coalesce(partner_id, '00000000-0000-0000-0000-000000000000'::uuid));
comment on table work.task_occurrence is
  'An occurrence of a template, made once (TECH-SPEC §3.7): which task it became. An Undo keeps the occurrence taken.';

do $$
declare
  t text;
begin
  foreach t in array array['work.task_template', 'work.task_occurrence'] loop
    execute pg_catalog.format('alter table %s enable row level security', t);
    perform audit.track(t::regclass);
  end loop;
end $$;
select core.index_foreign_keys('work');

create function work.template_refused(p_constraint text) returns text
language sql immutable set search_path = ''
as $$
  select case p_constraint
    when 'task_template_title_check' then 'template.title_required'
    when 'template_checklist' then 'template.checklist_invalid'
    when 'template_rule' then 'template.rule_invalid'
    when 'template_generated_or_offered' then 'template.rule_or_offer'
    when 'template_starts' then 'template.starts_required'
    when 'template_ends_after_start' then 'template.ends_before_start'
    when 'template_one_target' then 'template.one_target'
    when 'template_side_type' then 'template.side_type_for_each'
    when 'template_internal_alone' then 'template.internal_has_no_organisation'
    when 'template_runs_for_someone' then 'template.owner_required'
    when 'template_runs_over_a_type' then 'template.side_type_required'
    when 'task_template_offered_on_check' then 'template.offer_invalid'
    else 'common.invalid'
  end
$$;

-- ================================================================ whom a template runs for, and who owns each task
-- The organisations an occurrence on `p_day` is for: none (one task), its one organisation, each key client whose
-- Client side is on, or each organisation whose side of that type is on.
create function work.template_targets(t work.task_template, p_day date) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select t.partner_id where t.for_each is null
  union all
  select p.id from partner.partner p join partner.partner_side s on s.partner_id = p.id and s.side = 'client'
  where t.for_each = 'key_client' and p.key_partner and p.deleted_at is null and s.deleted_at is null
    and (s.since is null or s.since <= p_day) and (s.until is null or s.until > p_day)
  union all
  select p.id from partner.partner p join partner.partner_side s on s.partner_id = p.id and s.type_id = t.side_type_id
  where t.for_each = 'side_type' and p.deleted_at is null and s.deleted_at is null
    and (s.since is null or s.since <= p_day) and (s.until is null or s.until > p_day)
$$;

-- The owner of one occurrence: per organisation, the owner of its side (the account manager) who may work; else the
-- template's owner who may work; else nobody (then nothing is made).
create function work.template_owner(t work.task_template, p_partner uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select o.person_id
     from partner.side_owners(p_partner, case when t.for_each = 'side_type'
                                              then (select st.side from partner.side_type st where st.id = t.side_type_id)
                                              else 'client' end) o(person_id)
     where p_partner is not null and work.person_ok(o.person_id) limit 1),
    (select t.owner_id where t.owner_id is not null and work.person_ok(t.owner_id)))
$$;

-- The checklist rows as action items on task `p_task`, made on `p_day`: 'task_owner' (or a person who may not work)
-- is the task's owner. Inside an open request.
create function work.template_checklist_add(t work.task_template, p_task uuid, p_day date) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  k work.task;
  i jsonb;
  who uuid;
  n int := 0;
begin
  select * into k from work.task where id = p_task;
  for i in select x from pg_catalog.jsonb_array_elements(t.checklist) with ordinality e(x, o) order by o loop
    who := case when coalesce(i ->> 'owner', 'task_owner') = 'task_owner' then k.owner_id else (i ->> 'owner')::uuid end;
    if who is null or not work.person_ok(who) then
      who := k.owner_id;
    end if;
    perform work.action_item_insert(k, pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'text', i ->> 'text', 'owner_id', who, 'happened_on', p_day,
      'due_on', p_day + nullif(i ->> 'due_offset_days', '')::int, 'sort', (n + 1) * 10)), null);
    n := n + 1;
  end loop;
  return n;
end
$$;

-- V479 attach_previous: the files of the template's previous task for the same organisation are linked to the new one.
create function work.template_attach_previous(t work.task_template, p_partner uuid, p_task uuid) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  prev uuid;
  n int;
begin
  select o.task_id into prev from work.task_occurrence o
  where o.template_id = t.id and o.partner_id is not distinct from p_partner and o.task_id is not null
    and o.task_id <> p_task and o.deleted_at is null
  order by o.occurs_on desc limit 1;
  if prev is null then
    return 0;
  end if;
  insert into core.file_link (file_id, entity_table, entity_id, purpose)
  select l.file_id, 'work.task', p_task, l.purpose from core.file_link l
  where l.entity_table = 'work.task' and l.entity_id = prev and l.deleted_at is null;
  get diagnostics n = row_count;
  return n;
end
$$;

-- ================================================================ the job
-- Each generated task is its own request of kind job, attributed to the template's creator and naming the template
-- (TECH-SPEC §3.7: a record made on a person's standing instruction).
create function work.template_request(t work.task_template) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r uuid;
begin
  if coalesce(nullif(pg_catalog.current_setting('app.request_depth', true), '')::int, 0) > 0 then
    raise exception using errcode = 'P0001', message = 'audit.nested_request';
  end if;
  insert into audit.request (actor_id, kind, label_key, label_args)
  values (t.created_by, 'job', 'task.generated', pg_catalog.jsonb_build_object('template', t.title))
  returning id into r;
  perform pg_catalog.set_config('app.request_id', r::text, true);
  perform pg_catalog.set_config('app.request_depth', '1', true);
  return r;
end
$$;
revoke all on function work.template_request(work.task_template) from public;

-- One occurrence: claimed first, so a second run makes nothing; the task due on the occurrence's day, made today,
-- numbered in this year (V531), origin template; its checklist; the previous task's files when asked; its owner told.
-- Nothing is made when nobody may own it or the owner has no team.
create function work.template_generate_one(t work.task_template, p_day date, p_due date, p_partner uuid)
  returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  owner uuid := work.template_owner(t, p_partner);
  team uuid;
  occ uuid;
  tid uuid;
begin
  if owner is null then
    return null;
  end if;
  team := coalesce(t.team_id, (select p.team_id from core.person p where p.id = owner));
  if team is null
     or exists (select 1 from work.task_occurrence o
                where o.template_id = t.id and o.occurs_on = p_due and o.partner_id is not distinct from p_partner) then
    return null;
  end if;
  perform work.template_request(t);
  insert into work.task_occurrence (template_id, occurs_on, partner_id) values (t.id, p_due, p_partner)
  returning id into occ;
  insert into work.task (number, title, notes, owner_id, team_id, department_id, priority_id, status_id, type_id,
                         work_type, due_on, partner_id, origin, happened_on)
  values (core.format_number('TSK', pg_catalog.date_part('year', p_day)::int,
                             core.next_number('task', pg_catalog.date_part('year', p_day)::int)),
          t.title, t.notes, owner, team, (select m.department_id from core.team m where m.id = team), t.priority_id,
          (select s.id from work.task_status s where s.is_default and s.deleted_at is null), t.type_id,
          case when p_partner is null then 'internal' else 'client' end, p_due, p_partner, 'template', p_day)
  returning id into tid;
  update work.task_occurrence set task_id = tid where id = occ;
  perform work.template_checklist_add(t, tid, p_day);
  if t.attach_previous then
    perform work.template_attach_previous(t, p_partner, tid);
  end if;
  if not work.is_past(p_day) then
    perform notify.push_assigned(owner, 'assigned', 'work.task', tid);
  end if;
  perform audit.end();
  return tid;
end
$$;

-- The job (00:05 Riyadh): every active scheduled template whose occurrence falls `lead_days` after `p_day`, once per
-- organisation it runs for. Runs twice, makes each task once. Answers how many tasks it made.
create function work.generate_recurring(p_day date default null) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  today date := coalesce(p_day, core.riyadh_today());
  t work.task_template;
  due date;
  p uuid;
  made int := 0;
begin
  for t in select x.* from work.task_template x
           where x.active and x.deleted_at is null and x.rule is not null
           order by x.created_at, x.id loop
    due := today + coalesce((t.rule ->> 'lead_days')::int, 0);
    continue when t.ends_on is not null and due > t.ends_on;
    continue when not work.occurs_on(t.rule, t.starts_on, due);
    for p in select x from work.template_targets(t, due) x loop
      if work.template_generate_one(t, today, due, p) is not null then
        made := made + 1;
      end if;
    end loop;
  end loop;
  return made;
end
$$;
comment on function work.generate_recurring(date) is
  'The recurring-tasks job (00:05 Riyadh): each occurrence of each active scheduled template, made once.';

-- Scheduled where pg_cron exists: 00:05 Riyadh = 21:05 UTC the day before.
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('work-generate-recurring', '5 21 * * *', 'select work.generate_recurring()');
  end if;
end $$;

-- ================================================================ an offered template, pressed by a person
-- The templates an event offers (client_on · supplier_signed · contract_added), each with the task it last made for
-- this organisation, if any. Anyone who makes tasks.
create function work.templates_offered(p_event text, p_partner uuid default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'own');
begin
  if p_partner is not null and not authz.can_see_as(me, 'partner.partner', p_partner) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', t.id, 'title', t.title, 'notes', t.notes, 'checklist', t.checklist,
             'last_task_id', (select o.task_id from work.task_occurrence o join work.task k on k.id = o.task_id
                              where o.template_id = t.id and o.partner_id is not distinct from p_partner
                                and o.deleted_at is null and k.deleted_at is null
                              order by o.occurs_on desc, o.created_at desc limit 1))
           order by t.title, t.id)
    from work.task_template t
    where t.offered_on = p_event and t.active and t.deleted_at is null), '[]'::jsonb);
end
$$;

-- Make the task an offered template describes, through the task's own door (its rules: a task for someone else needs
-- tasks.assign), with its checklist as action items, in one request; `p_values` are the task's fields (partner_id,
-- owner_id, due_on …) and win. Once a day per organisation (template.applied_today).
create function work.task_from_template(p_template uuid, p_values jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('tasks', 'own');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  t work.task_template;
  day date := coalesce(nullif(v ->> 'happened_on', '')::date, core.riyadh_today());
  pid uuid := nullif(v ->> 'partner_id', '')::uuid;
  req uuid;
  a jsonb;
  occ uuid;
begin
  select * into t from work.task_template where id = p_template and active and deleted_at is null;
  if t.id is null or t.offered_on is null then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.task_template';
  end if;
  req := audit.begin('ui', 'task.created', pg_catalog.jsonb_build_object('template', t.title));
  insert into work.task_occurrence (template_id, occurs_on, partner_id) values (t.id, day, pid)
  on conflict do nothing returning id into occ;
  if occ is null then
    raise exception using errcode = 'P0001', message = 'template.applied_today';
  end if;
  a := work.task_create(pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
         'title', t.title, 'notes', t.notes, 'priority', t.priority_id::text, 'type', t.type_id::text,
         'team_id', t.team_id::text, 'work_type', case when pid is null then 'internal' else 'client' end)) || v);
  update work.task_occurrence set task_id = (a ->> 'id')::uuid where id = occ;
  update work.task set origin = 'template' where id = (a ->> 'id')::uuid;
  perform work.template_checklist_add(t, (a ->> 'id')::uuid, day);
  if t.attach_previous then
    perform work.template_attach_previous(t, pid, (a ->> 'id')::uuid);
  end if;
  perform audit.end();
  return a || pg_catalog.jsonb_build_object('request_id', req, 'template_id', t.id);
end
$$;

-- ================================================================ Settings › Work › Templates (admins: Full on the page)
create function work.template_row(t work.task_template) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', t.id, 'title', t.title, 'notes', t.notes, 'owner_id', t.owner_id, 'team_id', t.team_id,
    'priority_id', t.priority_id, 'type_id', t.type_id, 'work_type', t.work_type, 'partner_id', t.partner_id,
    'for_each', t.for_each, 'side_type_id', t.side_type_id, 'checklist', t.checklist, 'rule', t.rule,
    'starts_on', t.starts_on, 'ends_on', t.ends_on, 'attach_previous', t.attach_previous, 'offered_on', t.offered_on,
    'active', t.active, 'version', t.version,
    'made', (select pg_catalog.count(*)::int from work.task_occurrence o
             where o.template_id = t.id and o.task_id is not null and o.deleted_at is null))
$$;

create function work.task_templates() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('settings.work', 'full');
  return coalesce((select pg_catalog.jsonb_agg(work.template_row(t) order by t.active desc, t.title, t.id)
                   from work.task_template t where t.deleted_at is null), '[]'::jsonb);
end
$$;

-- Add (p_id null) or change a template; only the fields given change. Its owner may work; its organisation is one the
-- admin may see.
create function work.task_template_save(p_id uuid, p_values jsonb, p_version int default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('settings.work', 'full');
  v jsonb := coalesce(p_values, '{}'::jsonb);
  k text;
  rid uuid := p_id;
  req uuid;
  what text;
begin
  if pg_catalog.jsonb_typeof(v) <> 'object' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('title', 'notes', 'owner_id', 'team_id', 'priority_id', 'type_id', 'work_type', 'partner_id', 'for_each',
                 'side_type_id', 'checklist', 'rule', 'starts_on', 'ends_on', 'attach_previous', 'offered_on', 'active') then
      raise exception using errcode = 'P0001', message = 'common.unknown_field', detail = k;
    end if;
  end loop;
  if nullif(v ->> 'owner_id', '') is not null and not work.person_ok((v ->> 'owner_id')::uuid) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = v ->> 'owner_id';
  end if;
  if nullif(v ->> 'partner_id', '') is not null and not authz.can_see_as(me, 'partner.partner', (v ->> 'partner_id')::uuid) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'partner.partner';
  end if;
  if p_id is not null then
    if not exists (select 1 from work.task_template where id = p_id and deleted_at is null) then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    perform core.check_version('work.task_template', p_id, p_version, array(select pg_catalog.jsonb_object_keys(v)));
  end if;
  req := audit.begin('ui', case when p_id is null then 'template.added' else 'template.changed' end,
                     pg_catalog.jsonb_build_object('title', coalesce(v ->> 'title',
                       (select t.title from work.task_template t where t.id = p_id))));
  begin
    if p_id is null then
      insert into work.task_template (title, notes, owner_id, team_id, priority_id, type_id, work_type, partner_id,
                                      for_each, side_type_id, checklist, rule, starts_on, ends_on, attach_previous,
                                      offered_on, active)
      values (pg_catalog.btrim(v ->> 'title'), nullif(pg_catalog.btrim(v ->> 'notes'), ''),
              nullif(v ->> 'owner_id', '')::uuid, nullif(v ->> 'team_id', '')::uuid, nullif(v ->> 'priority_id', '')::uuid,
              nullif(v ->> 'type_id', '')::uuid, coalesce(nullif(v ->> 'work_type', ''), 'client'),
              nullif(v ->> 'partner_id', '')::uuid, nullif(v ->> 'for_each', ''), nullif(v ->> 'side_type_id', '')::uuid,
              coalesce(v -> 'checklist', '[]'::jsonb), case when pg_catalog.jsonb_typeof(v -> 'rule') = 'object' then v -> 'rule' end,
              nullif(v ->> 'starts_on', '')::date, nullif(v ->> 'ends_on', '')::date,
              coalesce((v ->> 'attach_previous')::boolean, false), nullif(v ->> 'offered_on', ''),
              coalesce((v ->> 'active')::boolean, true))
      returning id into rid;
    else
      update work.task_template t set
        title = case when v ? 'title' then pg_catalog.btrim(v ->> 'title') else t.title end,
        notes = case when v ? 'notes' then nullif(pg_catalog.btrim(v ->> 'notes'), '') else t.notes end,
        owner_id = case when v ? 'owner_id' then nullif(v ->> 'owner_id', '')::uuid else t.owner_id end,
        team_id = case when v ? 'team_id' then nullif(v ->> 'team_id', '')::uuid else t.team_id end,
        priority_id = case when v ? 'priority_id' then nullif(v ->> 'priority_id', '')::uuid else t.priority_id end,
        type_id = case when v ? 'type_id' then nullif(v ->> 'type_id', '')::uuid else t.type_id end,
        work_type = case when v ? 'work_type' then v ->> 'work_type' else t.work_type end,
        partner_id = case when v ? 'partner_id' then nullif(v ->> 'partner_id', '')::uuid else t.partner_id end,
        for_each = case when v ? 'for_each' then nullif(v ->> 'for_each', '') else t.for_each end,
        side_type_id = case when v ? 'side_type_id' then nullif(v ->> 'side_type_id', '')::uuid else t.side_type_id end,
        checklist = case when v ? 'checklist' then coalesce(v -> 'checklist', '[]'::jsonb) else t.checklist end,
        rule = case when v ? 'rule' then case when pg_catalog.jsonb_typeof(v -> 'rule') = 'object' then v -> 'rule' end
                    else t.rule end,
        starts_on = case when v ? 'starts_on' then nullif(v ->> 'starts_on', '')::date else t.starts_on end,
        ends_on = case when v ? 'ends_on' then nullif(v ->> 'ends_on', '')::date else t.ends_on end,
        attach_previous = case when v ? 'attach_previous' then coalesce((v ->> 'attach_previous')::boolean, false)
                               else t.attach_previous end,
        offered_on = case when v ? 'offered_on' then nullif(v ->> 'offered_on', '') else t.offered_on end,
        active = case when v ? 'active' then coalesce((v ->> 'active')::boolean, t.active) else t.active end
      where t.id = p_id;
    end if;
  exception
    when check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = work.template_refused(what);
    when not_null_violation then
      raise exception using errcode = 'P0001', message = 'template.title_required';
  end;
  perform audit.end();
  return work.template_row((select t from work.task_template t where t.id = rid)) || pg_catalog.jsonb_build_object('request_id', req);
end
$$;

create function work.task_templates_remove(p_ids uuid[], p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  req uuid;
  n int;
begin
  perform authz.require('settings.work', 'full');
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  req := audit.begin('ui', 'template.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)),
                     nullif(pg_catalog.btrim(p_reason), ''));
  update work.task_template set deleted_at = core.clock(), deleted_by = authz.me(), delete_reason = nullif(pg_catalog.btrim(p_reason), '')
  where id = any (p_ids) and deleted_at is null;
  get diagnostics n = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('removed', n, 'request_id', req);
end
$$;

-- ================================================================ the seeds (V72, V89, V401, V479): switched off until
-- an admin names their owners and switches them on (the runbook's step)
select audit.begin('system', 'list.seeded');
insert into work.task_template (title, work_type, for_each, checklist, rule, starts_on, offered_on, attach_previous, active)
values
  ('Client feedback', 'client', 'key_client', '[]'::jsonb,
   '{"freq": "monthly", "month_day": 1}'::jsonb, date '2026-01-01', null, false, false),
  ('Quarterly business review', 'client', 'key_client',
   '[{"text": "Figures reviewed"}, {"text": "Issues"}, {"text": "Next quarter''s plan"}]'::jsonb,
   '{"freq": "quarterly", "month_day": 1}'::jsonb, date '2026-01-01', null, false, false),
  ('Corporate onboarding', 'client', null,
   '[{"text": "Agreement signed and stamped"}, {"text": "Account set up"}, {"text": "Travel policy received"},
     {"text": "Operations briefed"}, {"text": "First request"}]'::jsonb,
   null, null, 'client_on', false, false),
  ('New lead tickets', 'internal', null, '[]'::jsonb,
   '{"freq": "daily", "working_days": true}'::jsonb, date '2026-01-01', null, false, false),
  ('Supplier onboarding', 'client', null,
   '[{"text": "Portal access set up for each department that uses it"}, {"text": "Codes mailbox recorded"},
     {"text": "Contract filed"}]'::jsonb,
   null, null, 'supplier_signed', false, false),
  ('Accreditation yearly review', 'client', 'side_type', '[]'::jsonb,
   '{"freq": "yearly", "month_day": 1}'::jsonb, date '2026-01-01', null, true, false),
  ('Legal review', 'client', null, '[]'::jsonb, null, null, 'contract_added', false, false),
  ('Stats readings', 'internal', null, '[{"text": "Figures typed as readings, with the screenshot"}]'::jsonb,
   '{"freq": "monthly", "month_day": 1}'::jsonb, date '2026-01-01', null, false, false);
select audit.end();

-- ================================================================ grants and the doors (V124)
grant execute on function work.templates_offered(text, uuid), work.task_from_template(uuid, jsonb), work.task_templates(),
  work.task_template_save(uuid, jsonb, int), work.task_templates_remove(uuid[], text) to authenticated;

create function api.templates_offered(p_event text, p_partner uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.templates_offered(p_event, p_partner) $$;
create function api.task_from_template(p_template uuid, p_values jsonb default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_from_template(p_template, p_values) $$;
create function api.task_templates() returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.task_templates() $$;
create function api.task_template_save(p_id uuid, p_values jsonb, p_version int default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_template_save(p_id, p_values, p_version) $$;
create function api.task_templates_remove(p_ids uuid[], p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_templates_remove(p_ids, p_reason) $$;

grant execute on function api.templates_offered(text, uuid), api.task_from_template(uuid, jsonb), api.task_templates(),
  api.task_template_save(uuid, jsonb, int), api.task_templates_remove(uuid[], text) to authenticated;
