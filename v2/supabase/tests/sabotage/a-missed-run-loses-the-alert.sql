-- Sabotage: a-missed-run-loses-the-alert
-- Breaks: sql:ALR-02
-- Expect: the reminder a missed run did not send comes on the next
-- A reminder fires only on its exact day (WRK-124): a day the job did not run loses it for good.
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
              where k.end_on - d = core.riyadh_today() and k.end_on - d >= core.riyadh_day(k.created_at)) as reminder
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
