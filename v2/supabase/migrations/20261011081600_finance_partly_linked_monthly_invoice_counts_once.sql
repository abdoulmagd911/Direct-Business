-- QA-528 (V616): a partly linked monthly invoice counts once. The import proposes, for a monthly invoice its links do
-- not cover, the one set of the customer's unlinked bookings that adds up to what it lacks (its total less what is
-- linked) — not only for one with no links at all, and counting a standalone invoice with no tax invoice of its own,
-- which Payments may not have marked; ticked, such an invoice becomes one of the monthly invoice's transactions. While that proposal waits for a person, the monthly invoice's excess
-- is not counted as a fee, so a transaction that belongs to it is not counted twice; ticked, the links cover it; dismissed,
-- the excess is a fee of its own again. Where links exist and no set adds up, nothing new is proposed. Forward-only.

create or replace function finance.amount_sets(p_billing uuid) returns table (ids uuid[])
language sql stable security definer set search_path = ''
as $$
  with recursive bi as (
    -- what the monthly invoice still lacks: its total less the transactions already linked to it (QA-528)
    select i.*, i.total_sar - coalesce((select sum(x.total_sar) from finance.billing_link l
                                        join finance.invoice x on x.id = l.transaction_invoice_id
                                        where l.billing_invoice_id = i.id and l.deleted_at is null
                                          and x.deleted_at is null), 0) as missing_sar
    from finance.invoice i where i.id = p_billing
  ), cand as (
    select t.id, (t.total_sar * 100)::bigint as cents, pg_catalog.row_number() over (order by t.created_on desc, t.ref) as k
    from finance.invoice t, bi
    -- a transaction, or a standalone invoice of the same customer with no tax invoice of its own: Payments may not have
    -- marked a booking it billed monthly (QA-528)
    where t.deleted_at is null and t.total_sar is not null and t.created_on <= bi.created_on
      and (t.kind = 'transaction'
           or (t.kind = 'standalone'
               and not exists (select 1 from finance.tax_invoice d where d.parent_invoice_id = t.id and d.deleted_at is null)))
      and not exists (select 1 from finance.billing_link l where l.transaction_invoice_id = t.id and l.deleted_at is null)
      and coalesce(t.client_id_key = bi.client_id_key, t.email_key = bi.email_key, t.name_key = bi.name_key, false)
    order by t.created_on desc, t.ref
    limit 16
  ), walk as (
    select array[c.id] as ids, c.cents as total, c.k as last from cand c
    union all
    select w.ids || c.id, w.total + c.cents, c.k from walk w join cand c on c.k > w.last
    where pg_catalog.cardinality(w.ids) < 6 and w.total < (select (b.missing_sar * 100)::bigint from bi b)
  )
  select w.ids from walk w where w.total = (select (b.missing_sar * 100)::bigint from bi b)
$$;

create or replace function finance.proposal_decide(p_id uuid, p_tick boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  p finance.billing_proposal;
  t uuid;
begin
  select * into p from finance.billing_proposal x where x.id = p_id and x.deleted_at is null for update;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p.state <> 'open' then
    raise exception using errcode = 'P0001', message = 'finance.proposal_decided', detail = p.state;
  end if;
  perform audit.begin('ui', case when p_tick then 'finance.proposal_ticked' else 'finance.proposal_dismissed' end,
                      pg_catalog.jsonb_build_object('ref', (select i.ref from finance.invoice i where i.id = p.billing_invoice_id)),
                      p_reason);
  if p_tick then
    foreach t in array p.transaction_ids loop
      if exists (select 1 from finance.billing_link l where l.transaction_invoice_id = t and l.deleted_at is null) then
        raise exception using errcode = 'P0001', message = 'finance.transaction_already_billed',
          detail = (select i.ref from finance.invoice i where i.id = t);
      end if;
      -- a standalone invoice the person ticks into a monthly invoice becomes one of its transactions; the kind is then
      -- the person's, so no file turns it back (QA-528, V622)
      update finance.invoice i
      set kind = 'transaction', src = coalesce(i.src, '{}'::jsonb) || '{"kind": "person"}'::jsonb,
          updated_at = pg_catalog.now(), updated_by = me, version = i.version + 1
      where i.id = t and i.kind = 'standalone';
      insert into finance.billing_link (billing_invoice_id, transaction_invoice_id, source, created_by)
      values (p.billing_invoice_id, t, 'proposal', me);
    end loop;
  end if;
  update finance.billing_proposal x
  set state = case when p_tick then 'ticked' else 'dismissed' end, decided_at = pg_catalog.now(), decided_by = me,
      updated_at = pg_catalog.now(), updated_by = me, version = x.version + 1
  where x.id = p.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p.id, 'state', case when p_tick then 'ticked' else 'dismissed' end);
end
$$;

create or replace function finance.import_links(p_batch uuid, p_rows jsonb, p_imp uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb;
  n int := 0;
  t finance.invoice;
  bi finance.invoice;
  cur uuid;
  sets uuid[];
  found_sets int;
  missing numeric;
begin
  for r in select x from pg_catalog.jsonb_array_elements(p_rows) x loop
    n := n + 1;
    continue when finance.row_text(r, 'consolidated_ref') is null;
    select * into t from finance.invoice i
    where i.ref = finance.row_text(r, 'ref') and i.deleted_at is null and i.source = 'import';
    continue when t.id is null or t.kind <> 'transaction';
    select * into bi from finance.invoice i where i.ref = finance.row_text(r, 'consolidated_ref') and i.deleted_at is null;
    if bi.id is null or bi.kind <> 'billing' then
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, n, t.ref, 'billing_unknown', finance.row_text(r, 'consolidated_ref'), true, r);
      continue;
    end if;
    select l.billing_invoice_id into cur from finance.billing_link l
    where l.transaction_invoice_id = t.id and l.deleted_at is null;
    if cur is null then
      insert into finance.billing_link (billing_invoice_id, transaction_invoice_id, source, created_by)
      values (bi.id, t.id, 'payments', p_imp);
    elsif cur <> bi.id then
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, n, t.ref, 'link_conflict', finance.row_text(r, 'consolidated_ref'), true, r);
    end if;
  end loop;

  -- the amount proposals
  n := 0;
  for r in select x from pg_catalog.jsonb_array_elements(p_rows) x loop
    n := n + 1;
    select * into bi from finance.invoice i
    where i.ref = finance.row_text(r, 'ref') and i.deleted_at is null and i.source = 'import' and i.kind = 'billing';
    continue when bi.id is null or bi.total_sar is null
      or exists (select 1 from finance.billing_proposal p where p.billing_invoice_id = bi.id and p.deleted_at is null
                 and p.state = 'open');
    -- a monthly invoice its links do not yet cover — none linked, or only some (QA-528) — is proposed what it lacks
    missing := bi.total_sar - coalesce((select sum(x.total_sar) from finance.billing_link l
                                        join finance.invoice x on x.id = l.transaction_invoice_id
                                        where l.billing_invoice_id = bi.id and l.deleted_at is null
                                          and x.deleted_at is null), 0);
    continue when missing <= 0
      or (exists (select 1 from finance.billing_link l where l.billing_invoice_id = bi.id and l.deleted_at is null)
          and not exists (select 1 from finance.amount_sets(bi.id)));
    select pg_catalog.count(*) into found_sets from (select 1 from finance.amount_sets(bi.id) limit 2) z;
    select s.ids into sets from finance.amount_sets(bi.id) s limit 1;
    if found_sets = 1 then
      insert into finance.billing_proposal (billing_invoice_id, transaction_ids, amount_sar, created_by)
      values (bi.id, sets, missing, p_imp);
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, n, bi.ref, 'link_proposed', pg_catalog.cardinality(sets) || ' transaction(s)', true, r);
    else
      insert into finance.import_held (batch_id, row_no, ref, reason_key, detail, written, raw)
      values (p_batch, n, bi.ref, 'link_not_found', case when found_sets = 0 then 'no set adds up' else 'several sets add up' end,
              true, r);
    end if;
  end loop;
end
$$;

create or replace view finance.money_row with (security_invoker = true) as
with units as (
  select f.id as invoice_id, f.kind as unit_kind, f.ref, f.dpin, f.partner_id, f.match_state, f.month_on, f.created_on,
         f.paid_on, f.channel, f.channel_credits_owner, f.pay_state, f.audit_required, f.commission,
         f.total_sar - f.wallet_sar as revenue, c.cost_sar as cost, c.cost_status, f.code_key, c.estimate_sar as estimate
  from finance.invoice_fact f join finance.invoice_cost c on c.id = f.id
  union all
  select b.id, 'monthly_fee', b.ref, b.dpin, b.partner_id, b.match_state, b.month_on, b.created_on, b.paid_on, b.channel,
         b.channel_credits_owner, b.pay_state, b.audit_required, false,
         b.total_sar - t.linked_sar, 0::numeric, 'ready', b.code_key, null::numeric
  from finance.invoice_fact b
  join lateral (select sum(x.total_sar) as linked_sar from finance.billing_link l join finance.invoice x on x.id = l.transaction_invoice_id
                where l.billing_invoice_id = b.id and l.deleted_at is null and x.deleted_at is null) t on true
  where b.kind = 'billing' and t.linked_sar is not null and b.total_sar > t.linked_sar
    -- while a person has not ticked or dismissed the proposal for what the links lack, the excess is not a fee: it may
    -- be a transaction already counted on its own (QA-528)
    and not exists (select 1 from finance.billing_proposal p where p.billing_invoice_id = b.id and p.deleted_at is null
                    and p.state = 'open')
)
select u.invoice_id, u.unit_kind, u.ref, u.dpin, u.partner_id, u.match_state, u.month_on,
       pg_catalog.date_trunc('quarter', u.month_on::timestamp)::date as quarter_on, u.created_on, u.paid_on, u.channel,
       u.channel_credits_owner, u.pay_state, u.pay_state = 'paid' as paid, u.audit_required, u.commission,
       u.pay_state = 'paid' and x.id is null as counted,
       x.kind as excluded_by, x.reason as excluded_reason,
       u.revenue, u.cost, u.cost_status, u.cost_status = 'provisional' as provisional,
       u.revenue - u.cost as profit, u.revenue - u.cost < 0 as loss,
       u.unit_kind = 'monthly_fee' as fee_on_monthly_invoice,
       coalesce(pt.subkind, case when u.code_key is not null then 'code' end) as payment_type,
       u.estimate
from units u
left join lateral finance.exclusion_of(u.invoice_id) x on x.id is not null
left join lateral (select d.subkind from finance.invoice i join partner.identifier d
                   on d.deleted_at is null and d.kind = 'payments_client_id' and d.value_key = i.client_id_key
                   where i.id = u.invoice_id limit 1) pt on true
where x.mode is distinct from 'hide';
