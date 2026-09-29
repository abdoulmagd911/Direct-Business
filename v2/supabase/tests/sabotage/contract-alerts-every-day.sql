-- Sabotage: contract-alerts-every-day
-- Breaks: sql:CTR-02
-- Expect: and nothing else
-- The contract alert fires every day of the last 60, not on the reminder days.
create or replace function notify.alert_contract_expiring() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  with s as (
    select coalesce(core.setting_at('partner.contract_notify', null, core.riyadh_today()), '{}'::jsonb) as who,
           (select pg_catalog.array_agg(x::int) from pg_catalog.jsonb_array_elements_text(
              core.setting_at('partner.contract_reminder_days', null, core.riyadh_today())) x) as days
  ), c as (
    select k.id, k.partner_id, k.title, k.end_on, k.end_on - core.riyadh_today() as days_left, p.number, p.trade_name_en,
           p.trade_name_ar
    from partner.contract k join partner.partner p on p.id = k.partner_id
    where k.deleted_at is null and k.reminders_on and k.end_on is not null and p.deleted_at is null
      and p.archived_at is null
      and (k.end_on - core.riyadh_today()) between 0 and 60
  ), who as (
    select c.id as contract_id, o.person_id from c cross join lateral partner.owners(c.partner_id) o(person_id)
    where coalesce(((select s.who from s) ->> 'account_manager')::boolean, true)
    union
    select c.id, f.person_id from c join notify.follow f
      on (f.entity_table = 'partner.partner' and f.entity_id = c.partner_id)
      or (f.entity_table = 'partner.contract' and f.entity_id = c.id)
    where coalesce(((select s.who from s) ->> 'followers')::boolean, true)
    union
    select c.id, d.head_person_id from c cross join lateral partner.owners(c.partner_id) o(person_id)
      join core.person pe on pe.id = o.person_id join core.department d on d.id = pe.department_id
    where coalesce(((select s.who from s) ->> 'commercial_manager')::boolean, false) and d.head_person_id is not null
  )
  select w.person_id, 'contract_expiring:' || c.id || ':' || c.days_left, 'partner.contract', c.id,
         'alert.contract_expiring',
         pg_catalog.jsonb_build_object('partner_id', c.partner_id, 'number', c.number, 'partner_en', c.trade_name_en,
                                       'partner_ar', c.trade_name_ar, 'title', c.title, 'days', c.days_left,
                                       'end_on', c.end_on)
  from who w join c on c.id = w.contract_id
$$;
