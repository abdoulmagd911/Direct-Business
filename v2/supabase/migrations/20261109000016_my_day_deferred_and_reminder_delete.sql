-- Landing 3 (FIX-27, D21): deferred notes and the reminder that outlives its note.
--   * my.my_day gains a 'deferred' list: my notes (same scope and visibility as the main list, same
--     cap) whose day — carried_to, else happened_on — is still ahead of today. my.in_scope excludes
--     those by design, so the deferred list repeats its conditions with the date flipped rather than
--     calling it; a note captured as a reminder stays out, as in the main list.
--   * my.note_row gains 'has_pending_reminder': the note has a reminder of the reader's that has not
--     been sent yet (sent_at is null) and is not deleted. A reminder already sent has fired; deleting
--     the note does not offer to delete it.
--   * my.my_notes_remove gains p_delete_reminders (default false): when true, the note's pending
--     reminders are soft-deleted in the same request. Removing a note never silently deletes its
--     reminder — the screen offers it as an unchecked choice (D21). The api door is re-issued with the
--     new parameter; the old signature is dropped first, as a new parameter is a new signature.
-- my_day is copied from 20261014232000, note_row from 20261031090000, my_notes_remove from
-- 20260930172400, each exactly otherwise. Forward-only (V103).
create or replace function my.my_day(p_scope text default 'me', p_limit int default 7, p_offset int default 0,
                          p_since timestamptz default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.require('my_day', 'view');
  scope text := coalesce(p_scope, 'me');
  lim int := greatest(1, least(coalesce(p_limit, 7), 200));
  off int := greatest(coalesce(p_offset, 0), 0);
begin
  if scope not in ('me', 'team', 'workspace') then
    raise exception using errcode = 'P0001', message = 'my_day.scope_invalid', detail = scope;
  end if;
  return pg_catalog.jsonb_build_object(
    'scope', scope, 'day', core.riyadh_today(),
    'notes', coalesce((
      select pg_catalog.jsonb_agg(my.note_row(y.n, me) order by y.d desc, y.at desc, y.id)
      from (select n as n, coalesce(n.carried_to, n.happened_on) as d, n.logged_at as at, n.id
            from my.note n where my.in_scope(n, scope, me) and not my.captured_as_reminder(n.id)
            order by 2 desc, 3 desc, 4 limit lim offset off) y), '[]'::jsonb),
    -- deferred: the same notes, a day still ahead — in_scope's own date rule, flipped
    'deferred', coalesce((
      select pg_catalog.jsonb_agg(my.note_row(y.n, me) order by y.d desc, y.at desc, y.id)
      from (select n as n, coalesce(n.carried_to, n.happened_on) as d, n.logged_at as at, n.id
            from my.note n
            where n.deleted_at is null and n.done_at is null
              and coalesce(n.carried_to, n.happened_on) > core.riyadh_today()
              and not my.captured_as_reminder(n.id)
              and case scope
                    when 'me' then n.person_id = me
                    when 'team' then n.person_id <> me and n.visibility = 'team' and my.team_sees(n.person_id, me)
                    else n.person_id <> me and n.visibility = 'workspace' end
              and my.note_visible(n.id, me)
            order by 2 desc, 3 desc, 4 limit lim) y), '[]'::jsonb),
    'notes_total', (select pg_catalog.count(*)::int from my.note n
                    where my.in_scope(n, scope, me) and not my.captured_as_reminder(n.id)),
    'more', exists (select 1 from my.note n
                    where my.in_scope(n, scope, me) and not my.captured_as_reminder(n.id) offset off + lim),
    'since', case when p_since is null then '[]'::jsonb else coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', x.kind, 'count', x.k) order by x.kind)
      from (select case n.visibility when 'team' then 'team_notes' else 'workspace_notes' end as kind,
                   pg_catalog.count(*)::int as k
            from my.note n
            where n.person_id <> me and n.visibility <> 'private' and n.logged_at > p_since
              and (my.in_scope(n, 'team', me) or my.in_scope(n, 'workspace', me))
            group by 1) x), '[]'::jsonb) end,
    -- D3: my open tasks by their Riyadh due day — Overdue, Today, This week (to Saturday) — past work never (V491)
    'tasks', case when scope = 'me' then my.my_tasks(me) else '[]'::jsonb end,
    -- what a wrap-up carried to today (Stage 1)
    'carried_over', case when scope = 'me' then my.carried_over(me) else '[]'::jsonb end,
    'reminders', case when scope = 'me' then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', r.id, 'note_id', r.note_id, 'remind_at', r.remind_at,
               'text', r.text, 'about', (select work.about_of(n.about_table, n.about_id, me) from my.note n where n.id = r.note_id))
               order by r.remind_at, r.id)
      from (select * from core.reminder r0
            where r0.person_id = me and r0.deleted_at is null and r0.sent_at is null
            order by r0.remind_at, r0.id limit lim) r), '[]'::jsonb) else '[]'::jsonb end);
end
$$;

create or replace function my.note_row(n my.note, p_reader uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', n.id, 'kind', n.kind, 'idea', n.idea, 'capture_kind', my.capture_kind(n), 'title', n.title, 'body', n.body, 'items', n.items, 'visibility', n.visibility, 'shared_with', coalesce(pg_catalog.to_jsonb(n.shared_with), '[]'::jsonb),
    'happened_on', n.happened_on, 'logged_at', n.logged_at, 'author_id', n.person_id, 'mine', n.person_id = p_reader,
    'meeting_partner', (select pg_catalog.jsonb_build_object('id', p.id, 'number', p.number, 'trade_name_en',
                                  p.trade_name_en, 'trade_name_ar', p.trade_name_ar)
                        from partner.partner p
                        where p.id = n.meeting_partner_id and authz.can_see_as(p_reader, 'partner.partner', p.id)),
    'about', work.about_of(n.about_table, n.about_id, p_reader),
    'meeting_on', n.meeting_on, 'finished_at', n.finished_at,
    'carried_to', n.carried_to, 'done_at', n.done_at, 'version', n.version,
    'mentions', coalesce((select pg_catalog.jsonb_agg(m.person_id order by m.created_at, m.person_id)
                          from my.note_mention m where m.note_id = n.id and m.deleted_at is null), '[]'::jsonb),
    'links', my.turned_into(n.id, p_reader),
    'task_items', (select pg_catalog.jsonb_build_object(
                     'done', pg_catalog.count(*) filter (where ai.done_on is not null), 'total', pg_catalog.count(*))
                   from my.note_link l
                   join work.action_item ai on ai.id = l.entity_id and ai.deleted_at is null
                   where l.note_id = n.id and l.entity_table = 'work.action_item' and l.deleted_at is null
                     and authz.can_see_as(p_reader, 'work.task', ai.task_id)
                   having pg_catalog.count(*) > 0),
    'has_pending_reminder', exists (select 1 from core.reminder r
                                    where r.note_id = n.id and r.person_id = p_reader
                                      and r.deleted_at is null and r.sent_at is null))
$$;

-- Reworked by the Landing 3 coordinator, 9 Nov 2026: the held copy dropped the closing paren of the
-- outer jsonb_build_object when the has_pending_reminder field was appended (the base
-- 20261031090000 ends 'having ... > 0))' — two closes). Restored here; nothing else changed.

drop function api.my_notes_remove(uuid[], text);
drop function my.my_notes_remove(uuid[], text);
create function my.my_notes_remove(p_ids uuid[], p_reason text default null, p_delete_reminders boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  i uuid;
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
    perform my.note_mine(i);
  end loop;
  req := audit.begin('ui', 'note.removed', pg_catalog.jsonb_build_object('count', pg_catalog.cardinality(p_ids)), p_reason);
  update my.note set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason where id = any (p_ids);
  get diagnostics k = row_count;
  if p_delete_reminders then
    update core.reminder set deleted_at = core.clock(), deleted_by = me, delete_reason = p_reason
    where note_id = any (p_ids) and person_id = me and deleted_at is null and sent_at is null;
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('count', k, 'request_id', req);
end
$$;

create function api.my_notes_remove(p_ids uuid[], p_reason text default null, p_delete_reminders boolean default false)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select my.my_notes_remove(p_ids, p_reason, p_delete_reminders) $$;
grant execute on function api.my_notes_remove(uuid[], text, boolean) to authenticated;
grant execute on function my.my_notes_remove(uuid[], text, boolean) to authenticated;

-- Reworked by the Landing 3 coordinator, 9 Nov 2026: the held copy granted execute on the new api
-- wrapper but not on the new my function — the foundation migration revokes default execute, so the
-- invoker api wrapper could not call it (NOTE-03 failed with "permission denied for function
-- my_notes_remove"). The old 2-arg my function carried this grant in grants.expected; the 3-arg
-- replacement carries it here.
