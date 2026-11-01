-- V661 (the Architect, 1 Nov; V514 (1)): one optional importance star on a task and on a task's checklist item (its
-- action item, a meeting's lines included), set and cleared by whoever may change the task (work.task_editable), each
-- change one logged request that Undo takes back (D7). Setting the star it already has changes nothing and logs
-- nothing. The Today list reads the star (my.my_tasks 'starred') and carries every starred task of mine, undated
-- included; its order into Do now, Plan it, Quick or hand off and Later is a pure function in the app
-- (src/modules/my-day/logic.ts, todayBoxes), with urgent_within_days = 2 named there alone (V275). No new table.
-- V662 (the Architect, 1 Nov): core.search's task rows say whether the reader may change the task ('can_edit', the
-- Tasks page's own test, work.can_edit_task), so the Turn into task picker offers only tasks one may add to.
-- my.my_tasks is replaced whole, as 20261014232000 left it, and core.search as 20261031100000 left it, each but for the
-- line named. Forward-only (V103).

alter table work.task add column starred boolean not null default false;
comment on column work.task.starred is 'V661: the importance star (V514); urgency is derived from the due day, never stored.';
alter table work.action_item add column starred boolean not null default false;
comment on column work.action_item.starred is 'V661: the importance star on a task''s checklist item (V514).';

-- Star or unstar a task (V661): whoever may change the task. One logged request; the same value again is no change.
create function work.task_star(p_id uuid, p_starred boolean) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t work.task := work.task_editable(p_id);
  req uuid;
begin
  if p_starred is null then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  if t.starred = p_starred then
    return pg_catalog.jsonb_build_object('id', t.id, 'request_id', null, 'starred', t.starred, 'version', t.version);
  end if;
  req := audit.begin('ui', case when p_starred then 'task.starred' else 'task.unstarred' end,
                     pg_catalog.jsonb_build_object('number', t.number));
  update work.task set starred = p_starred where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'starred', p_starred,
                                       'version', (select x.version from work.task x where x.id = p_id));
end
$$;

-- Star or unstar a task's checklist item (V661): whoever may change its task.
create function work.action_item_star(p_id uuid, p_starred boolean) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  a work.action_item;
  t work.task;
  req uuid;
begin
  select * into a from work.action_item where id = p_id and deleted_at is null;
  if a.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  t := work.task_editable(a.task_id);
  if p_starred is null then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  if a.starred = p_starred then
    return pg_catalog.jsonb_build_object('id', a.id, 'request_id', null, 'starred', a.starred, 'version', a.version);
  end if;
  req := audit.begin('ui', case when p_starred then 'action_item.starred' else 'action_item.unstarred' end,
                     pg_catalog.jsonb_build_object('number', t.number));
  update work.action_item set starred = p_starred where id = p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req, 'starred', p_starred,
                                       'version', (select x.version from work.action_item x where x.id = p_id));
end
$$;
revoke all on function work.task_star(uuid, boolean), work.action_item_star(uuid, boolean) from public;
grant execute on function work.task_star(uuid, boolean), work.action_item_star(uuid, boolean) to authenticated;

create function api.task_star(p_id uuid, p_starred boolean) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.task_star(p_id, p_starred) $$;
comment on function api.task_star(uuid, boolean) is 'V661: star or unstar a task (logged, undoable).';
create function api.action_item_star(p_id uuid, p_starred boolean) returns jsonb
language sql volatile security invoker set search_path = '' as $$ select work.action_item_star(p_id, p_starred) $$;
comment on function api.action_item_star(uuid, boolean) is 'V661: star or unstar a task''s checklist item (logged, undoable).';
revoke all on function api.task_star(uuid, boolean), api.action_item_star(uuid, boolean) from public;
grant execute on function api.task_star(uuid, boolean), api.action_item_star(uuid, boolean) to authenticated;

-- The Today list's rows carry the star (V661), and a starred task joins the list whatever its due day, undated
-- included (so Plan it can hold it; the box comes from todayBoxes, the group column stays as it is: undated is 'next').
create or replace function my.my_tasks(p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', t.id, 'number', t.number, 'title', t.title, 'due_on', t.due_on, 'partner_id', p.id,
           'partner_name', p.trade_name_en, 'client', p.trade_name_en, 'project_id', t.project_id, 'status_id', t.status_id,
           'starred', t.starred,
           'role', case when t.owner_id = p_person then 'owner' else 'helper' end,
           'group', case when t.owner_id is distinct from p_person then 'helping'
                         when t.due_on < d.today then 'overdue' when t.due_on = d.today then 'today' else 'next' end,
           'carried_over', my.carry_count(p_person, 'work.task', t.id))
           order by t.owner_id is distinct from p_person, t.due_on, t.number), '[]'::jsonb)
  from (select core.riyadh_today() as today) d
  -- V661 (the Architect, 1 Nov): a starred task is on the Today list whatever its due day, undated included
  join work.task t on t.deleted_at is null and t.closed_at is null
                  and ((t.due_on is not null and t.due_on <= d.today + 7) or t.starred)
                  and (t.owner_id = p_person
                       or exists (select 1 from work.task_helper h
                                  where h.task_id = t.id and h.person_id = p_person and h.deleted_at is null))
  left join partner.partner p on p.id = t.partner_id and authz.can_see_as(p_person, 'partner.partner', p.id)
  where not work.task_is_past(t)
$$;

-- V662: search's task rows say whether the reader may change the task.
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
    -- V641: every kind of captured item the reader may see — a note, an idea, a checklist (by its items too), a
    -- reminder, a meeting — named by its title, else its first line, else its first item, and by what it was captured as
    'notes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', n.id, 'kind', n.kind, 'title', n.title,
               'author_id', n.person_id, 'happened_on', n.happened_on, 'mine', n.person_id = me,
               'label', coalesce(n.title, notify.first_line(n.body), notify.first_line(n.items -> 0 ->> 'text')),
               -- V660: found by a checklist item alone, the hit names that item
               'item', case when coalesce(norm.fold(n.title), '') not like '%' || q || '%'
                             and coalesce(norm.fold(n.body), '') not like '%' || q || '%'
                            then (select i ->> 'text' from pg_catalog.jsonb_array_elements(coalesce(n.items, '[]'::jsonb))
                                  with ordinality x(i, o)
                                  where norm.fold(i ->> 'text') like '%' || q || '%' order by x.o limit 1) end,
               'capture_kind', case
                 when n.kind in ('meeting', 'checklist') then n.kind
                 when n.idea then 'idea'
                 when exists (select 1 from core.reminder r
                              where r.note_id = n.id and r.deleted_at is null
                                and not exists (select 1 from my.note_link l
                                                where l.entity_table = 'core.reminder' and l.entity_id = r.id)) then 'reminder'
                 else 'note' end)
               order by n.logged_at desc, n.id)
      from (select * from my.note n0
            where n0.deleted_at is null
              and (norm.fold(n0.title) like '%' || q || '%' or norm.fold(n0.body) like '%' || q || '%'
                   or exists (select 1 from pg_catalog.jsonb_array_elements(coalesce(n0.items, '[]'::jsonb)) i
                              where norm.fold(i ->> 'text') like '%' || q || '%'))
              and my.note_visible(n0.id, me)
            order by n0.logged_at desc, n0.id limit lim) n), '[]'::jsonb),
    -- D4: tasks by title or number, each one the reader may see (live: a task is found the moment it is saved);
    -- V660: and by an item of its checklist, the hit naming that item
    'tasks', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', t.id, 'number', t.number, 'title', t.title,
               'due_on', t.due_on, 'closed', t.closed_at is not null, 'partner_id', t.partner_id,
               -- V662: whether the reader may change it (add to its checklist), the Tasks page's own test
               'can_edit', work.can_edit_task(me, (select x from work.task x where x.id = t.id)),
               'item', case when norm.fold(t.title) not like '%' || q || '%' and norm.fold(t.number) <> q
                            then (select a.text from work.action_item a
                                  where a.task_id = t.id and a.deleted_at is null
                                    and norm.fold(a.text) like '%' || q || '%'
                                  order by a.sort, a.created_at, a.id limit 1) end)
               order by t.closed_at is not null, t.due_on nulls last, t.number)
      from (select * from work.task t0
            where t0.deleted_at is null
              and (norm.fold(t0.title) like '%' || q || '%' or norm.fold(t0.number) = q
                   or exists (select 1 from work.action_item a0
                              where a0.task_id = t0.id and a0.deleted_at is null
                                and norm.fold(a0.text) like '%' || q || '%'))
              and work.row_level('work.task', t0.id, me) >= 'view'
            order by t0.closed_at is not null, t0.due_on nulls last, t0.number limit lim) t), '[]'::jsonb),
    -- D4: invoices by their number or DPIN, for a reader who sees Finance (V458)
    'invoices', case when authz.level_of(me, 'finance') >= 'view'
                     then coalesce(finance.search_numbers(p_q, lim), '[]'::jsonb) else '[]'::jsonb end);
end
$$;
