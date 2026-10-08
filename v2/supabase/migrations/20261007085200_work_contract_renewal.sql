-- P5-1 · the contract renewal task (V56; TECH-SPEC §3.4, §3.7). P3-8b brought contracts and their reminders and left
-- `renewal_task_id` for this step. At a contract's first reminder the daily job makes one renewal task — owned by its
-- side's owner (the account manager on the Client side, the relationship owner on the other), due on the end date,
-- linked to the contract, origin alert — while partner.contract_renewal_task is on. The card and the notification offer
-- **Create renewal task**, which a person presses, whatever the setting. A renewed end date gets its own renewal task
-- once the last one is closed. Every function the Data API reaches is a security-invoker wrapper (V124). Forward-only.

-- ================================================================ the link, both ways
alter table partner.contract add constraint contract_renewal_task_fk foreign key (renewal_task_id) references work.task (id);
alter table partner.contract add column renewal_end_on date;
comment on column partner.contract.renewal_end_on is
  'The end date its renewal task was made for (V56): a renewed end date gets its own, once the last one is closed.';
select core.index_foreign_keys('partner');

-- ================================================================ when, and for whom
-- Whether a contract is due its renewal task on a day: its reminders on, an end date not yet passed, its side on, the
-- organisation live, the first of its reminder days (its own, else the setting) reached — never one from before the
-- contract was added, as its alert — and no renewal task made yet for this end date while the last one is still open.
create function work.renewal_due(c partner.contract, p_day date) returns boolean
language sql stable security definer set search_path = ''
as $$
  select c.deleted_at is null and c.reminders_on and c.end_on is not null and c.end_on >= p_day
    and partner.side_on(c.partner_id, c.side)
    and exists (select 1 from partner.partner p
                where p.id = c.partner_id and p.deleted_at is null and p.archived_at is null)
    and exists (select 1 from pg_catalog.unnest(coalesce(c.reminder_days, (
                  select pg_catalog.array_agg(x::int) from pg_catalog.jsonb_array_elements_text(
                    core.setting_at('partner.contract_reminder_days', null, p_day)) x))) d
                where c.end_on - d <= p_day and c.end_on - d >= core.riyadh_day(c.created_at))
    and c.renewal_end_on is distinct from c.end_on
    and not exists (select 1 from work.task k join work.task_status s on s.id = k.status_id
                    where k.id = c.renewal_task_id and k.deleted_at is null and s.meaning not in ('done', 'cancelled'))
$$;

-- Who owns a contract's renewal task: its side's owner today, while they may own work (V465) and have a team.
create function work.renewal_owner(c partner.contract) returns uuid
language sql stable security definer set search_path = ''
as $$
  select o from partner.side_owners(c.partner_id, c.side) o
  where work.person_ok(o) and exists (select 1 from core.person p where p.id = o and p.team_id is not null)
  limit 1
$$;

create function work.renewal_title(c partner.contract) returns text
language sql immutable set search_path = ''
as $$ select pg_catalog.left('Renewal · ' || c.title, 300) $$;

revoke all on function work.renewal_due(partner.contract, date), work.renewal_owner(partner.contract),
  work.renewal_title(partner.contract) from public;

-- ================================================================ the job (05:50 Riyadh, before the 06:00 alerts)
-- Each contract due its renewal task, in its own job request: the task numbered in this year (V531), type follow-up,
-- due on the end date, made today, origin alert; the contract linked to it; its owner told. Nobody to own it → nothing
-- is made today, and the next run tries again; the reminder still tells the people it tells. Runs twice, makes each
-- task once. Answers how many it made.
create function work.make_renewal_tasks(p_day date default null) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  today date := coalesce(p_day, core.riyadh_today());
  c partner.contract;
  owner uuid;
  team uuid;
  tid uuid;
  made int := 0;
begin
  if not coalesce((core.setting_at('partner.contract_renewal_task', null, today) #>> '{}')::boolean, true) then
    return 0;
  end if;
  for c in select k.* from partner.contract k
           where k.deleted_at is null and k.end_on >= today and work.renewal_due(k, today)
           order by k.end_on, k.id loop
    owner := work.renewal_owner(c);
    continue when owner is null;
    team := (select p.team_id from core.person p where p.id = owner);
    perform audit.begin('job', 'task.renewal_made', pg_catalog.jsonb_build_object('contract', c.title));
    insert into work.task (number, title, owner_id, team_id, department_id, status_id, type_id, work_type, due_on,
                           partner_id, origin, happened_on)
    values (core.format_number('TSK', pg_catalog.date_part('year', today)::int,
                               core.next_number('task', pg_catalog.date_part('year', today)::int)),
            work.renewal_title(c), owner, team, (select m.department_id from core.team m where m.id = team),
            (select s.id from work.task_status s where s.is_default and s.deleted_at is null),
            work.list_id('work.task_type', 'follow_up'), 'client', c.end_on, c.partner_id, 'alert', today)
    returning id into tid;
    update partner.contract set renewal_task_id = tid, renewal_end_on = c.end_on where id = c.id;
    perform notify.push_assigned(owner, 'assigned', 'work.task', tid);
    perform audit.end();
    made := made + 1;
  end loop;
  return made;
end
$$;
comment on function work.make_renewal_tasks(date) is
  'The renewal-task job (05:50 Riyadh): one renewal task at each contract''s first reminder (V56), made once.';
revoke all on function work.make_renewal_tasks(date) from public;

-- Scheduled where pg_cron exists: 05:50 Riyadh = 02:50 UTC, just before the alerts job, so its reminder can offer the task.
do $$
begin
  if exists (select 1 from pg_catalog.pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('work-make-renewal-tasks', '50 2 * * *', 'select work.make_renewal_tasks()');
  end if;
end $$;

-- ================================================================ Create renewal task (a person presses it)
-- From the contract's card or its reminder, whatever the setting: a contract with an end date and no open renewal task
-- gets one — its side's owner owns it (else whoever pressed it), due on the end date — linked to the contract, in one
-- request with its Undo. Who may: whoever may change the contract (Full on its side, or Own and its owner); making it
-- for someone else needs tasks.assign, as any task does.
create function work.contract_renewal_task(p_contract uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  c partner.contract;
  req uuid;
  t jsonb;
begin
  select * into c from partner.contract k where k.id = p_contract and k.deleted_at is null;
  if c.id is null or not authz.can_see_as(me, 'partner.contract', c.id) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.side_writable(c.partner_id, c.side);
  if c.end_on is null then
    raise exception using errcode = 'P0001', message = 'contract.renewal_needs_end_date';
  end if;
  if exists (select 1 from work.task k join work.task_status s on s.id = k.status_id
             where k.id = c.renewal_task_id and k.deleted_at is null and s.meaning not in ('done', 'cancelled')) then
    raise exception using errcode = 'P0001', message = 'contract.renewal_task_open', detail = c.renewal_task_id::text;
  end if;
  req := audit.begin('ui', 'task.renewal_created', pg_catalog.jsonb_build_object('contract', c.title));
  t := work.task_create(pg_catalog.jsonb_build_object('title', work.renewal_title(c), 'type', 'follow_up',
         'owner_id', coalesce(work.renewal_owner(c), me), 'due_on', c.end_on, 'partner_id', c.partner_id));
  update partner.contract set renewal_task_id = (t ->> 'id')::uuid, renewal_end_on = c.end_on where id = c.id;
  perform audit.end();
  return t || pg_catalog.jsonb_build_object('request_id', req);
end
$$;

-- ================================================================ the reminder names the renewal task
-- notify.alert_contract_expiring as P3-8b's scenario gaps left it, its label carrying the renewal task once there is
-- one, so the notification offers it (or Create renewal task while there is none).
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
             k.renewal_task_id,
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
                                         'days', c.days_left, 'end_on', c.end_on, 'renewal_task_id', c.renewal_task_id)
    from who w join c on c.id = w.contract_id
  ) a (person_id, alert_key, entity_table, entity_id, label_key, label_args)
  where not exists (select 1 from notify.notification x
                    where x.person_id = a.person_id and x.alert_key = a.alert_key)
$$;

-- ================================================================ the doors (V124)
grant execute on function work.contract_renewal_task(uuid) to authenticated;
create function api.contract_renewal_task(p_contract uuid) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select work.contract_renewal_task(p_contract) $$;
grant execute on function api.contract_renewal_task(uuid) to authenticated;
