-- Phase 6 — the Thursday review list: the unlogged closed tasks, the Thursday 11:00 bell, and the one-off backfill.
-- (a) work.weekly_unlogged_list / api.weekly_unlogged — my closed tasks with no achievement linked by
--     source_task_id: this week's on top, then older ones below, capped at 50, nudge-eligible by default (linked
--     to a partner, or priority the top value 'High'); a task dismissed with "Not an achievement", or put off with
--     "Later" until a Thursday still ahead, stays out until then. (b) notify.alert_weekly_unlogged — one bell item
--     per person per week, guarded inside the function to Thursdays in Riyadh and to the hour of the nudge time read
--     from settings (nudge.weekly_time, default 11:00), fired by the hourly Thursday pg_cron job
--     notify-weekly-unlogged, which calls notify.generate_alerts() like the daily job. (c)
--     api.backfill_proposals / api.backfill_confirm — the one-off confirmation list: same owner, exact title
--     (case-insensitive, trimmed), achievement within 7 days after the task closed; confirming sets source_task_id,
--     never silently. Forward-only (V103): nothing already on v2/main is edited here.

-- ================================================================ "Later" until next Thursday
alter table work.task add column nudge_later_until date;
comment on column work.task.nudge_later_until is
  'Phase 6: "Later" on a weekly-review row — the task leaves the unlogged list until the next Thursday.';

-- ================================================================ the unlogged list
-- My closed tasks with no achievement linked by source_task_id, mine only (V454): this week's closed tasks on top,
-- then older unlogged closed tasks below. Nudge-eligible by default: linked to a partner, or priority the top value
-- 'High' ("has a KPI" is dropped — no task→KPI link exists); the filter is evaluated at list time, so a task that
-- gains a partner later re-enters. The done window is the same one my.weekly_review uses (done_meaning, the Riyadh
-- day of closed_at inside the week holding today). The api wrapper caps the rows at 50.
create function work.weekly_unlogged_list(p_person uuid, p_show_routine boolean default false)
returns table(task_id uuid, task_number text, title text, closed_at timestamptz, owner_id uuid, day date,
              this_week boolean, partner_id uuid, partner_name_en text, partner_name_ar text, routine boolean)
language sql stable security definer set search_path = ''
as $$
  with wk as (
    select my.week_start(core.riyadh_today()) as from_day
  ), done_meaning as (
    select s.id from work.task_status s where s.meaning = 'done' and s.deleted_at is null limit 1
  ), rows as (
    select t.id, t.number, t.title, t.closed_at, t.owner_id, core.riyadh_day(t.closed_at) as closed_day,
           t.partner_id, p.trade_name_en, p.trade_name_ar,
           (t.partner_id is not null or pr.key = 'high') as eligible
    from work.task t
    left join partner.partner p on p.id = t.partner_id
    left join work.priority pr on pr.id = t.priority_id
    where t.owner_id = p_person and t.deleted_at is null and t.closed_at is not null
      and t.status_id = (select id from done_meaning)
      and not t.dismissed_from_nudge
      and (t.nudge_later_until is null or t.nudge_later_until <= core.riyadh_today())
      and not exists (select 1 from perf.achievement a where a.source_task_id = t.id and a.deleted_at is null)
      and (p_show_routine or t.partner_id is not null or pr.key = 'high')
  )
  select r.id, r.number, r.title, r.closed_at, r.owner_id, r.closed_day,
         r.closed_day between (select from_day from wk) and (select from_day from wk) + 6,
         r.partner_id, r.trade_name_en, r.trade_name_ar, not r.eligible
  from rows r
  order by r.closed_day between (select from_day from wk) and (select from_day from wk) + 6 desc,
           r.closed_at desc, r.number
$$;
comment on function work.weekly_unlogged_list(uuid, boolean) is
  'Phase 6: my closed tasks with no achievement linked by source_task_id — this week''s on top, then older ones below.';

create function work.weekly_unlogged(p_show_routine boolean default false) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
begin
  return pg_catalog.jsonb_build_object(
           'total', (select pg_catalog.count(*)::int from work.weekly_unlogged_list(me, p_show_routine)),
           'rows', coalesce((
             select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                      'task_id', x.task_id, 'task_number', x.task_number, 'title', x.title,
                      'closed_at', x.closed_at, 'owner_id', x.owner_id, 'day', x.day,
                      'this_week', x.this_week, 'partner_id', x.partner_id,
                      'partner_name_en', x.partner_name_en, 'partner_name_ar', x.partner_name_ar,
                      'routine', x.routine)
                      order by x.this_week desc, x.closed_at desc, x.task_number)
             from (select * from work.weekly_unlogged_list(me, p_show_routine) limit 50) x), '[]'::jsonb));
end
$$;
comment on function work.weekly_unlogged(boolean) is
  'Phase 6: my unlogged closed tasks — this week''s on top, then older ones, capped at 50.';

create function api.weekly_unlogged(p_show_routine boolean default false) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select work.weekly_unlogged(p_show_routine) $$;
comment on function api.weekly_unlogged(boolean) is
  'Phase 6: my unlogged closed tasks — this week''s on top, then older ones, capped at 50.';

-- ================================================================ "Later"
-- Put a closed task off until next Thursday: the row leaves the unlogged list and resurfaces on that Thursday (the
-- list only hides tasks whose later date is still ahead). "Later" on a Thursday puts it off a full week. Whoever may
-- change the task puts it off; setting the date it already has changes nothing and logs nothing (the dismiss pattern).
create function work.task_nudge_later(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t work.task := work.task_editable(p_id);
  today date := core.riyadh_today();
  delta int := (4 - pg_catalog.date_part('dow', today)::int + 7) % 7;
  next_thu date;
  req uuid;
begin
  if delta = 0 then
    delta := 7;
  end if;
  next_thu := today + delta;
  if t.nudge_later_until = next_thu then
    return pg_catalog.jsonb_build_object('id', t.id, 'request_id', null, 'nudge_later_until', t.nudge_later_until,
                                         'version', t.version);
  end if;
  req := audit.begin('ui', 'task.nudge_later', pg_catalog.jsonb_build_object('number', t.number));
  update work.task set nudge_later_until = next_thu where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'nudge_later_until', next_thu,
                                       'version', (select x.version from work.task x where x.id = p_id));
end
$$;
comment on function work.task_nudge_later(uuid) is
  'Phase 6: put a closed task off until next Thursday — it leaves the unlogged list until then.';

create function api.task_nudge_later(p_id uuid) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_nudge_later(p_id) $$;
comment on function api.task_nudge_later(uuid) is
  'Phase 6: put a closed task off until next Thursday.';

-- ================================================================ the one-off backfill
-- Proposed matches (closed task ↔ achievement): same owner, exact title match (case-insensitive, trimmed), the
-- achievement happened within 7 days after the task closed — and the task has no achievement linked yet. One list,
-- mine only; confirming one sets source_task_id, unconfirmed ones stay unlinked, never silently.
create function work.backfill_proposals() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'task_id', x.task_id, 'task_number', x.task_number, 'task_title', x.task_title,
             'closed_day', x.closed_day, 'achievement_id', x.achievement_id,
             'achievement_number', x.achievement_number, 'achievement_title', x.achievement_title,
             'happened_on', x.happened_on)
             order by x.closed_day desc, x.task_number, x.happened_on)
    from (
      select t.id as task_id, t.number as task_number, t.title as task_title,
             core.riyadh_day(t.closed_at) as closed_day,
             a.id as achievement_id, a.number as achievement_number, a.title as achievement_title,
             a.happened_on as happened_on
      from work.task t
      join perf.achievement a on a.owner_id = t.owner_id
        and a.source_task_id is null and a.deleted_at is null
        and pg_catalog.btrim(pg_catalog.lower(a.title)) = pg_catalog.btrim(pg_catalog.lower(t.title))
        and a.happened_on between core.riyadh_day(t.closed_at) and core.riyadh_day(t.closed_at) + 7
      where t.owner_id = me and t.deleted_at is null and t.closed_at is not null
        and t.status_id = (select s.id from work.task_status s where s.meaning = 'done'
                           and s.deleted_at is null limit 1)
        and not exists (select 1 from perf.achievement a2 where a2.source_task_id = t.id and a2.deleted_at is null)
      order by core.riyadh_day(t.closed_at) desc, t.number, a.happened_on
      limit 50
    ) x), '[]'::jsonb);
end
$$;
comment on function work.backfill_proposals() is
  'Phase 6: proposed backfill matches — my closed tasks and my achievements with the same title, 7 days apart.';

create function api.backfill_proposals() returns jsonb
language sql stable security invoker set search_path = '' as $$ select work.backfill_proposals() $$;
comment on function api.backfill_proposals() is
  'Phase 6: proposed backfill matches, mine only.';

-- Confirm one proposed match: the pair must still match (same owner, exact title, achievement within 7 days after
-- the task closed), the achievement must still be unlinked, and the task must still be done. Confirming sets
-- source_task_id; anything that no longer matches raises backfill.no_match and links nothing.
create function work.backfill_confirm(p_task_id uuid, p_achievement_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require('kpis', 'own');
  t work.task;
  a perf.achievement;
  done_id uuid := (select s.id from work.task_status s where s.meaning = 'done' and s.deleted_at is null limit 1);
  req uuid;
begin
  select * into t from work.task where id = p_task_id and deleted_at is null;
  if t.id is null or t.owner_id is distinct from me then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'work.task';
  end if;
  select * into a from perf.achievement where id = p_achievement_id and deleted_at is null;
  if a.id is null or a.owner_id is distinct from me then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'perf.achievement';
  end if;
  if t.status_id is distinct from done_id or t.closed_at is null or a.source_task_id is not null
     or a.happened_on is null
     or pg_catalog.btrim(pg_catalog.lower(a.title)) is distinct from pg_catalog.btrim(pg_catalog.lower(t.title))
     or a.happened_on not between core.riyadh_day(t.closed_at) and core.riyadh_day(t.closed_at) + 7 then
    raise exception using errcode = 'P0001', message = 'backfill.no_match';
  end if;
  req := audit.begin('ui', 'achievement.backfill_linked', pg_catalog.jsonb_build_object('number', t.number));
  update perf.achievement set source_task_id = p_task_id where id = p_achievement_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_achievement_id, 'request_id', req, 'source_task_id', p_task_id);
end
$$;
comment on function work.backfill_confirm(uuid, uuid) is
  'Phase 6: confirm one backfill match — sets source_task_id on the achievement.';

create function api.backfill_confirm(p_task_id uuid, p_achievement_id uuid) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select work.backfill_confirm(p_task_id, p_achievement_id) $$;
comment on function api.backfill_confirm(uuid, uuid) is
  'Phase 6: confirm one backfill match.';

-- ================================================================ the Thursday bell
-- One bell item per person per week: the alert answers only on a Thursday in Riyadh, only in the hour of the nudge
-- time read from settings (nudge.weekly_time, default 11:00 — never hard-coded here), and only when the person has
-- unlogged closed tasks. The key carries the Thursday, so the generate_alerts dedup (one per person, key and day)
-- makes at most one item per week even when the hourly job runs again in the same hour.
create function notify.alert_weekly_unlogged() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  select p.id,
         'weekly_unlogged:' || core.riyadh_today(),
         null::text, null::uuid,
         'alert.weekly_unlogged',
         pg_catalog.jsonb_build_object(
           'count', (select pg_catalog.count(*)::int from work.weekly_unlogged_list(p.id)))
  from core.person p
  where p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
    and pg_catalog.date_part('dow', core.riyadh_today()) = 4
    and pg_catalog.date_part('hour', core.clock() at time zone 'Asia/Riyadh')
        = pg_catalog.split_part(coalesce(core.setting_at('nudge.weekly_time', null, core.riyadh_today()) #>> '{}',
                                         '11:00'), ':', 1)::int
    and exists (select 1 from work.weekly_unlogged_list(p.id))
$$;
comment on function notify.alert_weekly_unlogged() is
  'Phase 6: on Thursdays in the nudge hour, one bell item per person with unlogged closed tasks.';

-- ================================================================ the notification kind, re-issued with the new kind
alter table notify.notification drop constraint notification_kind_check;
alter table notify.notification add constraint notification_kind_check check (kind in (
  'assigned', 'helper_added', 'mentioned', 'changed_by_other', 'followed_change', 'decision_needed', 'report_issued',
  'report_for_review', 'appraisal_step', 'import_done', 'alert_contract_expiring', 'alert_kpi_behind',
  'alert_invoice_unpaid', 'alert_kpi_checkin', 'escalated', 'alert_quiet_client', 'alert_project_no_update',
  'alert_activity_stale', 'alert_file_review', 'reminder', 'note_mention', 'alert_contact_reconfirm',
  'alert_due_tomorrow', 'task_commented', 'commented', 'asked', 'escalation_acknowledged', 'alert_weekly_unlogged'));

-- ================================================================ the hourly Thursday job
-- The bell cannot ride the daily 06:00 job (the decision says 11:00 Riyadh): this job runs hourly on Thursdays and
-- calls notify.generate_alerts(), which asks every notify.alert_*() function — the Thursday and time guards live in
-- the alert function itself, so the job carries no time of its own.
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('notify-weekly-unlogged', '0 * * * 4', 'select notify.generate_alerts()');
  end if;
end $$;

-- ================================================================ the doors (V124)
revoke all on function work.weekly_unlogged_list(uuid, boolean), work.weekly_unlogged(boolean),
  api.weekly_unlogged(boolean),
  work.task_nudge_later(uuid), api.task_nudge_later(uuid),
  work.backfill_proposals(), api.backfill_proposals(),
  work.backfill_confirm(uuid, uuid), api.backfill_confirm(uuid, uuid) from public;
grant execute on function work.weekly_unlogged_list(uuid, boolean), work.weekly_unlogged(boolean),
  api.weekly_unlogged(boolean),
  work.task_nudge_later(uuid), api.task_nudge_later(uuid),
  work.backfill_proposals(), api.backfill_proposals(),
  work.backfill_confirm(uuid, uuid), api.backfill_confirm(uuid, uuid) to authenticated;
