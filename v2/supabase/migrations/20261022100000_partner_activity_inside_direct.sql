-- V645 (owner ideas of 20 Oct, MD-39, gaps 1 and 2): Log activity needs no organisation when the other side is inside
-- Direct. Builder A's part — the counterpart kind, the ticket reference and the read rule — in one forward migration:
--  1. Who it was with: an organisation (as today) or someone inside Direct, a team or a system chosen from the
--     Settings list partner.internal_counterpart (20261021090000, V385: Operations, Product, Website and app
--     developers, Support).
--     An activity inside Direct has no organisation: it sits on its author's own record (core.person), so nothing that
--     counts an organisation's activities (stale after 21 days, last activity, the call measures) ever sees it.
--  2. An optional ticket reference (free text; the screen links it when it is a web address); no ticket system is
--     called. (3. WhatsApp, Email and Ticket are already activity types: 20261021090000.)
--  4. The read rule: an activity inside Direct is seen by its author, the people it names, admins (as shared, never as
--     private — it is never private) and, when its author shares it with their team, that team (home, helping or
--     leading, my.team_sees). Never by everyone who may open its author's page: core.note_visible, its owners and its
--     level each have a branch for it, and the timeline read (core.notes) asks note_visible for such a row.
--  5. Its next step becomes a task on My day exactly as today: work.next_step_task makes an internal task (no client).
-- partner.activity_log and api.activity_log gain three trailing defaults (p_ticket_ref, p_internal, p_share_team), so
-- every existing call keeps working; the functions replaced whole are as their newest migration left them, but for the
-- lines named.
-- Forward-only (V103).

-- ================================================================ 1, 2. the activity's new fields
alter table core.note
  add column internal_counterpart_id uuid references partner.internal_counterpart (id),
  add column ticket_ref text check (ticket_ref is null or (pg_catalog.btrim(ticket_ref) <> ''
                                                           and pg_catalog.length(ticket_ref) <= 500)),
  add column shared_with_team boolean not null default false,
  -- inside Direct: an activity on its author's own record, never on an organisation
  add constraint note_internal_on_author check (internal_counterpart_id is null
    or (kind = 'activity' and entity_table = 'core.person' and entity_id = created_by)),
  add constraint note_ticket_on_activity check (ticket_ref is null or kind = 'activity'),
  add constraint note_team_share_internal check (not shared_with_team or internal_counterpart_id is not null);
create index note_internal_counterpart on core.note (internal_counterpart_id);
comment on column core.note.internal_counterpart_id is 'V645: an activity with a team or a system inside Direct (no organisation).';
comment on column core.note.ticket_ref is 'V645: an optional ticket reference, free text (a link when a web address).';

-- ================================================================ 4. the read rule
-- An activity inside Direct: its author, the people it names, an admin, and its author's team when shared. Every other
-- note is seen by whoever sees its record, as before.
create or replace function core.note_visible(p_id uuid, p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case
      when n.internal_counterpart_id is null then authz.can_see_as(p_person, n.entity_table, n.entity_id)
      else n.created_by = p_person
        or (n.deleted_at is null
            and exists (select 1 from core.person p where p.id = p_person and p.kind = 'staff' and p.active
                          and p.deleted_at is null)
            and (exists (select 1 from core.mention m where m.note_id = n.id and m.person_id = p_person
                           and m.deleted_at is null)
                 or (n.shared_with_team and my.team_sees(n.created_by, p_person))
                 or exists (select 1 from core.person p join core.role r on r.id = p.role_id
                            where p.id = p_person and r.is_admin)))
      end
    from core.note n where n.id = p_id), false)
$$;
-- Its only owner is its author: not the owners of the author's record (a manager), who would otherwise see it.
create or replace function core.note_owners(p_id uuid) returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select n.created_by from core.note n where n.id = p_id
  union
  select o from core.note n cross join lateral pg_catalog.unnest(core.owners_of(n.entity_table, n.entity_id)) o
  where n.id = p_id and n.internal_counterpart_id is null
$$;
-- Its level is its own: Full for its author, View for whoever may see it, None for everyone else — never the level
-- the reader holds on its author's page.
create or replace function core.note_level(p_table text, p_id uuid, p_person uuid) returns core.level
language sql stable security definer set search_path = ''
as $$
  select coalesce((select case
                            when n.internal_counterpart_id is null then authz.record_level(p_person, n.entity_table, n.entity_id)
                            when n.created_by = p_person then 'full'::core.level
                            when core.note_visible(n.id, p_person) then 'view'::core.level
                            else 'none'::core.level end
                   from core.note n where n.id = p_id), 'none'::core.level)
$$;

-- ================================================================ the timeline read
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
      -- V645: who it was with inside Direct (none for an organisation's activity), the ticket and the team share
      'internal_counterpart', ip.key, 'internal_counterpart_en', ip.name_en, 'internal_counterpart_ar', ip.name_ar,
      'ticket_ref', n.ticket_ref, 'shared_with_team', n.shared_with_team,
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
            -- V645: an activity inside Direct reaches only its author, the people it names, its team when shared
            -- and admins — never everyone who may open its author's page
            and (x.internal_counterpart_id is null or core.note_visible(x.id, me))
          order by x.happened_on desc, x.logged_at desc, x.id
          limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(coalesce(p_offset, 0), 0)) n
    left join partner.activity_type t on t.id = n.activity_type_id
    left join partner.activity_outcome o on o.id = n.outcome_id
    left join partner.internal_counterpart ip on ip.id = n.internal_counterpart_id), '[]'::jsonb);
end
$$;

-- The activities inside Direct the reader may see — authored, named on, shared with their team, or all of them for an
-- admin — newest first, each as the timeline shows it (V645 (4)): the read the screen lists them by, since a named
-- colleague may not open its author's page.
create function core.activities_inside(p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
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
      'internal_counterpart', ip.key, 'internal_counterpart_en', ip.name_en, 'internal_counterpart_ar', ip.name_ar,
      'ticket_ref', n.ticket_ref, 'shared_with_team', n.shared_with_team)
      order by n.happened_on desc, n.logged_at desc, n.id)
    from (select * from core.note x
          where x.internal_counterpart_id is not null and x.deleted_at is null and core.note_visible(x.id, me)
          order by x.happened_on desc, x.logged_at desc, x.id
          limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(coalesce(p_offset, 0), 0)) n
    join partner.internal_counterpart ip on ip.id = n.internal_counterpart_id
    left join partner.activity_type t on t.id = n.activity_type_id
    left join partner.activity_outcome o on o.id = n.outcome_id), '[]'::jsonb);
end
$$;
create function api.activities_inside(p_limit int default 50, p_offset int default 0) returns jsonb
language sql stable security invoker set search_path = ''
as $$ select core.activities_inside(p_limit, p_offset) $$;
grant execute on function core.activities_inside(int, int), api.activities_inside(int, int) to authenticated;

-- ================================================================ naming someone on an activity inside Direct
create or replace function core.mentions_add(p_note uuid, p_people uuid[]) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n core.note;
  who uuid;
  k int := 0;
begin
  select * into n from core.note where id = p_note;
  foreach who in array coalesce(p_people, '{}') loop
    if exists (select 1 from core.mention m where m.note_id = p_note and m.person_id = who and m.deleted_at is null) then
      continue;
    end if;
    if not exists (select 1 from core.person p where p.id = who and p.kind = 'staff' and p.active and p.deleted_at is null) then
      raise exception using errcode = 'P0002', message = 'common.not_found', detail = who::text;
    end if;
    if not core.person_available(who) then
      raise exception using errcode = 'P0001', message = 'person.unavailable', detail = who::text;
    end if;
    -- an activity inside Direct is seen by whoever it names (V645 (4)): its author's page is not theirs to open
    if n.internal_counterpart_id is null and not authz.can_see_as(who, n.entity_table, n.entity_id) then
      raise exception using errcode = 'P0001', message = 'note.mention_cannot_see', detail = who::text;
    end if;
    insert into core.mention (note_id, person_id) values (p_note, who)
    on conflict (note_id, person_id) do update set deleted_at = null, deleted_by = null, delete_reason = null;
    perform notify.push(who, 'mentioned', case when n.internal_counterpart_id is null then n.entity_table else 'core.note' end,
                        case when n.internal_counterpart_id is null then n.entity_id else n.id end, 'notify.mentioned',
                        pg_catalog.jsonb_build_object('note_id', p_note, 'kind', n.kind));
    k := k + 1;
  end loop;
  return k;
end
$$;

-- ================================================================ Log activity: with whom, the ticket, the team share
drop function api.activity_log(uuid, text, text, date, text, text, date, uuid[]);
drop function partner.activity_log(uuid, text, text, date, text, text, date, uuid[]);
create function partner.activity_log(p_partner uuid, p_type text, p_outcome text default null,
                                     p_happened_on date default null, p_body text default null,
                                     p_next_step text default null, p_next_step_on date default null,
                                     p_mentions uuid[] default null, p_ticket_ref text default null,
                                     p_internal text default null, p_share_team boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.entity;
  ip partner.internal_counterpart;
  t partner.activity_type;
  o partner.activity_outcome;
  nid uuid;
  req uuid;
  what text;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  -- V645 (1): with an organisation, or with someone inside Direct (a team or a system from the Settings list) — one
  if (p_partner is null) = (p_internal is null) then
    raise exception using errcode = 'P0001', message = 'activity.with_whom_required';
  end if;
  if p_internal is not null then
    select * into ip from partner.internal_counterpart x
    where (x.key = p_internal or x.id::text = p_internal) and x.active and x.deleted_at is null;
    if ip.id is null then
      raise exception using errcode = 'P0002', message = 'activity.unknown_internal_counterpart', detail = p_internal;
    end if;
  else
    if coalesce(p_share_team, false) then
      raise exception using errcode = 'P0001', message = 'activity.share_team_internal_only';
    end if;
    e := core.can_see_record('partner', p_partner);
    if (select p.archived_at from partner.partner p where p.id = p_partner) is not null then
      raise exception using errcode = 'P0001', message = 'partner.archived';
    end if;
    if not core.may_write(e.table_name, p_partner) then
      perform partner.side_writable(p_partner, null);
    end if;
  end if;
  select * into t from partner.activity_type x
  where (x.key = p_type or x.id::text = p_type) and x.active and x.deleted_at is null;
  if t.id is null then
    raise exception using errcode = 'P0002', message = 'partner.unknown_activity_type', detail = p_type;
  end if;
  o := partner.outcome_of(t, p_outcome);
  if o.meaning = 'demo_set' and p_next_step_on is null then
    raise exception using errcode = 'P0001', message = 'partner.demo_day_required';
  end if;
  req := audit.begin('ui', 'partner.activity_logged',
                     pg_catalog.jsonb_build_object('type', t.key, 'outcome', o.key, 'internal', ip.key), null);
  perform audit.happened(p_happened_on);
  begin
    -- an activity inside Direct sits on its author's own record: it has no organisation (V645 (1))
    insert into core.note (entity_table, entity_id, kind, body, happened_on, activity_type_id, outcome_id, next_step,
                           next_step_on, internal_counterpart_id, ticket_ref, shared_with_team)
    values (case when ip.id is null then 'partner.partner' else 'core.person' end, coalesce(p_partner, me), 'activity',
            nullif(pg_catalog.btrim(p_body), ''),
            coalesce(p_happened_on, core.riyadh_today()), t.id, o.id, nullif(pg_catalog.btrim(p_next_step), ''),
            p_next_step_on, ip.id, nullif(pg_catalog.btrim(p_ticket_ref), ''), coalesce(p_share_team, false))
    returning id into nid;
  exception when check_violation then
    get stacked diagnostics what = constraint_name;
    raise exception using errcode = 'P0001', message = core.note_refused(what);
  end;
  perform core.mentions_add(nid, p_mentions);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', nid, 'request_id', req, 'type', t.key, 'outcome', o.key,
    'internal', ip.key,
    'meaning', o.meaning, 'counts_as_demo', coalesce(o.counts_as_demo, false),
    'offer_task', o.meaning = 'meeting_set', 'offer_close_demo_task', o.meaning = 'demo_held',
    'demo_on', case when o.meaning = 'demo_set' then p_next_step_on end);
end
$$;

create function api.activity_log(p_partner uuid, p_type text, p_outcome text default null, p_happened_on date default null,
                                 p_body text default null, p_next_step text default null, p_next_step_on date default null,
                                 p_mentions uuid[] default null, p_ticket_ref text default null,
                                 p_internal text default null, p_share_team boolean default false) returns jsonb
language sql volatile security invoker set search_path = ''
as $$
  select partner.activity_log(p_partner, p_type, p_outcome, p_happened_on, p_body, p_next_step, p_next_step_on,
                              p_mentions, p_ticket_ref, p_internal, p_share_team)
$$;
grant execute on function partner.activity_log(uuid, text, text, date, text, text, date, uuid[], text, text, boolean),
  api.activity_log(uuid, text, text, date, text, text, date, uuid[], text, text, boolean) to authenticated;

-- ================================================================ 5. the next step becomes a task, inside Direct too
create or replace function work.next_step_task() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  demo boolean := exists (select 1 from partner.activity_outcome o where o.id = new.outcome_id and o.meaning = 'demo_set');
  heading text;
  team uuid;
  mgr uuid;
begin
  if new.kind <> 'activity' or not (new.entity_table = 'partner.partner' or new.internal_counterpart_id is not null)
     or new.deleted_at is not null
     or new.next_step_on is null or (new.next_step is null and not demo)
     or (select r.kind from audit.request r
         where r.id = nullif(pg_catalog.current_setting('app.request_id', true), '')::uuid) is distinct from 'ui' then
    return new;
  end if;
  heading := pg_catalog.left(coalesce(new.next_step, 'Demo'), 300);
  if new.next_step_task_id is not null then
    update work.task t set title = heading, due_on = new.next_step_on
    where t.id = new.next_step_task_id and t.closed_at is null and t.deleted_at is null
      and (t.title is distinct from heading or t.due_on is distinct from new.next_step_on);
    return new;
  end if;
  select p.team_id, p.manager_id into team, mgr from core.person p where p.id = new.created_by;
  -- QA-241: an author below Own on Tasks (the pilot's stage 0) could neither open nor close it — no task for them
  if team is null or not work.person_ok(new.created_by) or authz.level_of(new.created_by, 'tasks') < 'own' then
    return new;
  end if;
  insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, partner_id, due_on,
                         origin, happened_on)
  values (core.format_number('TSK', pg_catalog.date_part('year', new.happened_on)::int,                   -- V531
                             core.next_number('task', pg_catalog.date_part('year', new.happened_on)::int)),
          heading, new.created_by, team, (select t.department_id from core.team t where t.id = team),
          (select s.id from work.task_status s where s.is_default and s.deleted_at is null),
          case when new.internal_counterpart_id is null then 'client' else 'internal' end,
          case when new.internal_counterpart_id is null then new.entity_id end, new.next_step_on, 'next_step', new.happened_on)
  returning id into new.next_step_task_id;
  if demo and mgr is not null and work.person_ok(mgr) then
    insert into work.task_helper (task_id, person_id) values (new.next_step_task_id, mgr);
    if not work.is_past(new.happened_on) then
      perform notify.push_assigned(mgr, 'helper_added', 'work.task', new.next_step_task_id);
    end if;
  end if;
  return new;
end
$$;
