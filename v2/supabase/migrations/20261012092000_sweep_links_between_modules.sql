-- Sweep 12 Oct (oversight, full production sweep): the links between modules, the data half.
--  * D3: My day returns my open tasks due by the end of this week — Overdue, Today, This week — by Riyadh day, and
--    apart, Helping: those I help on.
--  * D4: search finds tasks (title or number) and invoices (number or DPIN), each within the reader's own access; it is
--    a live read, so a task is found the moment it is saved.
--  * D5: a task on a client writes an event on the client's timeline when added and when done; the card lists the
--    client's tasks for Related; Last activity counts a task added or done; Next step is the nearest of an activity's
--    next step and the due day of the nearest open task. The event is a type and its values (task_added, task_done),
--    worded by the screen; it, the timeline's count and Next step reach only readers who may see the task (QA-553).
-- The assignee's one notification is task_create's (P3-6), unchanged. Forward-only.

-- D5: an event the system writes on a record's timeline is a type and its values, not words (the screen words it in
-- Arabic and English); such a row needs no body.
alter table core.note
  add column event_type text check (event_type is null or event_type in ('task_added', 'task_done')),
  add column event_task_id uuid,
  add constraint note_event_has_task check ((event_type is null) = (event_task_id is null));
alter table core.note drop constraint note_body_required;
alter table core.note add constraint note_body_required
  check (kind = 'activity' or event_type is not null or pg_catalog.btrim(coalesce(body, '')) <> '');

-- D3 (P5-7): the open tasks due by the end of this week (Sunday to Saturday, Riyadh days — V620, D20) that a person owns
-- — the owner is the one assigned — each in its group overdue, today or this_week; and, apart, those they help on, in
-- the group helping. Past work never shows on My day (V491).
create function my.my_tasks(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', t.id, 'number', t.number, 'title', t.title, 'due_on', t.due_on, 'partner_id', t.partner_id,
           'partner_name', p.trade_name_en, 'project_id', t.project_id, 'status_id', t.status_id,
           'role', case when t.owner_id = p_person then 'owner' else 'helper' end,
           'group', case when t.owner_id is distinct from p_person then 'helping'
                         when t.due_on < d.today then 'overdue' when t.due_on = d.today then 'today' else 'this_week' end)
           order by t.owner_id is distinct from p_person, t.due_on, t.number), '[]'::jsonb)
  from (select core.riyadh_today() as today) d
  join work.task t on t.deleted_at is null and t.closed_at is null and t.due_on is not null
                  and t.due_on <= d.today + (6 - extract(dow from d.today))::int
                  and (t.owner_id = p_person
                       or exists (select 1 from work.task_helper h
                                  where h.task_id = t.id and h.person_id = p_person and h.deleted_at is null))
  left join partner.partner p on p.id = t.partner_id
  where not work.task_is_past(t)
$$;

revoke all on function my.my_tasks(uuid) from public;

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
            from my.note n where my.in_scope(n, scope, me)
            order by 2 desc, 3 desc, 4 limit lim offset off) y), '[]'::jsonb),
    'notes_total', (select pg_catalog.count(*)::int from my.note n where my.in_scope(n, scope, me)),
    'more', exists (select 1 from my.note n where my.in_scope(n, scope, me) offset off + lim),
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
    'reminders', case when scope = 'me' then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', r.id, 'note_id', r.note_id, 'remind_at', r.remind_at,
               'text', r.text) order by r.remind_at, r.id)
      from (select * from core.reminder r0
            where r0.person_id = me and r0.deleted_at is null and r0.sent_at is null
            order by r0.remind_at, r0.id limit lim) r), '[]'::jsonb) else '[]'::jsonb end);
end
$$;

create or replace function core.search(p_q text, p_limit int default 10) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  q text := norm.fold(p_q);
  lim int := greatest(1, least(coalesce(p_limit, 10), 50));
  stop text[] := partner.stop_words();
  sees_client boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if q is null or pg_catalog.length(q) < 2 then
    return pg_catalog.jsonb_build_object('partners', '[]'::jsonb, 'people', '[]'::jsonb, 'notes', '[]'::jsonb,
                                         'tasks', '[]'::jsonb, 'invoices', '[]'::jsonb);
  end if;
  sees_client := authz.level_of(me, 'clients') >= 'view';
  return pg_catalog.jsonb_build_object(
    'partners', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', y.id, 'number', y.number,
               'trade_name_en', y.trade_name_en, 'trade_name_ar', y.trade_name_ar, 'matched_by', y.matched_by)
               order by y.rank, pg_catalog.lower(y.trade_name_en))
      from (select * from (select distinct on (p.id) p.id, p.number, p.trade_name_en, p.trade_name_ar, m.matched_by, m.rank
            from partner.partner p
            join (select i.partner_id, i.kind as matched_by, 0 as rank from partner.identifier i
                  where i.deleted_at is null and (sees_client or i.kind not in ('payments_client_id', 'discount_code'))
                    and i.value_key in (norm.key('payments_client_id', p_q), norm.key('vat', p_q), norm.key('email', p_q),
                                        norm.key('phone', p_q), norm.key('discount_code', p_q), norm.key('name', p_q, stop))
                  union all
                  select p2.id, 'name', 1 from partner.partner p2
                  where norm.fold(p2.trade_name_en) like '%' || q || '%' or norm.fold(p2.trade_name_ar) like '%' || q || '%'
                     or norm.fold(p2.official_name_en) like '%' || q || '%' or norm.fold(p2.official_name_ar) like '%' || q || '%'
                  union all
                  select p3.id, 'number', 0 from partner.partner p3 where norm.fold(p3.number) = q) m on m.partner_id = p.id
            where p.deleted_at is null and p.archived_at is null and partner.level_of(me, p.id) >= 'view'
            order by p.id, m.rank) x
            order by x.rank, pg_catalog.lower(x.trade_name_en) limit lim) y), '[]'::jsonb),
    'people', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', p.id, 'full_name_en', p.full_name_en,
               'full_name_ar', p.full_name_ar, 'job_title_en', p.job_title_en) order by pg_catalog.lower(p.full_name_en))
      from (select * from core.person p0
            where p0.kind = 'staff' and p0.active and p0.deleted_at is null
              and (norm.fold(p0.full_name_en) like '%' || q || '%' or norm.fold(p0.full_name_ar) like '%' || q || '%'
                   or norm.fold(p0.nickname_en) like '%' || q || '%' or norm.fold(p0.nickname_ar) like '%' || q || '%')
            order by pg_catalog.lower(p0.full_name_en) limit lim) p), '[]'::jsonb),
    'notes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title,
               'author_id', n.person_id, 'happened_on', n.happened_on) order by n.logged_at desc, n.id)
      from (select * from my.note n0
            where n0.deleted_at is null
              and (norm.fold(n0.title) like '%' || q || '%' or norm.fold(n0.body) like '%' || q || '%')
              and my.note_visible(n0.id, me)
            order by n0.logged_at desc, n0.id limit lim) n), '[]'::jsonb),
    -- D4: tasks by title or number, each one the reader may see (live: a task is found the moment it is saved)
    'tasks', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', t.id, 'number', t.number, 'title', t.title,
               'due_on', t.due_on, 'closed', t.closed_at is not null, 'partner_id', t.partner_id)
               order by t.closed_at is not null, t.due_on nulls last, t.number)
      from (select * from work.task t0
            where t0.deleted_at is null
              and (norm.fold(t0.title) like '%' || q || '%' or norm.fold(t0.number) = q)
              and work.row_level('work.task', t0.id, me) >= 'view'
            order by t0.closed_at is not null, t0.due_on nulls last, t0.number limit lim) t), '[]'::jsonb),
    -- D4: invoices by their number or DPIN, for a reader who sees Finance (V458)
    'invoices', case when authz.level_of(me, 'finance') >= 'view'
                     then coalesce(finance.search_numbers(p_q, lim), '[]'::jsonb) else '[]'::jsonb end);
end
$$;

create or replace function partner.last_activity_on(p_partner uuid) returns date
language sql stable security definer set search_path = ''
as $$
  -- an activity logged on it, or a task on it created or done (D5); past work does not count (V491)
  select pg_catalog.max(x.d) from (
    select pg_catalog.max(n.happened_on) as d from core.note n
    where n.entity_table = 'partner.partner' and n.entity_id = p_partner and n.kind = 'activity' and n.deleted_at is null
    union all
    select pg_catalog.max(greatest(core.riyadh_day(t.created_at), core.riyadh_day(t.closed_at)))
    from work.task t where t.partner_id = p_partner and t.deleted_at is null and not work.task_is_past(t)) x
$$;

create or replace function partner.partner_get(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  p partner.partner;
  sees_client boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into p from partner.partner where id = p_id and deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.require_level(p_id, null, 'view');
  sees_client := authz.level_of(me, 'clients') >= 'view';
  return pg_catalog.to_jsonb(p) - array['deleted_at', 'deleted_by', 'delete_reason'] || pg_catalog.jsonb_build_object(
    'sides', coalesce((select pg_catalog.jsonb_agg(partner.side_json(p.id, s.side) || pg_catalog.jsonb_build_object(
        'status_history', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', c.id, 'status', c.status, 'effective_on', c.effective_on, 'reason_id', c.reason_id, 'note', c.note,
            'set_by', c.created_by, 'set_at', c.created_at) order by c.effective_on desc, c.created_at desc)
          from partner.side_status_change c where c.partner_id = p.id and c.side = s.side and c.deleted_at is null), '[]'::jsonb),
        'owners', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', m.id, 'person_id', m.person_id, 'from', m.effective_from, 'to', m.effective_to, 'reason', m.reason)
            order by m.effective_from desc)
          from partner.side_owner m where m.partner_id = p.id and m.side = s.side and m.deleted_at is null), '[]'::jsonb))
        order by s.side)
      from partner.partner_side s where s.partner_id = p.id and s.deleted_at is null
        and authz.level_of(me, partner.side_page(s.side)) >= 'view'), '[]'::jsonb),
    'identifiers', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'subkind', i.subkind, 'value', i.value_raw, 'valid_from', i.valid_from,
        'valid_to', i.valid_to, 'closed_on', i.closed_on,
        'open', i.kind <> 'payments_client_id' or i.closed_on is null or i.closed_on >= core.riyadh_today(),
        'money', case when i.kind = 'name' and i.subkind is distinct from 'alias' then 'suggest' else 'match' end,
        'source', i.source, 'reason', i.reason, 'added_by', i.created_by, 'added_at', i.created_at)
        order by i.kind, i.created_at)
      from partner.identifier i where i.partner_id = p.id and i.deleted_at is null
        and (sees_client or i.kind not in ('payments_client_id', 'discount_code'))), '[]'::jsonb),
    'owner_id', partner.owner_seen_by(p.id, me),
    'contacts', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) - array['deleted_at', 'deleted_by',
        'delete_reason', 'created_by', 'updated_by'] order by c.is_primary desc, c.name_en)
      from partner.contact c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb),
    'credit_limits', case when sees_client and authz.level_of(me, 'finance') >= 'view' then coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', c.id, 'amount_sar', c.amount_sar, 'prepaid_only', c.amount_sar = 0, 'effective_from', c.effective_from,
          'approved_by', c.approved_by, 'reason', c.reason) order by c.effective_from desc)
        from partner.credit_limit c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb) end,
    'references', partner.references(p.id),
    'last_activity_on', partner.last_activity_on(p.id),
    'stale_on', partner.stale_on(p.id),
    -- the nearest next step: an activity's, or the due day of the nearest open task on it (D5)
    'next_step', (select pg_catalog.jsonb_build_object('note_id', s.note_id, 'task_id', s.task_id, 'text', s.text, 'on', s.on_day)
                  from (select n.id as note_id, null::uuid as task_id, n.next_step as text, n.next_step_on as on_day,
                               n.logged_at as at
                        from core.note n
                        where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.kind = 'activity'
                          and n.deleted_at is null and n.next_step_on >= core.riyadh_today()
                        union all
                        select null, t.id, t.title, t.due_on, t.created_at
                        from work.task t
                        where t.partner_id = p.id and t.deleted_at is null and t.closed_at is null and t.due_on is not null
                          and not work.task_is_past(t)
                          -- a task's title reaches only those who may see the task (QA-553)
                          and work.row_level('work.task', t.id, me) >= 'view') s
                  order by s.on_day, s.at limit 1),
    -- D5: the tasks on it the reader may see, open first, for the Related list
    'tasks', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', t.id, 'number', t.number,
                         'title', t.title, 'due_on', t.due_on, 'owner_id', t.owner_id, 'closed_at', t.closed_at)
                         order by t.closed_at is not null, t.due_on nulls last, t.number)
                       from (select * from work.task t0
                             where t0.partner_id = p.id and t0.deleted_at is null
                               and work.row_level('work.task', t0.id, me) >= 'view'
                             order by t0.closed_at is not null, t0.due_on nulls last, t0.number limit 20) t), '[]'::jsonb),
    'flags', partner.flags(p.id, me),
    'counts', pg_catalog.jsonb_build_object(
      'contracts', (select pg_catalog.count(*) from partner.contract c where c.partner_id = p.id and c.deleted_at is null
                      and partner.sees_side(me, p.id, c.side)),
      'files', (select pg_catalog.count(*) from core.file_link l join core.file f on f.id = l.file_id
                where l.entity_table = 'partner.partner' and l.entity_id = p.id and l.deleted_at is null
                  and f.deleted_at is null and l.purpose <> 'logo' and authz.file_visible(f.id)),
      'notes', (select pg_catalog.count(*) from core.note n
                where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.deleted_at is null
                  and (n.event_type is null
                       or work.row_level('work.task', n.event_task_id, me) >= 'view'))));
end
$$;

create or replace function core.notes(p_entity text, p_id uuid, p_kinds text[] default null, p_limit int default 50,
                                      p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  e core.entity := core.can_see_record(p_entity, p_id);
  me uuid := authz.me();
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'body', n.body, 'happened_on', n.happened_on, 'logged_at', n.logged_at,
      'logged_late', core.logged_late(n.happened_on, n.logged_at),
      'type', t.key, 'type_en', t.name_en, 'type_ar', t.name_ar,
      'outcome', o.key, 'outcome_en', o.name_en, 'outcome_ar', o.name_ar, 'meaning', o.meaning,
      'next_step', n.next_step, 'next_step_on', n.next_step_on, 'next_step_task_id', n.next_step_task_id,
      'author_id', n.created_by, 'edited_at', n.edited_at, 'version', n.version, 'mine', n.created_by = me,
      'mentions', coalesce((select pg_catalog.jsonb_agg(m.person_id order by m.created_at, m.person_id)
                            from core.mention m where m.note_id = n.id and m.deleted_at is null), '[]'::jsonb),
      'from_note', my.from_note('core.note', n.id, me),
      -- an event the system wrote (D5): its type and values, worded by the screen in Arabic and English
      'event', case when n.event_type is null then null
                    else pg_catalog.jsonb_build_object('type', n.event_type, 'values',
                           (select pg_catalog.jsonb_build_object('task_id', t.id, 'number', t.number, 'title', t.title)
                            from work.task t where t.id = n.event_task_id)) end)
      order by n.happened_on desc, n.logged_at desc, n.id)
    from (select * from core.note x
          where x.entity_table = e.table_name and x.entity_id = p_id and x.deleted_at is null
            and (p_kinds is null or x.kind = any (p_kinds))
            -- a task's event reaches only those who may see the task (QA-553)
            and (x.event_type is null
                 or work.row_level('work.task', x.event_task_id, me) >= 'view')
          order by x.happened_on desc, x.logged_at desc, x.id
          limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(coalesce(p_offset, 0), 0)) n
    left join partner.activity_type t on t.id = n.activity_type_id
    left join partner.activity_outcome o on o.id = n.outcome_id), '[]'::jsonb);
end
$$;

-- D5: a task on a client writes an event on the client's timeline when it is added and when it is done — past work
-- never (V491). Inside the request that saved the task, so one Undo takes both back.
create function work.task_client_event() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.partner_id is null or new.deleted_at is not null or work.task_is_past(new) then
    return null;
  end if;
  if tg_op = 'INSERT' then
    insert into core.note (entity_table, entity_id, kind, event_type, event_task_id, created_by)
    values ('partner.partner', new.partner_id, 'update', 'task_added',
            new.id,
            coalesce(authz.me(), new.created_by));
  elsif old.closed_at is null and new.closed_at is not null then
    insert into core.note (entity_table, entity_id, kind, event_type, event_task_id, created_by)
    values ('partner.partner', new.partner_id, 'update', 'task_done',
            new.id,
            coalesce(authz.me(), new.closed_by, new.created_by));
  end if;
  return null;
end
$$;

create trigger client_event after insert or update of closed_at on work.task
  for each row execute function work.task_client_event();
