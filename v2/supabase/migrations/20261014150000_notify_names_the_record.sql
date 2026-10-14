-- The bell names each notification's record (Builder B's request on #203, the oversight's order of 13 Oct): every row of
-- notify.list (api.notifications) carries title and title_ar — a task as "TSK-2026-0010 · Call the hotel", a client
-- by its trade name — or nulls where the reader may not see the record or it has no name; the screen then shows the
-- kind's word. One read, no lookup per row. And a task coming due tells a person at most once a day, held by the
-- database (the Architect's order of 14 Oct, after the owner's bell showed three unnamed "coming due" rows). Forward-only.

-- A notification's record by name, for the bell: a task, project, opportunity or tender as its number and title, a
-- client or supplier as its trade name (Arabic where it has one). Only for a reader who may see the record now
-- (authz.can_see_as, the rule history and follows use) — else, or for a removed record or any other kind, nothing,
-- and the bell shows the kind's own word.
create function notify.entity_title(p_table text, p_id uuid, p_person uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  en text;
  ar text;
begin
  if p_table is null or p_id is null or not authz.can_see_as(p_person, p_table, p_id) then
    return pg_catalog.jsonb_build_object('title', null, 'title_ar', null);
  end if;
  case p_table
    when 'work.task' then
      select t.number || ' · ' || t.title into en from work.task t where t.id = p_id and t.deleted_at is null;
    when 'work.project' then
      select p.number || ' · ' || p.name into en from work.project p where p.id = p_id and p.deleted_at is null;
    when 'pipeline.opportunity' then
      select o.number || ' · ' || o.title into en from pipeline.opportunity o where o.id = p_id and o.deleted_at is null;
    when 'pipeline.tender' then
      select t.number || ' · ' || t.title into en from pipeline.tender t where t.id = p_id and t.deleted_at is null;
    when 'partner.partner' then
      select p.trade_name_en, coalesce(p.trade_name_ar, p.trade_name_en) into en, ar
      from partner.partner p where p.id = p_id and p.deleted_at is null;
    else
      null;
  end case;
  return pg_catalog.jsonb_build_object('title', en, 'title_ar', coalesce(ar, en));
end
$$;

revoke all on function notify.entity_title(text, uuid, uuid) from public;

create or replace function notify.list(p_tab text default 'all', p_before timestamptz default null, p_limit int default 50)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if p_tab not in ('all', 'mentions', 'assigned') then
    raise exception using errcode = 'P0001', message = 'notify.unknown_tab', detail = p_tab;
  end if;
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', x.id, 'kind', x.kind, 'entity', x.entity, 'entity_id', x.entity_id, 'request_id', x.request_id,
             'actor_id', x.actor_id, 'actor_name_en', x.actor_name_en, 'actor_name_ar', x.actor_name_ar,
             'label_key', x.label_key, 'label_args', x.label_args, 'created_at', x.created_at, 'read_at', x.read_at)
             -- the record by name, for a reader who may see it (Builder B's request, 13 Oct)
             || notify.entity_title(x.entity_table, x.entity_id, me)
             order by x.created_at desc, x.id)
    from (
      select n.*, coalesce(e.key, n.entity_table) as entity,
             coalesce(pr.display_name_en, a.nickname_en, a.full_name_en) as actor_name_en,
             coalesce(pr.display_name_ar, a.nickname_ar, a.full_name_ar) as actor_name_ar
      from notify.notification n
      left join core.entity e on e.table_name = n.entity_table
      left join core.person a on a.id = n.actor_id
      left join core.person_profile pr on pr.person_id = n.actor_id
      where n.person_id = me
        and (n.snoozed_until is null or n.snoozed_until <= core.clock())
        and (p_before is null or n.created_at < p_before)
        and (p_tab = 'all' or (p_tab = 'mentions' and n.kind = 'mentioned')
             or (p_tab = 'assigned' and n.kind in ('assigned', 'helper_added')))
      order by n.created_at desc, n.id
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) x), '[]'::jsonb);
end
$$;

-- ================================================================ a task coming due: at most once a day per person
-- The alert's key carries the due day, so a task whose due day moved could be told twice on one day. A unique key now
-- holds one "coming due" row per person, task and day.
create unique index notification_due_once_a_day on notify.notification (person_id, entity_id, alert_day)
  where kind = 'alert_due_tomorrow';

-- The daily job skips a row any unique key refuses (no conflict target), so the key above never fails a kind's run.
create or replace function notify.generate_alerts() returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  f record;
  k int;
  n int := 0;
  day date := core.riyadh_today();
begin
  for f in
    select p.proname
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'notify' and p.proname like 'alert\_%' and p.proretset
      and p.prorettype = 'notify.alert'::regtype and p.pronargs = 0
    order by p.proname
  loop
    begin
      execute pg_catalog.format(
        'insert into notify.notification (person_id, kind, entity_table, entity_id, label_key, label_args, alert_key,'
        || ' alert_day) select a.person_id, %L, a.entity_table, a.entity_id, a.label_key, a.label_args, a.alert_key, $1'
        || ' from notify.%I() a where a.alert_key is not null and notify.may_notify(a.person_id, %L)'
        || ' and (a.entity_table is null or authz.can_see_as(a.person_id, a.entity_table, a.entity_id))'
        || ' on conflict do nothing',
        f.proname, f.proname, f.proname) using day;
      get diagnostics k = row_count;
      n := n + k;
    exception when others then
      raise warning 'notify.generate_alerts: % failed: %', f.proname, sqlerrm;
    end;
  end loop;
  return n;
end
$$;
