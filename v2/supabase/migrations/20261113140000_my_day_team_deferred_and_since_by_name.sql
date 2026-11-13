-- D-myday (13 Nov): My team's deferred notes and "What's new" follow the team tab's own rule.
--   * my.my_day 'deferred' on the My team tab repeated in_scope's conditions with the date flipped, but an older copy of
--     them: it left out what My team shows an admin (the team notes of every team, V642) and a note shared with the
--     reader by name (V524), so such a note carried to a later day was on no list at all. It now asks the same who-rule
--     as my.in_scope, word for word, with the date flipped.
--   * 'since' counted a note shared with the reader by name as a note "for everyone" (any visibility other than team
--     fell to workspace_notes). It is now its own kind, shared_notes ("shared with you"); team and workspace notes are
--     counted as before.
-- my_day is copied from 20261109000016_my_day_deferred_and_reminder_delete.sql, exactly otherwise; the signature, its
-- grants and api.my_day are unchanged. Forward-only (V103).
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
    -- deferred: the same notes, a day still ahead — in_scope's own rule (who sees it), with the date flipped
    'deferred', coalesce((
      select pg_catalog.jsonb_agg(my.note_row(y.n, me) order by y.d desc, y.at desc, y.id)
      from (select n as n, coalesce(n.carried_to, n.happened_on) as d, n.logged_at as at, n.id
            from my.note n
            where n.deleted_at is null and n.done_at is null
              and coalesce(n.carried_to, n.happened_on) > core.riyadh_today()
              and not my.captured_as_reminder(n.id)
              and case scope
                    when 'me' then n.person_id = me
                    when 'team' then n.person_id <> me
                                     and ((n.visibility = 'team'
                                           and (my.team_sees(n.person_id, me)
                                                or exists (select 1 from core.person p join core.role r on r.id = p.role_id
                                                           where p.id = me and r.is_admin)))
                                          -- V524: a note shared with the reader by name sits with their team's notes
                                          or (n.visibility = 'person' and me = any(n.shared_with)))
                    else n.person_id <> me and n.visibility = 'workspace' end
              and my.note_visible(n.id, me)
            order by 2 desc, 3 desc, 4 limit lim) y), '[]'::jsonb),
    'notes_total', (select pg_catalog.count(*)::int from my.note n
                    where my.in_scope(n, scope, me) and not my.captured_as_reminder(n.id)),
    'more', exists (select 1 from my.note n
                    where my.in_scope(n, scope, me) and not my.captured_as_reminder(n.id) offset off + lim),
    'since', case when p_since is null then '[]'::jsonb else coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind', x.kind, 'count', x.k) order by x.kind)
      from (select case n.visibility when 'team' then 'team_notes' when 'person' then 'shared_notes'
                                     else 'workspace_notes' end as kind,
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
