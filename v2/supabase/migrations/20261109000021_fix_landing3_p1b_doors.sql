-- Fix landing 3, Cluster A (FIX-05, FIX-01, FIX-40): the P1b doors, own tasks / own records only.
--
-- P1b is granted with own-task scope: a Member may assign a task they own or created, and a task they create;
-- a Member may bulk-assign organisations they own on the side. Nothing else is unlocked: `tasks.assign` still
-- gates the Team view, backfilling for others and the load figures, and `clients.assign` /
-- `suppliers_partners.assign` still gate the per-record owner picker. The new narrow capabilities
-- (`tasks.assign_own`, `clients.assign_own`, `suppliers_partners.assign_own`) arrive in the registry-sync
-- migration 20261109043100; this migration is the doors that read them.
--
-- Also in this migration: work.tasks_priority_set (FIX-01 F051, the /tasks bulk bar's priority leg — one request,
-- one Undo), the delegator as a helper on delegate (FIX-40 F004), and the partners list carrying `created_at`
-- (FIX-01 D28, the stable sort tie-break added-at + id).
--
-- Forward-only: every function below is a `create or replace` restating the live body with the one marked change.
-- database.types.ts regen is owed for api.tasks_priority_set (no live database in this tree to run typegen against).

select audit.begin('system', 'fix.landing3_p1b_doors');

-- (1) work.task_create: naming another owner at creation is the creator's own work, so `tasks.assign_own`
-- suffices alongside `tasks.assign`. Giving away an existing task still needs `tasks.assign` (work.tasks_assign).
create or replace function work.task_create(p_values jsonb, p_mentions uuid[] default null) returns jsonb
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
  -- P1b (own tasks only): naming another owner on work one creates is the creator's own work, so the own-task
  -- capability suffices alongside Assign. Anything else the old rule covers — ownerless work, and an owner the
  -- project or organisation defaults to — still needs Assign alone.
  if owner is distinct from me and (named is not null or owner is null)
     and not (authz.can('tasks.assign') or (named is not null and authz.can('tasks.assign_own'))) then
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

-- (2) work.tasks_assign: `tasks.assign_own` lets the task's current owner give away their own task; anyone else
-- still needs `tasks.assign`. Taking a task oneself stays open as before. The creator alone is not enough: once
-- the task belongs to someone else it is theirs, not the creator's — DLG-01 pins that (a member who created a
-- task but no longer owns it is still refused).
create or replace function work.tasks_assign(p_ids uuid[], p_owner uuid, p_reason text default null) returns jsonb
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
    if not (authz.can('tasks.assign')
            or (authz.can('tasks.assign_own') and t.owner_id = me)
            or (p_owner = me and work.can_edit_task(me, t) and t.owner_id is not null)) then
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

-- (3) work.tasks_priority_set (new): set the priority of many tasks in one request, one Undo — the /tasks bulk
-- bar's priority leg (FIX-01, F051). The door is the task's own edit door (work.task_editable): its owner, its
-- creator, or Full — the same as changing one task's priority through task_update. The key resolves through
-- work.list_id, so an unknown key is refused as list.unknown_value.
create function work.tasks_priority_set(p_ids uuid[], p_priority text, p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  i uuid;
  t work.task;
  pid uuid;
  req uuid;
  k int := 0;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_ids is null or pg_catalog.cardinality(p_ids) = 0 then
    raise exception using errcode = 'P0001', message = 'common.nothing_selected';
  end if;
  if p_priority is null or pg_catalog.btrim(p_priority) = '' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  pid := work.list_id('work.priority', p_priority);
  foreach i in array p_ids loop
    t := work.task_editable(i);
  end loop;
  req := audit.begin('ui', 'task.priority_set', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  perform work.quiet_if_past(p_ids);
  for t in select * from work.task x where x.id = any (p_ids) and x.priority_id is distinct from pid loop
    update work.task set priority_id = pid where id = t.id;
    k := k + 1;
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;
comment on function work.tasks_priority_set(uuid[], text, text) is
  'FIX-01: set the priority of many tasks in one request, one Undo.';

create function api.tasks_priority_set(p_ids uuid[], p_priority text, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.tasks_priority_set(p_ids, p_priority, p_reason) $$;
comment on function api.tasks_priority_set(uuid[], text, text) is
  'FIX-01: set the priority of many tasks in one request, one Undo.';
revoke all on function work.tasks_priority_set(uuid[], text, text), api.tasks_priority_set(uuid[], text, text) from public;
grant execute on function work.tasks_priority_set(uuid[], text, text), api.tasks_priority_set(uuid[], text, text) to authenticated;

-- (4) partner.bulk_assign (the side's five-argument form): `<side>.assign_own` passes the gate; each row is then
-- checked to be one the caller owns on this side (FIX-01, F100/F138 — own records only). Anyone else still needs
-- `<side>.assign`, and the per-record owner picker stays on it too.
create or replace function partner.bulk_assign(p_ids uuid[], p_side text, p_owner uuid, p_priority uuid, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require(partner.side_page(p_side), 'full');
  pid uuid;
  req uuid;
  n int := 0;
  can_all boolean;
begin
  can_all := authz.can(partner.side_page(p_side) || '.assign');
  if not can_all and not authz.can(partner.side_page(p_side) || '.assign_own') then
    perform authz.require_capability(partner.side_page(p_side) || '.assign');
  end if;
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
    if not can_all and not (me = any (select partner.side_owners(pid, p_side))) then
      raise exception using errcode = '42501', message = 'access.needs_capability',
        detail = pg_catalog.jsonb_build_object('capability', partner.side_page(p_side) || '.assign')::text;
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

-- (5) work.task_delegate: the delegator is also listed in the Helpers list (FIX-40, F004) — a helper on the task
-- from then on, so the record shows who handed it over instead of only "Add a helper". The follow (notify.follow)
-- stays as it was.
create or replace function work.task_delegate(p_id uuid, p_to uuid, p_note text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  t work.task := work.task_editable(p_id);
  note jsonb;
  req uuid;
begin
  if nullif(pg_catalog.btrim(p_note), '') is null then
    raise exception using errcode = 'P0001', message = 'task.delegate_note_required';
  end if;
  if p_to is null or not work.person_ok(p_to) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p_to::text;
  end if;
  if p_to = me then
    raise exception using errcode = 'P0001', message = 'task.delegate_to_yourself';
  end if;
  if not authz.can_see_as(p_to, 'work.task', p_id) then
    raise exception using errcode = 'P0001', message = 'task.delegate_cannot_see', detail = p_to::text;
  end if;
  req := audit.begin('ui', 'task.delegated', pg_catalog.jsonb_build_object('number', t.number));
  perform work.tasks_assign(array[p_id], p_to, p_note);
  note := core.note_add('task', p_id, 'update', p_note);
  insert into notify.follow (person_id, entity_table, entity_id) values (me, 'work.task', p_id)
    on conflict do nothing;
  if not exists (select 1 from work.task_helper h
                 where h.task_id = p_id and h.person_id = me and h.deleted_at is null) then
    insert into work.task_helper (task_id, person_id) values (p_id, me);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'note_id', note ->> 'id', 'owner_id', p_to);
end
$$;
comment on function work.task_delegate(uuid, uuid, text) is
  'Phase 1: delegate a task — owner change via work.tasks_assign, note via core.note_add, delegator follows and is listed as a helper (FIX-40).';

-- (6) partner.partners_list: the row carries `created_at` (FIX-01, D28) — the stable sort tie-break (added-at + id)
-- for the partners lists. Nothing else in the read changes.
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
        and (f ->> 'stale' is null or (partner.stale_on(b.id) <= core.riyadh_today()) = (f ->> 'stale')::boolean)
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
          'last_activity_on', partner.last_activity_on(h.id), 'flags', partner.flags(h.id, me, v_side),
          'archived', h.archived_at is not null, 'version', h.version, 'created_at', h.created_at)
          order by pg_catalog.lower(h.trade_name_en), h.id)
        from (select * from hit order by pg_catalog.lower(hit.trade_name_en), hit.id
              limit greatest(1, least(coalesce(p_limit, 100), 500)) offset greatest(coalesce(p_offset, 0), 0)) h), '[]'::jsonb)));
end
$$;

-- ============================================================================ 7. Renewal task (CTR-04)
-- A renewal task is the contract's account manager's work, not the presser's own: under P1b the creator
-- may name an owner on work they create, but a renewal is made FOR the account manager, so naming them
-- still needs tasks.assign. Without this gate the member case in CTR-04 ("making it for its owner needs
-- Assign, as any task") would be allowed by the new task_create door. Copied from 20261007085200
-- exactly otherwise.
create or replace function work.contract_renewal_task(p_contract uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  c partner.contract;
  req uuid;
  t jsonb;
begin
  select * into c from partner.contract k where k.id = p_contract and k.deleted_at is null;
  if c.id is null or not authz.can_see_as(me, 'partner.contract', c.id) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.side_writable(c.partner_id, c.side);
  if c.end_on is null then
    raise exception using errcode = 'P0001', message = 'contract.renewal_needs_end_date';
  end if;
  if exists (select 1 from work.task k join work.task_status s on s.id = k.status_id
             where k.id = c.renewal_task_id and k.deleted_at is null and s.meaning not in ('done', 'cancelled')) then
    raise exception using errcode = 'P0001', message = 'contract.renewal_task_open', detail = c.renewal_task_id::text;
  end if;
  -- P1b: the renewal task belongs to the account manager, not to whoever pressed the button.
  if work.renewal_owner(c) is distinct from me and not authz.can('tasks.assign') then
    raise exception using errcode = '42501', message = 'access.needs_capability', detail = 'tasks.assign';
  end if;
  req := audit.begin('ui', 'task.renewal_created', pg_catalog.jsonb_build_object('contract', c.title));
  t := work.task_create(pg_catalog.jsonb_build_object('title', work.renewal_title(c), 'type', 'follow_up',
         'owner_id', coalesce(work.renewal_owner(c), me), 'due_on', c.end_on, 'partner_id', c.partner_id));
  update partner.contract set renewal_task_id = (t ->> 'id')::uuid, renewal_end_on = c.end_on where id = c.id;
  perform audit.end();
  return t || pg_catalog.jsonb_build_object('request_id', req);
end
$$;

select audit.end();
