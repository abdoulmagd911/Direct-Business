-- Landing 35 — the small helpers every list calls per row keep their plans (owner's live sweep, 21 Nov 2026:
-- the Tasks list, the Partners list, My Day and search each took seconds for a few dozen rows).
--
-- The cause: these helpers are SQL-language functions with a pinned search_path (SEC-01), so Postgres can neither
-- fold them into the calling query nor keep their plan — it parses and plans the body again on EVERY call, and a
-- list calls them several times per row. Measured on the profiling database: work.last_activity_on 0.9 ms a
-- call (twice per task), work.task_flags, work.task_is_past and work.is_past four times per task,
-- partner.stale_on, partner.side_on and partner.status_of several times per organisation.
--
-- The move: each body below is the body it replaces, WORD FOR WORD, returned from plpgsql — which plans a
-- statement once per connection and keeps the plan. `#variable_conflict use_column` keeps the SQL-function rule
-- for a name that is both a parameter and a column (the column wins). Every body answers at most one row (an
-- aggregate, an EXISTS, a single expression, a key lookup or LIMIT 1), so "the first row" and "the row" are the
-- same. Same signatures, same volatility, same SECURITY DEFINER, same search_path, same grants.

create or replace function work.last_activity_on(p_task uuid) returns date
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select pg_catalog.max(d) from (
        select t.happened_on as d from work.task t where t.id = p_task
        union all select pg_catalog.max(n.happened_on) from core.note n
          where n.entity_table = 'work.task' and n.entity_id = p_task and n.deleted_at is null
        union all select pg_catalog.max(greatest(a.happened_on, a.done_on)) from work.action_item a
          where a.task_id = p_task and a.deleted_at is null
        union all select pg_catalog.max(c.happened_on) from work.task_status_change c
          where c.task_id = p_task and c.deleted_at is null) x
  );
end
$fn$;

create or replace function work.task_is_past(t work.task) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select t.origin = 'backfill'
          or (work.is_past(t.happened_on)
              and (t.owner_id is null or (t.closed_at is not null and work.is_past(core.riyadh_day(t.closed_at)))))
  );
end
$fn$;

create or replace function work.is_past(p_on date) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
    select coalesce(p_on < nullif(core.setting_at('app.go_live_on', null, core.riyadh_today()) #>> '{}', '')::date, false)
  );
end
$fn$;

create or replace function work.task_flags(t work.task) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
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
  );
end
$fn$;

create or replace function work.task_row(t work.task, p_reader uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select pg_catalog.jsonb_build_object(
        'id', t.id, 'number', t.number, 'title', t.title, 'owner_id', t.owner_id, 'team_id', t.team_id,
        'priority', pr.key, 'priority_en', pr.name_en, 'priority_ar', pr.name_ar, 'executive_directive', pr.meaning is not null,
        'status', s.key, 'status_en', s.name_en, 'status_ar', s.name_ar, 'meaning', s.meaning,
        'type', ty.key, 'type_en', ty.name_en, 'type_ar', ty.name_ar, 'work_type', t.work_type,
        'start_on', t.start_on, 'due_on', t.due_on, 'partner_id', t.partner_id, 'project_id', t.project_id,
        'origin', t.origin, 'happened_on', t.happened_on, 'logged_at', t.logged_at, 'closed_at', t.closed_at,
        'blocked_reason', t.blocked_reason, 'blocked_on', t.blocked_on, 'cancelled_reason', t.cancelled_reason, 'version', t.version,
        'starred', t.starred, 'dismissed_from_nudge', t.dismissed_from_nudge,
        'has_achievement', exists (select 1 from perf.achievement a
                                   where a.source_task_id = t.id and a.deleted_at is null),
        'achievement_id', ach.id, 'achievement_number', ach.number, 'achievement_title', ach.title,
        'escalated', t.escalated, 'escalated_at', t.escalated_at, 'escalated_by', t.escalated_by,
        'escalated_to', t.escalated_to,
        'escalated_note', esc.body,
        'can_edit', work.can_edit_task(p_reader, t),
        'open_action_items', (select pg_catalog.count(*)::int from work.action_item a
                              where a.task_id = t.id and a.deleted_at is null and a.done_on is null),
        'helpers', coalesce((select pg_catalog.jsonb_agg(h.person_id order by h.created_at, h.person_id)
                             from work.task_helper h where h.task_id = t.id and h.deleted_at is null), '[]'::jsonb)
      ) || work.task_flags(t)
      from work.task_status s
      left join work.priority pr on pr.id = t.priority_id
      left join work.task_type ty on ty.id = t.type_id
      left join lateral (select a.id, a.number, a.title
                         from perf.achievement a
                         where a.source_task_id = t.id and a.deleted_at is null
                           and perf.sees_achievement(p_reader, a)
                         order by a.logged_at, a.id limit 1) ach on true
      left join lateral (select n.body
                         from core.note n
                         where n.entity_table = 'work.task' and n.entity_id = t.id
                           and n.kind = 'escalation' and n.deleted_at is null
                         order by n.created_at desc, n.id desc limit 1) esc on true
      where s.id = t.status_id
  );
end
$fn$;

create or replace function work.can_edit_task(p_person uuid, t work.task) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select case work.row_level('work.task', t.id, p_person)
               when 'full' then true
               when 'own' then p_person = t.owner_id or p_person = t.created_by
               else false end
  );
end
$fn$;

create or replace function work.in_my_work(t work.task, p_person uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select t.owner_id = p_person
          or exists (select 1 from work.action_item a where a.task_id = t.id and a.deleted_at is null and a.owner_id = p_person)
          or exists (select 1 from work.task_helper h where h.task_id = t.id and h.deleted_at is null and h.person_id = p_person)
          or exists (select 1 from work.action_item a join work.action_item_helper h on h.action_item_id = a.id
                     where a.task_id = t.id and a.deleted_at is null and h.deleted_at is null and h.person_id = p_person)
  );
end
$fn$;

create or replace function work.sees_department(p_person uuid, p_department uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select coalesce((
        select coalesce(r.is_admin, false) or p.department_id = p_department
               or exists (select 1 from core.person_department pd
                          where pd.person_id = p.id and pd.department_id = p_department and pd.deleted_at is null)
        from core.person p left join core.role r on r.id = p.role_id
        where p.id = p_person), false)
  );
end
$fn$;

create or replace function work.can_comment(p_person uuid, t work.task) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select authz.can_see_as(p_person, 'work.task', t.id)
             and authz.level_of(p_person, 'tasks') >= 'own'
  );
end
$fn$;

create or replace function core.logged_late(p_happened_on date, p_logged_at timestamp with time zone) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select coalesce(core.riyadh_day(p_logged_at) - p_happened_on
                        > coalesce((core.setting_at('work.late_days', null, core.riyadh_day(p_logged_at)) #>> '{}')::int, 14)
                      and p_happened_on >= nullif(core.setting_at('app.go_live_on', null, core.riyadh_today()) #>> '{}', '')::date,
                      false)
  );
end
$fn$;

create or replace function core.riyadh_day(t timestamp with time zone) returns date
language plpgsql immutable parallel safe set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
    select (t at time zone 'Asia/Riyadh')::date
  );
end
$fn$;

create or replace function core.person_available(p_person uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select exists (select 1 from core.person p
                     where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
                       and p.account <> 'test_account'
                       and (p.left_on is null or p.left_on > core.riyadh_today()))
  );
end
$fn$;

create or replace function core.is_team_member(p_person uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select exists (select 1 from core.person p
                     where p.id = p_person and p.kind = 'staff' and p.account = 'team_member' and p.deleted_at is null)
  );
end
$fn$;

create or replace function authz.is_settings_page(p_page text) returns boolean
language plpgsql immutable parallel safe set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
    select p_page like 'settings.%' and p_page <> 'settings.profile'
  );
end
$fn$;

create or replace function partner.side_page(p_side text) returns text
language plpgsql immutable parallel safe set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
    select case p_side when 'client' then 'clients' when 'supplier_partner' then 'suppliers_partners' end
  );
end
$fn$;

create or replace function partner.side_on(p_partner uuid, p_side text, p_on date DEFAULT NULL::date) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select exists (select 1 from partner.partner_side s
                     where s.partner_id = p_partner and s.side = p_side and s.deleted_at is null
                       and (s.since is null or s.since <= coalesce(p_on, core.riyadh_today()))
                       and (s.until is null or s.until > coalesce(p_on, core.riyadh_today())))
  );
end
$fn$;

create or replace function partner.status_of(p_partner uuid, p_side text, p_on date DEFAULT NULL::date) returns text
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select s.status from partner.side_status_change s
      where s.partner_id = p_partner and s.side = p_side and s.deleted_at is null
        and s.effective_on <= coalesce(p_on, core.riyadh_today())
      order by s.effective_on desc, s.created_at desc limit 1
  );
end
$fn$;

create or replace function partner.level_of(p_person uuid, p_partner uuid, p_side text DEFAULT NULL::text) returns core.level
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select case
               when p_side is not null then authz.level_of(p_person, partner.side_page(p_side))
               else coalesce(
                 (select pg_catalog.max(authz.level_of(p_person, partner.side_page(s.side))) from partner.partner_side s
                  where s.partner_id = p_partner and s.deleted_at is null and partner.side_on(p_partner, s.side)),
                 greatest(authz.level_of(p_person, 'clients'), authz.level_of(p_person, 'suppliers_partners')))
             end
  );
end
$fn$;

create or replace function partner.sees_side(p_person uuid, p_partner uuid, p_side text) returns boolean
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
    select partner.level_of(p_person, p_partner, p_side) >= 'view'
  );
end
$fn$;

create or replace function partner.side_json(p_partner uuid, p_side text) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select pg_catalog.jsonb_build_object(
               'id', s.id, 'side', s.side, 'on', partner.side_on(p_partner, s.side), 'type_id', s.type_id, 'type', t.key,
               'tier_id', s.tier_id, 'fields', s.field_values, 'since', s.since, 'until', s.until, 'version', s.version,
               'status', partner.status_of(p_partner, s.side),
               'owner_id', (select x from partner.side_owners(p_partner, s.side) x limit 1))
      from partner.partner_side s join partner.side_type t on t.id = s.type_id
      where s.partner_id = p_partner and s.side = p_side and s.deleted_at is null
  );
end
$fn$;

create or replace function partner.stale_on(p_partner uuid) returns date
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select case when p.archived_at is null and p.deleted_at is null
                       and exists (select 1 from partner.partner_side s where s.partner_id = p.id and s.deleted_at is null
                                   and partner.side_on(p.id, s.side)
                                   and partner.status_of(p.id, s.side) is distinct from 'lost')
                  then greatest(coalesce(a.last_on, sd.since_on)
                                  + coalesce((core.setting_at('partner.stale_after_days', null, core.riyadh_today()) #>> '{}')::int, 21),
                                a.next_on + 1) end
      from partner.partner p
      left join lateral (
        select pg_catalog.max(n.happened_on) as last_on,
               pg_catalog.max(case when t.id is null then n.next_step_on
                                   when t.closed_at is null and t.deleted_at is null
                                     then greatest(n.next_step_on, core.riyadh_today()) end) as next_on
        from core.note n left join work.task t on t.id = n.next_step_task_id
        where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.kind = 'activity' and n.deleted_at is null) a
        on true
      left join lateral (select pg_catalog.min(s.since) as since_on from partner.partner_side s
                         where s.partner_id = p.id and s.deleted_at is null and partner.side_on(p.id, s.side)) sd on true
      where p.id = p_partner
  );
end
$fn$;

create or replace function partner.last_activity_on(p_partner uuid) returns date
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      -- an activity logged on it, or a task on it created or done (D5); past work does not count (V491)
      select pg_catalog.max(x.d) from (
        select pg_catalog.max(n.happened_on) as d from core.note n
        where n.entity_table = 'partner.partner' and n.entity_id = p_partner and n.kind = 'activity' and n.deleted_at is null
        union all
        select pg_catalog.max(greatest(core.riyadh_day(t.created_at), core.riyadh_day(t.closed_at)))
        from work.task t where t.partner_id = p_partner and t.deleted_at is null and not work.task_is_past(t)) x
  );
end
$fn$;

create or replace function partner.flags(p_partner uuid, p_person uuid, p_side text DEFAULT NULL::text) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select coalesce(pg_catalog.jsonb_agg(x.flag order by x.pri), '[]'::jsonb)
      from (select 'stale' as flag, 1 as pri where partner.stale_on(p_partner) <= core.riyadh_today()
            union all
            select 'contract_expiring', 2 where exists (
              select 1 from partner.contract k
              where k.partner_id = p_partner and k.deleted_at is null and (p_side is null or k.side = p_side)
                and partner.side_on(p_partner, k.side) and partner.sees_side(p_person, p_partner, k.side)
                and partner.contract_state(k.start_on, k.end_on) ->> 'status' = 'expiring')) x
  );
end
$fn$;

create or replace function partner.owner_seen_by(p_partner uuid, p_person uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select o from partner.partner_side s cross join lateral partner.side_owners(p_partner, s.side) o
      where s.partner_id = p_partner and s.deleted_at is null and partner.sees_side(p_person, p_partner, s.side)
      order by s.side limit 1
  );
end
$fn$;

create or replace function partner.contract_state(p_start date, p_end date, p_on date DEFAULT NULL::date) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select pg_catalog.jsonb_build_object(
        'status', case when p_start > x.d then 'not_started'
                       when p_end < x.d then 'expired'
                       when p_end - x.d <= coalesce((core.setting_at('partner.contract_expiring_from_days', null, x.d) #>> '{}')::int, 30)
                         then 'expiring'
                       else 'active' end,
        'days_left', p_end - x.d)
      from (select coalesce(p_on, core.riyadh_today()) as d) x
  );
end
$fn$;

create or replace function finance.item_head(p_name text) returns text
language plpgsql immutable set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
    select norm.fold(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_name, ''), '\s[-–—|]\s.*$', '')))
  );
end
$fn$;

create or replace function finance.item_tail(p_name text) returns text
language plpgsql immutable set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
    select norm.fold(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_name, ''), '^.*\s[-–—|]\s', '')))
  );
end
$fn$;

create or replace function finance.code_state(p_valid_from date, p_valid_to date) returns text
language plpgsql stable parallel safe set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select case
               when p_valid_to is not null and p_valid_to < core.riyadh_today() then 'expired'
               when p_valid_from is not null and p_valid_from > core.riyadh_today() then 'inactive'
               else 'active' end
  );
end
$fn$;

create or replace function notify.changed_fields(p_kind text, p_request uuid, p_table text, p_id uuid, p_person uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return (
      select coalesce(pg_catalog.jsonb_agg(distinct f), '[]'::jsonb)
      from audit.change c cross join lateral pg_catalog.unnest(c.fields) f
      where p_kind in ('changed_by_other', 'followed_change')
        and p_table is not null and authz.can_see_as(p_person, p_table, p_id)
        and c.request_id = p_request and c.table_name = p_table and c.row_id = p_id and c.action = 'update'
        and f not in ('id', 'version') and f not like '%\_at' and f not like '%\_by'
  );
end
$fn$;

create or replace function partner.side_owners(p_partner uuid, p_side text) returns SETOF uuid
language plpgsql stable security definer set search_path = '' as $fn$
#variable_conflict use_column
begin
  return query
      select m.person_id from partner.side_owner m
      where m.partner_id = p_partner and m.deleted_at is null and (p_side is null or m.side = p_side)
        and m.effective_from <= core.riyadh_today() and (m.effective_to is null or m.effective_to > core.riyadh_today())
        and authz.level_of(m.person_id, partner.side_page(m.side)) >= 'view';
end
$fn$;
