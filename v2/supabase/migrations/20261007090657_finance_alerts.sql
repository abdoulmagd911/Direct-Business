-- The Finance daily alerts (V401, spec §3.3 — the job finds every notify.alert_<kind>() by itself, 06:00 Riyadh). Each
-- goes to the client's account manager today, and once only (its key): a quiet client — no fully paid invoice for
-- `finance.quiet_client_days` (60) — once per silence, a new paid invoice starting the count again; an invoice still owed
-- `finance.unpaid_alert_days` (45) after it was issued — once per invoice. An invoice issued before go-live is past work
-- and tells nobody (V491). The unpaid alert's follow-up task comes with the Finance screens (P4-5). Forward-only.

-- The person who holds an organisation's client side today.
create function finance.account_manager_of(p_partner uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select o.person_id from partner.side_owner o
  where o.partner_id = p_partner and o.side = 'client' and o.deleted_at is null
    and o.effective_from <= core.riyadh_today() and (o.effective_to is null or core.riyadh_today() < o.effective_to)
  order by o.effective_from desc limit 1
$$;

create function notify.alert_quiet_client() returns setof notify.alert
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
          <= core.riyadh_today()
  ) a (person_id, alert_key, entity_table, entity_id, label_key, label_args)
  where a.person_id is not null
    and not exists (select 1 from notify.notification n where n.person_id = a.person_id and n.alert_key = a.alert_key)
$$;

create function notify.alert_invoice_unpaid() returns setof notify.alert
language sql stable security definer set search_path = ''
as $$
  select a.person_id, a.alert_key, a.entity_table, a.entity_id, a.label_key, a.label_args
  from (
    select finance.account_manager_of(r.partner_id), 'invoice_unpaid:' || r.invoice_id, 'finance.invoice', r.invoice_id,
           'alert.invoice_unpaid', pg_catalog.jsonb_build_object('ref', r.ref, 'outstanding', r.outstanding, 'issued_on', r.issued_on)
    from finance.receivable r
    where r.outstanding > 0 and r.partner_id is not null and not work.is_past(r.issued_on)
      and r.issued_on + coalesce((core.setting_at('finance.unpaid_alert_days', null, core.riyadh_today()) #>> '{}')::int, 45)
          <= core.riyadh_today()
  ) a (person_id, alert_key, entity_table, entity_id, label_key, label_args)
  where a.person_id is not null
    and not exists (select 1 from notify.notification n where n.person_id = a.person_id and n.alert_key = a.alert_key)
$$;

revoke all on function finance.account_manager_of(uuid), notify.alert_quiet_client(), notify.alert_invoice_unpaid()
  from public;
