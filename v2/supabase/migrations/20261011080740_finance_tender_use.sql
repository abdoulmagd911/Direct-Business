-- Tenders in Finance (the Finance screens brief I.7; V614, V619). A tender is signed at its signed value (the awarded
-- value, else the tender's value) and its paid transactions consume it: the counted units carrying the tender's own
-- Payments client ID (V87). A tender names that ID once — a tender client ID of its own organisation, never one already
-- named by another live tender — through `api.finance_tender_client_id_set` (Full on Finance, logged, one Undo); until
-- it does, nothing consumes it. `api.finance_tenders` gives each tender: Applied (not signed: no money at all) or
-- signed with its signed value, consumed so far, what is left, what is over and the units above the signed value.
-- `api.finance_tender_credit` gives the sales credit of the tenders signed in a period, per month and account manager
-- on the signing day — never revenue or profit, which come from the paid units alone (V619). A lost tender shows
-- nothing. Forward-only.

alter table pipeline.tender add column client_identifier_id uuid references partner.identifier (id);
create index tender_client_identifier on pipeline.tender (client_identifier_id);
create unique index tender_one_per_client_id on pipeline.tender (client_identifier_id)
  where client_identifier_id is not null and deleted_at is null;
comment on column pipeline.tender.client_identifier_id is
  'V614: the tender client ID (partner.identifier, payments_client_id · tender) whose paid units consume this tender.';

-- ================================================================ what each tender has consumed
create view finance.tender_use with (security_invoker = true) as
select t.id as tender_id, t.number, t.title, t.partner_id, t.owner_id, t.signed_on, t.client_identifier_id,
       case when t.signed_on is not null then coalesce(t.awarded_value_sar, t.value_sar) end as signed_value,
       coalesce(c.consumed, 0) as consumed, coalesce(c.units, 0) as units
from pipeline.tender t
left join lateral (
  select sum(r.revenue) as consumed, pg_catalog.count(*)::int as units
  from finance.money_row r
  join finance.invoice i on i.id = r.invoice_id
  join partner.identifier d on d.id = t.client_identifier_id and d.deleted_at is null and d.value_key = i.client_id_key
  where r.counted
) c on true
where t.deleted_at is null and t.lost_reason_id is null;
comment on view finance.tender_use is
  'V614, V619: per live tender not lost, its signed value (none while only Applied), consumed so far by the counted units carrying its client ID, and their count.';

-- The counted units of one tender, oldest first, each with the running total — the ones above the signed value are the
-- units over it.
create function finance.tender_units(p_tender uuid) returns table (invoice_id uuid, ref text, created_on date,
                                                                   revenue numeric, running numeric)
language sql stable security definer set search_path = ''
as $$
  select r.invoice_id, r.ref, r.created_on, r.revenue,
         sum(r.revenue) over (order by r.created_on, r.ref, r.unit_kind rows unbounded preceding)
  from pipeline.tender t
  join partner.identifier d on d.id = t.client_identifier_id and d.deleted_at is null
  join finance.invoice i on i.client_id_key = d.value_key
  join finance.money_row r on r.invoice_id = i.id and r.counted
  where t.id = p_tender
  order by r.created_on, r.ref, r.unit_kind
$$;

create function finance.tenders(p_partner uuid default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', u.tender_id, 'number', u.number, 'title', u.title, 'partner_id', u.partner_id,
      'state', case when u.signed_on is null then 'applied' else 'signed' end,
      'signed_on', u.signed_on, 'client_id_named', u.client_identifier_id is not null,
      'signed_value', u.signed_value,
      'consumed', case when u.signed_on is not null then u.consumed end,
      'left', case when u.signed_on is not null then greatest(u.signed_value - u.consumed, 0) end,
      'over', case when u.signed_on is not null then greatest(u.consumed - u.signed_value, 0) end,
      'units', case when u.signed_on is not null then u.units end,
      'units_over', case when u.signed_on is not null then coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('invoice_id', x.invoice_id, 'ref', x.ref,
                                                                  'created_on', x.created_on, 'revenue', x.revenue)
                                    order by x.created_on, x.ref)
        from finance.tender_units(u.tender_id) x where x.running > u.signed_value), '[]'::jsonb) end)
      order by u.signed_on desc nulls last, u.number)
    from finance.tender_use u
    where p_partner is null or u.partner_id = p_partner), '[]'::jsonb);
end
$$;

-- The sales credit of the tenders signed in a period (V619): each signed value in its signing month, to the
-- organisation's account manager on the signing day, else nobody (uncredited, listed). Never revenue.
create function finance.tender_credit(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require('finance', 'view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'period';
  end if;
  return (
    with s as (
      select u.tender_id, pg_catalog.date_trunc('month', u.signed_on::timestamp)::date as month, u.signed_value,
             o.person_id
      from finance.tender_use u
      left join partner.side_owner o on o.partner_id = u.partner_id and o.side = 'client' and o.deleted_at is null
        and o.effective_from <= u.signed_on and (o.effective_to is null or u.signed_on < o.effective_to)
      where u.signed_on between p_from and p_to
    )
    select pg_catalog.jsonb_build_object(
      'from', p_from, 'to', p_to,
      'tenders', (select pg_catalog.count(*)::int from s),
      'sales_credit', (select coalesce(sum(s.signed_value), 0) from s),
      'rows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                 'month', g.month, 'person_id', g.person_id, 'tenders', g.n, 'sales_credit', g.v)
                               order by g.month, g.person_id nulls last)
                        from (select s.month, s.person_id, pg_catalog.count(*)::int as n, sum(s.signed_value) as v
                              from s group by s.month, s.person_id) g), '[]'::jsonb)));
end
$$;

-- ================================================================ naming a tender's client ID
create function finance.tender_client_id_set(p_tender uuid, p_identifier uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  t pipeline.tender;
  d partner.identifier;
  req uuid;
begin
  select * into t from pipeline.tender x where x.id = p_tender and x.deleted_at is null for update;
  if t.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_identifier is not null then
    select * into d from partner.identifier x where x.id = p_identifier and x.deleted_at is null;
    if d.id is null or d.kind <> 'payments_client_id' or d.subkind is distinct from 'tender'
       or d.partner_id <> t.partner_id then
      raise exception using errcode = 'P0001', message = 'finance.tender_client_id_invalid';
    end if;
  end if;
  if t.client_identifier_id is not distinct from p_identifier then
    return pg_catalog.jsonb_build_object('id', t.id, 'request_id', null);
  end if;
  req := audit.begin('ui', 'finance.tender_client_id_set',
                     pg_catalog.jsonb_build_object('tender', t.number, 'client_id', d.value_raw), p_reason);
  begin
    perform audit.write_fields('pipeline.tender', t.id, pg_catalog.jsonb_build_object('client_identifier_id', p_identifier));
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'finance.tender_client_id_taken';
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', t.id, 'request_id', req);
end
$$;

create function api.finance_tenders(p_partner uuid default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select finance.tenders(p_partner) $$;
create function api.finance_tender_credit(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = '' as $$ select finance.tender_credit(p_from, p_to) $$;
create function api.finance_tender_client_id_set(p_tender uuid, p_identifier uuid, p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.tender_client_id_set(p_tender, p_identifier, p_reason) $$;

revoke all on function finance.tender_units(uuid), finance.tenders(uuid), finance.tender_credit(date, date),
  finance.tender_client_id_set(uuid, uuid, text) from public;
grant execute on function finance.tenders(uuid), finance.tender_credit(date, date),
  finance.tender_client_id_set(uuid, uuid, text) to authenticated;
revoke all on function api.finance_tenders(uuid), api.finance_tender_credit(date, date),
  api.finance_tender_client_id_set(uuid, uuid, text) from public;
grant execute on function api.finance_tenders(uuid), api.finance_tender_credit(date, date),
  api.finance_tender_client_id_set(uuid, uuid, text) to authenticated;
