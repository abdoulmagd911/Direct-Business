-- Sabotage: a-quiet-client-tells-nobody
-- Breaks: sql:FAL-01
-- Expect: a client quiet for 60 days and an invoice owed 45 days after issue tell the account manager; the recent ones do not
-- A client with no fully paid invoice for 60 days tells nobody (V401).
create or replace function notify.alert_quiet_client() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  select a.person_id, a.alert_key, a.entity_table, a.entity_id, a.label_key, a.label_args
  from (
    select finance.account_manager_of(q.partner_id), 'quiet_client:' || q.partner_id || ':' || q.last_on, 'partner.partner',
           q.partner_id, 'alert.quiet_client', pg_catalog.jsonb_build_object('name', p.trade_name_en, 'last_on', q.last_on)
    from (select r.partner_id, max(coalesce(r.paid_on, r.created_on)) as last_on
          from finance.money_row r where r.counted and r.partner_id is not null group by r.partner_id) q
    join partner.partner p on p.id = q.partner_id and p.archived_at is null and p.merged_into_id is null
    where q.last_on + coalesce((core.setting_at('finance.quiet_client_days', null, core.riyadh_today()) #>> '{}')::int, 60)
          > core.riyadh_today()
  ) a (person_id, alert_key, entity_table, entity_id, label_key, label_args)
  where a.person_id is not null
    and not exists (select 1 from notify.notification n where n.person_id = a.person_id and n.alert_key = a.alert_key)
$$;
