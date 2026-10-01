-- P3-6f · gaps from the oversight's scenario catalogue (15:55): WRK-092, WRK-041, WRK-124, PRF-143.

-- ================================================================ who may be given work (WRK-092)
-- A person may be made an owner, a helper or be mentioned only while they can work here: staff, active, allowed to
-- sign in, not removed, and not past the day they left. A switched-off or departed person is refused
-- (person.unavailable); what they already hold stays, for the admin to hand over.
create function core.person_available(p_person uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from core.person p
                 where p.id = p_person and p.kind = 'staff' and p.active and p.can_sign_in and p.deleted_at is null
                   and (p.left_on is null or p.left_on > core.riyadh_today()))
$$;
revoke all on function core.person_available(uuid) from public;

-- partner.side_owner_set_inner as P3-8b-1 wrote it, and core.mentions_add as P3-8b-3 wrote it: plus the rule above.
create or replace function partner.side_owner_set_inner(p_id uuid, p_side text, p_person uuid, p_from date, p_reason text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  cur partner.side_owner;
begin
  if p_person is not null and not exists (select 1 from core.person x where x.id = p_person and x.kind = 'staff'
                                          and x.active and x.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_person is not null and not core.person_available(p_person) then
    raise exception using errcode = 'P0001', message = 'person.unavailable', detail = p_person::text;
  end if;
  select * into cur from partner.side_owner m
  where m.partner_id = p_id and m.side = p_side and m.deleted_at is null and m.effective_from <= p_from
    and (m.effective_to is null or m.effective_to > p_from);
  if cur.id is not null and cur.person_id is not distinct from p_person then
    return;
  end if;
  if cur.id is not null then
    if cur.effective_from = p_from then
      update partner.side_owner set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'replaced'
      where id = cur.id;
    else
      update partner.side_owner set effective_to = p_from where id = cur.id;
    end if;
  end if;
  if p_person is not null then
    begin
      insert into partner.side_owner (partner_id, side, person_id, effective_from, reason)
      values (p_id, p_side, p_person, p_from, p_reason);
    exception when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'partner.owner_later_change';
    end;
  end if;
end
$$;

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
    if not authz.can_see_as(who, n.entity_table, n.entity_id) then
      raise exception using errcode = 'P0001', message = 'note.mention_cannot_see', detail = who::text;
    end if;
    insert into core.mention (note_id, person_id) values (p_note, who)
    on conflict (note_id, person_id) do update set deleted_at = null, deleted_by = null, delete_reason = null;
    perform notify.push(who, 'mentioned', n.entity_table, n.entity_id, 'notify.mentioned',
                        pg_catalog.jsonb_build_object('note_id', p_note, 'kind', n.kind));
    k := k + 1;
  end loop;
  return k;
end
$$;

-- ================================================================ 'Executive directive' ranks first (WRK-041)
-- The priority an executive's directive carries, above every other, with a locked meaning (V97, QA-31): its names stay
-- editable, the meaning never, and it is never removed or retired.
alter table work.priority add column meaning text check (meaning in ('executive_directive'));
create unique index priority_one_per_meaning on work.priority (meaning) where meaning is not null;
select audit.begin('system', 'list.meanings_seeded');
insert into work.priority (key, name_en, name_ar, sort, meaning)
values ('executive_directive', 'Executive directive', 'توجيه تنفيذي', 0, 'executive_directive')
on conflict (key) do update set meaning = 'executive_directive', sort = 0;
select audit.end();

-- ================================================================ alerts fire on the first run on or after their day (WRK-124)
-- A run missed or late on the day (a pause, a failed job) no longer loses an alert: each of these kinds now answers for
-- its day or any day before it, under a key that does not change with the day, and leaves out whoever was told that key
-- already — so each is told once, on the first run on or after the day.
create or replace function notify.alert_activity_stale() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  select a.person_id, a.alert_key, a.entity_table, a.entity_id, a.label_key, a.label_args
  from (
    select distinct o.person_id, 'activity_stale:' || p.id || ':' || partner.stale_on(p.id), 'partner.partner', p.id,
           'alert.activity_stale',
           pg_catalog.jsonb_build_object('partner_id', p.id, 'number', p.number,
                                         'last_activity_on', partner.last_activity_on(p.id))
    from partner.partner p
    join partner.partner_side s on s.partner_id = p.id and s.deleted_at is null
    cross join lateral partner.side_owners(p.id, s.side) o(person_id)
    where p.deleted_at is null and p.archived_at is null and partner.side_on(p.id, s.side)
      and partner.status_of(p.id, s.side) is distinct from 'lost'
      and partner.stale_on(p.id) <= core.riyadh_today()
  ) a (person_id, alert_key, entity_table, entity_id, label_key, label_args)
  where not exists (select 1 from notify.notification x
                    where x.person_id = a.person_id and x.alert_key = a.alert_key)
$$;

create or replace function notify.alert_file_review() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  select a.person_id, a.alert_key, a.entity_table, a.entity_id, a.label_key, a.label_args
  from (
    with f as (
      select x.id, x.created_by, x.review_on from core.file x
      where x.deleted_at is null and x.status = 'stored' and x.review_on <= core.riyadh_today()
    ), who as (
      select f.id as file_id, f.created_by as person_id from f
      union
      select f.id, o from f join core.file_link l on l.file_id = f.id and l.deleted_at is null
        cross join lateral pg_catalog.unnest(case when l.side is not null
                                                  then array(select partner.side_owners(l.entity_id, l.side))
                                                  else core.owners_of(l.entity_table, l.entity_id) end) o
    )
    select w.person_id, 'file_review:' || f.id || ':' || f.review_on, 'core.file', f.id, 'alert.file_review',
           pg_catalog.jsonb_build_object('file_id', f.id, 'review_on', f.review_on)
    from who w join f on f.id = w.file_id
    where w.person_id is not null
  ) a (person_id, alert_key, entity_table, entity_id, label_key, label_args)
  where not exists (select 1 from notify.notification x
                    where x.person_id = a.person_id and x.alert_key = a.alert_key)
$$;

-- The tightest reminder day a contract has reached and not yet told — never one from before the contract was added —
-- so a missed run is caught up once, not three times; a renewed end date starts the reminders again.
create or replace function notify.alert_contract_expiring() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  select a.person_id, a.alert_key, a.entity_table, a.entity_id, a.label_key, a.label_args
  from (
    with s as (
      select coalesce(core.setting_at('partner.contract_notify', null, core.riyadh_today()), '{}'::jsonb) as who,
             (select pg_catalog.array_agg(x::int) from pg_catalog.jsonb_array_elements_text(
                core.setting_at('partner.contract_reminder_days', null, core.riyadh_today())) x) as days
    ), c0 as (
      select k.id, k.partner_id, k.side, k.title, k.end_on, k.end_on - core.riyadh_today() as days_left, p.number,
             (select pg_catalog.min(d) from pg_catalog.unnest(coalesce(k.reminder_days, (select s.days from s))) d
              where k.end_on - d <= core.riyadh_today() and k.end_on - d >= core.riyadh_day(k.created_at)) as reminder
      from partner.contract k join partner.partner p on p.id = k.partner_id
      where k.deleted_at is null and k.reminders_on and k.end_on is not null and p.deleted_at is null
        and p.archived_at is null and partner.side_on(k.partner_id, k.side)
        and k.end_on >= core.riyadh_today()
    ), c as (
      select * from c0 where c0.reminder is not null
    ), who as (
      select c.id as contract_id, o.person_id from c cross join lateral partner.side_owners(c.partner_id, c.side) o(person_id)
      where coalesce(((select s.who from s) ->> 'account_manager')::boolean, true)
      union
      select c.id, f.person_id from c join notify.follow f
        on (f.entity_table = 'partner.partner' and f.entity_id = c.partner_id)
        or (f.entity_table = 'partner.contract' and f.entity_id = c.id)
      where coalesce(((select s.who from s) ->> 'followers')::boolean, true)
      union
      select c.id, d.head_person_id from c cross join lateral partner.side_owners(c.partner_id, c.side) o(person_id)
        join core.person pe on pe.id = o.person_id join core.department d on d.id = pe.department_id
      where coalesce(((select s.who from s) ->> 'commercial_manager')::boolean, false) and d.head_person_id is not null
    )
    select w.person_id, 'contract_expiring:' || c.id || ':' || c.end_on || ':' || c.reminder, 'partner.contract', c.id,
           'alert.contract_expiring',
           pg_catalog.jsonb_build_object('partner_id', c.partner_id, 'number', c.number, 'side', c.side, 'title', c.title,
                                         'days', c.days_left, 'end_on', c.end_on)
    from who w join c on c.id = w.contract_id
  ) a (person_id, alert_key, entity_table, entity_id, label_key, label_args)
  where not exists (select 1 from notify.notification x
                    where x.person_id = a.person_id and x.alert_key = a.alert_key)
$$;

-- ================================================================ "logged late" by the rule in force that day (PRF-143)
-- work.late_days is effective-dated now: an entry is judged by the value in force on the day it was logged.
create or replace function core.logged_late(p_happened_on date, p_logged_at timestamptz) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(core.riyadh_day(p_logged_at) - p_happened_on
                    > coalesce((core.setting_at('work.late_days', null, core.riyadh_day(p_logged_at)) #>> '{}')::int, 14)
                  and p_happened_on >= nullif(core.setting_at('app.go_live_on', null, core.riyadh_today()) #>> '{}', '')::date,
                  false)
$$;
