-- The bell says "<who> changed <what> on <record>" (the Architect's order of 14 Oct, after the oversight's phone walk
-- read "Admin account changed your Status change"). Three things, read in one go as before:
--   * a change notice points at the record a person owns or follows, not at a side row the same request wrote (a
--     task's status change row): the main record wins when one request touches both;
--   * each change notice names what changed on it — the fields, never their values — as `fields`;
--   * a person reads by their name, as a task reads by its number and title (QA-553 still holds: only for a reader
--     who may see the record).
-- Forward-only.

-- notify.fan_out as round 6 wrote it, with one change: among the changes one request made to what a person owns or
-- follows, the main record (core.entity.history = false) is told before a side row of its history.
create or replace function notify.fan_out(p_request uuid) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  q audit.request;
  n int;
begin
  select * into q from audit.request where id = p_request;
  if q.id is null or q.kind not in ('ui', 'undo') or q.happened_on < core.riyadh_today() then
    return 0;
  end if;
  insert into notify.notification (person_id, kind, entity_table, entity_id, request_id, actor_id, label_key, label_args)
  select distinct on (x.person_id) x.person_id, x.kind, x.table_name, x.row_id, q.id, q.actor_id, q.label_key,
         q.label_args
  from (
    select o.person_id, 'changed_by_other' as kind, c.table_name, c.row_id, c.id, 0 as pri
    from audit.change c cross join lateral pg_catalog.unnest(core.owners_of(c.table_name, c.row_id)) o(person_id)
    where c.request_id = q.id
    union all
    select f.person_id, 'followed_change', c.table_name, c.row_id, c.id, 1
    from audit.change c join notify.follow f on f.entity_table = c.table_name and f.entity_id = c.row_id
    where c.request_id = q.id
  ) x
  left join core.entity e on e.table_name = x.table_name
  where x.person_id <> q.actor_id and notify.may_notify(x.person_id, x.kind)
    and authz.can_see_as(x.person_id, x.table_name, x.row_id)
    and not exists (select 1 from notify.notification m where m.request_id = q.id and m.person_id = x.person_id)
  order by x.person_id, x.pri, coalesce(e.history, false), x.id;
  get diagnostics n = row_count;
  return n;
end
$$;

-- A notification's record by name, as 20261014150000 wrote it, and a person by the name the app shows for them.
create or replace function notify.entity_title(p_table text, p_id uuid, p_person uuid) returns jsonb
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
    when 'core.person' then
      select coalesce(pr.display_name_en, x.nickname_en, x.full_name_en),
             coalesce(pr.display_name_ar, x.nickname_ar, x.full_name_ar, pr.display_name_en, x.nickname_en, x.full_name_en)
        into en, ar
      from core.person x left join core.person_profile pr on pr.person_id = x.id
      where x.id = p_id;
    else
      null;
  end case;
  return pg_catalog.jsonb_build_object('title', en, 'title_ar', coalesce(ar, en));
end
$$;

-- What a change notice's request changed on its record: the field names a person changed — never the version, and never
-- a time or a "by whom" the system stamps alongside (updated_at, closed_at, closed_by …). Empty for every other notice,
-- and empty for a reader who may not see the record now — the same current-access rule as its title (QA-553).
create function notify.changed_fields(p_kind text, p_request uuid, p_table text, p_id uuid, p_person uuid) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(distinct f), '[]'::jsonb)
  from audit.change c cross join lateral pg_catalog.unnest(c.fields) f
  where p_kind in ('changed_by_other', 'followed_change')
    and p_table is not null and authz.can_see_as(p_person, p_table, p_id)
    and c.request_id = p_request and c.table_name = p_table and c.row_id = p_id
    and f <> 'version' and f not like '%\_at' and f not like '%\_by'
$$;

revoke all on function notify.changed_fields(text, uuid, text, uuid, uuid) from public;

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
             'label_key', x.label_key, 'label_args', x.label_args, 'created_at', x.created_at, 'read_at', x.read_at,
             -- what the request changed on the record (field names only), for "<who> changed <what> on <record>";
             -- like the name below, only for a reader who may see the record now
             'fields', notify.changed_fields(x.kind, x.request_id, x.entity_table, x.entity_id, me))
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
