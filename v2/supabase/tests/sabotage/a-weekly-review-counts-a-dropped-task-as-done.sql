-- Sabotage: a-weekly-review-counts-a-dropped-task-as-done
-- Breaks: sql:WREV-01
-- Expect: done: the finished task and note, never the dropped ones
-- Done counts every closed task, so a task dropped (Cancelled) in a wrap-up shows as done.
create or replace function my.weekly_review(p_day date default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
  today date := core.riyadh_today();
  wk date := my.week_start(coalesce(p_day, today));
  wk_end date := wk + 6;
  nx date := wk + 7;
  nx_end date := wk + 13;
  done_meaning uuid := (select s.id from work.task_status s where s.meaning = 'done' and s.deleted_at is null limit 1);
  cap constant int := 50;
  note_cap constant int := 7;
  v_done jsonb;
  v_slipped jsonb;
  v_next jsonb;
  v_notes jsonb;
begin
  -- done: my tasks completed this week, my notes done this week (not dropped)
  with d as (
    select 'task' as kind, t.id, t.number, t.title, core.riyadh_day(t.closed_at) as day,
           p.trade_name_en, p.trade_name_ar, my.carry_count(me, 'work.task', t.id) as times
    from work.task t
    left join partner.partner p on p.id = t.partner_id
    where t.owner_id = me and t.deleted_at is null and t.closed_at is not null
      and core.riyadh_day(t.closed_at) between wk and wk_end
    union all
    select 'note', n.id, null, my.note_line(n), core.riyadh_day(n.done_at), null, null,
           my.carry_count(me, 'my.note', n.id)
    from my.note n
    where n.person_id = me and n.deleted_at is null and n.done_at is not null
      and core.riyadh_day(n.done_at) between wk and wk_end
      and not exists (select 1 from my.carry c where c.person_id = me and c.entity_table = 'my.note'
                        and c.entity_id = n.id and c.choice = 'drop' and c.deleted_at is null)
  )
  select pg_catalog.jsonb_build_object('total', (select pg_catalog.count(*)::int from d), 'rows', coalesce((
           select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', x.kind, 'id', x.id, 'number', x.number,
                    'title', x.title, 'day', x.day, 'partner_name_en', x.trade_name_en,
                    'partner_name_ar', x.trade_name_ar, 'times', x.times) order by x.day desc, x.kind, x.title, x.id)
           from (select * from d order by day desc, kind, title, id limit cap) x), '[]'::jsonb))
  into v_done;

  -- slipped: still open, and carried over this week or overdue
  with s as (
    select 'task' as kind, t.id, t.number, t.title, t.due_on as day,
           p.trade_name_en, p.trade_name_ar, my.carry_count(me, 'work.task', t.id) as times
    from work.task t
    left join partner.partner p on p.id = t.partner_id
    where t.owner_id = me and t.deleted_at is null and t.closed_at is null and not work.task_is_past(t)
      and (t.due_on < today
           or exists (select 1 from my.carry c where c.person_id = me and c.entity_table = 'work.task'
                        and c.entity_id = t.id and c.deleted_at is null and c.choice in ('tomorrow', 'next_week')
                        and c.wrapped_on between wk and wk_end))
    union all
    select 'note', n.id, null, my.note_line(n), coalesce(n.carried_to, n.happened_on), null, null,
           my.carry_count(me, 'my.note', n.id)
    from my.note n
    where n.person_id = me and n.deleted_at is null and n.done_at is null
      and exists (select 1 from my.carry c where c.person_id = me and c.entity_table = 'my.note'
                    and c.entity_id = n.id and c.deleted_at is null and c.choice in ('tomorrow', 'next_week')
                    and c.wrapped_on between wk and wk_end)
  )
  select pg_catalog.jsonb_build_object('total', (select pg_catalog.count(*)::int from s), 'rows', coalesce((
           select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', x.kind, 'id', x.id, 'number', x.number,
                    'title', x.title, 'day', x.day, 'partner_name_en', x.trade_name_en,
                    'partner_name_ar', x.trade_name_ar, 'times', x.times) order by x.times desc, x.day, x.kind, x.id)
           from (select * from s order by times desc, day, kind, id limit cap) x), '[]'::jsonb))
  into v_slipped;

  -- next: my open tasks due next week, my open notes carried to next week
  with n2 as (
    select 'task' as kind, t.id, t.number, t.title, t.due_on as day,
           p.trade_name_en, p.trade_name_ar, my.carry_count(me, 'work.task', t.id) as times
    from work.task t
    left join partner.partner p on p.id = t.partner_id
    where t.owner_id = me and t.deleted_at is null and t.closed_at is null and not work.task_is_past(t)
      and t.due_on between nx and nx_end
    union all
    select 'note', n.id, null, my.note_line(n), n.carried_to, null, null, my.carry_count(me, 'my.note', n.id)
    from my.note n
    where n.person_id = me and n.deleted_at is null and n.done_at is null and n.carried_to between nx and nx_end
  )
  select pg_catalog.jsonb_build_object('total', (select pg_catalog.count(*)::int from n2), 'rows', coalesce((
           select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', x.kind, 'id', x.id, 'number', x.number,
                    'title', x.title, 'day', x.day, 'partner_name_en', x.trade_name_en,
                    'partner_name_ar', x.trade_name_ar, 'times', x.times) order by x.day, x.kind, x.title, x.id)
           from (select * from n2 order by day, kind, title, id limit cap) x), '[]'::jsonb))
  into v_next;

  -- my notes this week, newest first: a short list
  select pg_catalog.jsonb_build_object(
           'total', (select pg_catalog.count(*)::int from my.note n
                     where n.person_id = me and n.deleted_at is null and n.happened_on between wk and wk_end),
           'rows', coalesce((
             select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', y.id, 'kind', y.kind, 'idea', y.idea,
                      'title', my.note_line(y), 'visibility', y.visibility, 'day', y.happened_on,
                      'done', y.done_at is not null) order by y.happened_on desc, y.logged_at desc, y.id)
             from (select * from my.note n
                   where n.person_id = me and n.deleted_at is null and n.happened_on between wk and wk_end
                   order by n.happened_on desc, n.logged_at desc, n.id limit note_cap) y), '[]'::jsonb))
  into v_notes;

  return pg_catalog.jsonb_build_object(
    'today', today, 'week', pg_catalog.jsonb_build_object('from', wk, 'to', wk_end),
    'next_week', pg_catalog.jsonb_build_object('from', nx, 'to', nx_end),
    'done', v_done, 'slipped', v_slipped, 'next', v_next, 'notes', v_notes);
end
$$;

