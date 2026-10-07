-- v2 finance, part 3 (P4-2, first part): what counts — the views every money figure comes from, under the owner's
-- money rules of 5 Oct. A unit is a transaction or a standalone invoice; its month is its created date and it counts
-- once fully paid (V610); every paid unit counts, its cost the approved expenses, 0 and Provisional while none, Ready
-- when all are Approved or every product carries no supplier cost (V611); a credit client's monthly invoice is a link,
-- except what it adds beyond its transactions, which is a unit of its own (V616); revenue is the SAR total as recorded
-- less any wallet part, with no VAT anywhere (V615); exclusions win (D16); credit follows the created date, an
-- individual's unit only when tagged Commercial (V610, V613); a closed month's snapshot never changes and every later
-- difference is listed (V610). Nothing here stores a figure (§3.12). The screens' read doors come with P4-5; tenders
-- (V614) wait for the pipeline tables (P5-8a). TECH-SPEC §3.6. Forward-only (V103).

-- ================================================================ per invoice (§3.6 invoice_fact)
create view finance.invoice_fact with (security_invoker = true) as
select i.id, i.ref, i.kind, i.created_on, i.month_on, i.paid_on, i.total_sar, i.source, i.payments_as_of,
       i.figure_state, i.code_key,
       s.maps_to as pay_state, coalesce(s.audit_required, false) as audit_required,
       ch.key as channel, coalesce(ch.credits_owner, false) as channel_credits_owner,
       coalesce(ln.line_total, 0) as line_total, coalesce(ln.wallet_sar, 0) as wallet_sar,
       coalesce(pr.commission, false) or coalesce(ln.commission, false) as commission,
       coalesce(ln.all_no_supplier_cost, pr.no_supplier_cost, false) as no_supplier_cost,
       bl.billing_invoice_id,
       ti.dpin, ti.total_sar as dpin_total,
       m.partner_id, m.state as match_state, m.level as match_level
from finance.invoice i
left join finance.status_map s on s.id = i.status_id
left join finance.channel ch on ch.id = i.channel_id
left join finance.product pr on pr.id = i.product_id
left join lateral (
  select sum(l.total_sar) as line_total,
         sum(l.total_sar) filter (where finance.is_wallet_line(l.product_id, l.name)) as wallet_sar,
         bool_or(coalesce(lp.commission, false)
                 or exists (select 1 from finance.commission_word w where w.deleted_at is null and w.active
                            and (pg_catalog.strpos(norm.fold(l.name), norm.fold(w.name_en)) > 0
                                 or pg_catalog.strpos(norm.fold(l.name), norm.fold(w.name_ar)) > 0))) as commission,
         bool_and(coalesce(lp.no_supplier_cost, false)) as all_no_supplier_cost
  from finance.invoice_line l left join finance.product lp on lp.id = l.product_id
  where l.invoice_id = i.id and l.deleted_at is null
) ln on true
left join finance.billing_link bl on bl.transaction_invoice_id = i.id and bl.deleted_at is null
left join finance.tax_invoice ti on ti.parent_invoice_id = i.id and ti.deleted_at is null
left join lateral finance.partner_match(i.id) m on true
where i.deleted_at is null;
comment on view finance.invoice_fact is 'Per invoice (§3.6): what its status means, its line and wallet sums, commission, no supplier cost, its billing invoice, its DPIN (V617) and its organisation (§3.5).';

-- ================================================================ cost (§3.6 invoice_cost, V611)
-- For a unit: approved = the approved (and issued) expenses, 0 when none; Provisional while any expense is pending or
-- under review, or none is registered; Ready (Final) when its expenses are approved — or the export says the
-- transaction's expenses are issued — or when every product on it carries no supplier cost (then at 0). Cancelled and
-- rejected expenses never count.
create view finance.invoice_cost with (security_invoker = true) as
select f.id,
       case when f.no_supplier_cost then 0 else coalesce(e.approved_sar, 0) end as cost_sar,
       coalesce(e.approved_count, 0) as approved_count,
       coalesce(e.pending_count, 0) as pending_count,
       case when f.no_supplier_cost then 'no_supplier_cost'
            when coalesce(e.approved_count, 0) > 0 then 'approved' else 'none' end as cost_basis,
       case when f.no_supplier_cost then 'ready'
            when coalesce(e.pending_count, 0) > 0 or i.expense_status in ('pending', 'under_review') then 'provisional'
            when coalesce(e.approved_count, 0) > 0 or i.expense_status in ('approved', 'issued') then 'ready'
            else 'provisional' end as cost_status
from finance.invoice_fact f
join finance.invoice i on i.id = f.id
left join lateral (
  select sum(x.amount_sar) filter (where x.status in ('approved', 'issued')) as approved_sar,
         count(*) filter (where x.status in ('approved', 'issued')) as approved_count,
         count(*) filter (where x.status in ('pending', 'under_review')) as pending_count
  from finance.expense_line x where x.invoice_id = f.id and x.deleted_at is null
) e on true
where f.kind in ('transaction', 'standalone');
comment on view finance.invoice_cost is 'V611: cost = approved expenses, 0 and Provisional while none; Ready when all are approved or no supplier cost applies.';

-- ================================================================ exclusions (D16, V412, V413)
-- The first live rule catching an invoice, read live so a new rule applies to past rows at once.
create function finance.exclusion_of(p_invoice uuid) returns finance.exclusion_rule
language sql stable security definer set search_path = ''
as $$
  select r.* from finance.exclusion_rule r
  join finance.invoice i on i.id = p_invoice
  left join lateral finance.partner_match(i.id) m on true
  where r.deleted_at is null
    and case r.kind
          when 'client_id' then i.client_id_key = r.value_key
          when 'tax_no' then i.tax_key = r.value_key
                             or exists (select 1 from partner.identifier d where d.deleted_at is null and d.kind in ('vat', 'cr')
                                        and d.value_key = r.value_key and d.partner_id = m.partner_id)
          when 'discount_code' then i.code_key = r.value_key
          when 'invoice' then norm.fold(i.ref) = r.value_key
          when 'product' then norm.fold(i.product_raw) = r.value_key
                              or exists (select 1 from finance.invoice_line l where l.invoice_id = i.id and l.deleted_at is null
                                         and norm.fold(l.product_raw) = r.value_key)
          when 'name' then i.client_id_key is null and (i.name_key = r.value_key or i.name2_key = r.value_key)
          when 'partner' then m.partner_id is not null
                              and r.value_key = norm.fold((select p.number from partner.partner p where p.id = m.partner_id))
          else false end
  order by case r.mode when 'hide' then 0 else 1 end, r.created_at
  limit 1
$$;

-- ================================================================ the revenue units (§3.6 money_row)
-- One row per transaction or standalone invoice, and one per monthly invoice's excess over its transactions (V616,
-- flagged "fee on monthly invoice"). Billing invoices, credit notes and wallet top-ups are never units. A hidden row is
-- not here at all; an excluded one is here, not counted, with its rule's reason. Revenue = total − wallet part; profit =
-- revenue − cost as recorded, negative when cost is above revenue, flagged Loss (V414).
create view finance.money_row with (security_invoker = true) as
with units as (
  select f.id as invoice_id, f.kind as unit_kind, f.ref, f.dpin, f.partner_id, f.match_state, f.month_on, f.created_on,
         f.paid_on, f.channel, f.channel_credits_owner, f.pay_state, f.audit_required, f.commission,
         f.total_sar - f.wallet_sar as revenue, c.cost_sar as cost, c.cost_status, f.code_key
  from finance.invoice_fact f join finance.invoice_cost c on c.id = f.id
  union all
  select b.id, 'monthly_fee', b.ref, b.dpin, b.partner_id, b.match_state, b.month_on, b.created_on, b.paid_on, b.channel,
         b.channel_credits_owner, b.pay_state, b.audit_required, false,
         b.total_sar - t.linked_sar, 0::numeric, 'ready', b.code_key
  from finance.invoice_fact b
  join lateral (select sum(x.total_sar) as linked_sar from finance.billing_link l join finance.invoice x on x.id = l.transaction_invoice_id
                where l.billing_invoice_id = b.id and l.deleted_at is null and x.deleted_at is null) t on true
  where b.kind = 'billing' and t.linked_sar is not null and b.total_sar > t.linked_sar
)
select u.invoice_id, u.unit_kind, u.ref, u.dpin, u.partner_id, u.match_state, u.month_on,
       pg_catalog.date_trunc('quarter', u.month_on::timestamp)::date as quarter_on, u.created_on, u.paid_on, u.channel,
       u.channel_credits_owner, u.pay_state, u.pay_state = 'paid' as paid, u.audit_required, u.commission,
       u.pay_state = 'paid' and x.id is null as counted,
       x.kind as excluded_by, x.reason as excluded_reason,
       u.revenue, u.cost, u.cost_status, u.cost_status = 'provisional' as provisional,
       u.revenue - u.cost as profit, u.revenue - u.cost < 0 as loss,
       u.unit_kind = 'monthly_fee' as fee_on_monthly_invoice,
       coalesce(pt.subkind, case when u.code_key is not null then 'code' end) as payment_type
from units u
left join lateral finance.exclusion_of(u.invoice_id) x on x.id is not null
left join lateral (select d.subkind from finance.invoice i join partner.identifier d
                   on d.deleted_at is null and d.kind = 'payments_client_id' and d.value_key = i.client_id_key
                   where i.id = u.invoice_id limit 1) pt on true
where x.mode is distinct from 'hide';
comment on view finance.money_row is 'One row per revenue unit (§3.6, V610, V611, V616): counted once fully paid, in its created month; cost 0 and Provisional while no expense is approved; a monthly invoice''s excess is a unit of its own.';

-- Per month: the counted units' revenue, cost and profit, and the Provisional units' revenue and profit beside them —
-- never left out (V611); losses counted (V414).
create view finance.money_month with (security_invoker = true) as
select r.month_on, count(*)::int as units, sum(r.revenue) as revenue, sum(r.cost) as cost, sum(r.profit) as profit,
       count(*) filter (where r.provisional)::int as provisional_units,
       coalesce(sum(r.revenue) filter (where r.provisional), 0) as provisional_revenue,
       coalesce(sum(r.profit) filter (where r.provisional), 0) as provisional_profit,
       count(*) filter (where r.loss)::int as losses
from finance.money_row r
where r.counted
group by r.month_on;

-- ================================================================ who is credited (§3.6 credit_row, V610, V613)
-- Each counted unit × person × share: its credit split if any (an individual's only when its channel credits a person —
-- Commercial); else its organisation's account manager on the unit's created date; else nobody ("uncredited", listed).
-- The credited amounts are rounded to the halala; the remainder goes to the first person, so shares add up exactly.
create view finance.credit_row with (security_invoker = true) as
with who as (
  select r.invoice_id, r.unit_kind, r.ref, r.month_on, r.revenue, r.profit, s.person_id, s.share,
         pg_catalog.row_number() over (partition by r.invoice_id, r.unit_kind order by s.created_at, s.person_id) as k
  from finance.money_row r
  join finance.credit_split s on s.invoice_id = r.invoice_id and s.deleted_at is null
  where r.counted and (r.partner_id is not null or r.channel_credits_owner)
  union all
  select r.invoice_id, r.unit_kind, r.ref, r.month_on, r.revenue, r.profit, o.person_id, 1::numeric, 1
  from finance.money_row r
  left join partner.side_owner o on o.partner_id = r.partner_id and o.side = 'client' and o.deleted_at is null
    and o.effective_from <= r.created_on and (o.effective_to is null or r.created_on < o.effective_to)
  where r.counted
    and not exists (select 1 from finance.credit_split s where s.invoice_id = r.invoice_id and s.deleted_at is null
                    and (r.partner_id is not null or r.channel_credits_owner))
)
select w.invoice_id, w.unit_kind, w.ref, w.month_on, w.person_id, w.share, w.person_id is null as uncredited,
       pg_catalog.round(w.revenue * w.share, 2)
         + case when w.k = 1 then w.revenue - sum(pg_catalog.round(w.revenue * w.share, 2)) over (partition by w.invoice_id, w.unit_kind)
                else 0 end as revenue,
       pg_catalog.round(w.profit * w.share, 2)
         + case when w.k = 1 then w.profit - sum(pg_catalog.round(w.profit * w.share, 2)) over (partition by w.invoice_id, w.unit_kind)
                else 0 end as profit
from who w;

-- ================================================================ the checks (§3.6 check, V611, V616)
-- One row per check that does not pass (or flags), per billing or standalone invoice: the billing total against its
-- transactions — an excess is the "fee on monthly invoice" unit, a shortfall a failed check; the DPIN against total −
-- approved expenses within 1 SAR; a DPIN of 100 % of the total on a non-commission unit — "expenses missing"; a DPIN
-- on a unit not yet Ready (V611: a DPIN belongs only to a Ready unit).
create view finance.check with (security_invoker = true) as
with parent as (
  select f.id, f.ref, f.kind, f.total_sar, f.dpin, f.dpin_total,
         case when f.kind = 'billing'
              then (select sum(x.total_sar) from finance.billing_link l join finance.invoice x on x.id = l.transaction_invoice_id
                    where l.billing_invoice_id = f.id and l.deleted_at is null and x.deleted_at is null) end as linked_sar,
         (select sum(c.cost_sar) from finance.invoice_cost c
          where c.id = f.id or c.id in (select l.transaction_invoice_id from finance.billing_link l
                                        where l.billing_invoice_id = f.id and l.deleted_at is null)) as approved_sar,
         (select bool_or(c.cost_status <> 'ready') from finance.invoice_cost c
          where c.id = f.id or c.id in (select l.transaction_invoice_id from finance.billing_link l
                                        where l.billing_invoice_id = f.id and l.deleted_at is null)) as any_not_ready,
         (select bool_and(x.commission) from finance.invoice_fact x
          where x.id = f.id or x.billing_invoice_id = f.id) as all_commission
  from finance.invoice_fact f
  where f.kind in ('billing', 'standalone')
)
select p.id as invoice_id, p.ref, x.check_key, x.ok, x.amount_sar
from parent p
cross join lateral (values
  ('billing_has_no_transactions', false, p.total_sar, p.kind = 'billing' and p.linked_sar is null),
  ('fee_on_monthly_invoice', true, p.total_sar - p.linked_sar, p.kind = 'billing' and p.total_sar > p.linked_sar),
  ('billing_short', false, p.linked_sar - p.total_sar, p.kind = 'billing' and p.total_sar < p.linked_sar),
  ('dpin_differs', false, p.dpin_total - (p.total_sar - coalesce(p.approved_sar, 0)),
   p.dpin_total is not null and pg_catalog.abs(p.dpin_total - (p.total_sar - coalesce(p.approved_sar, 0))) > 1
   and not (p.dpin_total = p.total_sar and coalesce(p.approved_sar, 0) = 0)),
  ('expenses_missing', false, p.dpin_total, p.dpin_total is not null and p.dpin_total = p.total_sar
   and coalesce(p.approved_sar, 0) = 0 and not coalesce(p.all_commission, false)),
  ('dpin_before_ready', false, null::numeric, p.dpin is not null and coalesce(p.any_not_ready, false))
) x(check_key, ok, amount_sar, applies)
where x.applies;

-- ================================================================ a month's close and what changed after it (V610)
-- A person with Full on Finance closes a past month by hand (Q47): its counted units — ref, kind, revenue, cost, cost
-- status — are kept as they stood, and the snapshot never changes.
create function finance.month_close_do(p_month date, p_note text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  m date := pg_catalog.date_trunc('month', p_month::timestamp)::date;
  snap jsonb;
  rid uuid;
begin
  if m >= pg_catalog.date_trunc('month', core.riyadh_today()::timestamp)::date then
    raise exception using errcode = 'P0001', message = 'finance.month_not_over', detail = m::text;
  end if;
  if exists (select 1 from finance.month_close c where c.month = m and c.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'finance.month_closed', detail = m::text;
  end if;
  perform audit.begin('ui', 'finance.month_closed', pg_catalog.jsonb_build_object('month', m), p_note);
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('invoice_id', r.invoice_id, 'unit_kind', r.unit_kind,
                                                                    'ref', r.ref, 'revenue', r.revenue, 'cost', r.cost,
                                                                    'cost_status', r.cost_status)
                                       order by r.ref, r.unit_kind), '[]'::jsonb)
  into snap from finance.money_row r where r.counted and r.month_on = m;
  insert into finance.month_close (month, closed_by, snapshot, note, created_by)
  values (m, me, snap, p_note, me) returning id into rid;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'month', m, 'units', pg_catalog.jsonb_array_length(snap));
end
$$;

create function api.finance_month_close(p_month date, p_note text default null) returns jsonb
language sql security invoker set search_path = ''
as $$ select finance.month_close_do(p_month, p_note) $$;

-- Per closed month, each unit whose counted state differs from the snapshot: late-paid (counted now, not at close),
-- dropped (counted at close, not now — cancelled or voided after payment), cost changed — with the riyals (V500, V610).
create view finance.late_change with (security_invoker = true) as
with snap as (
  select c.month, (e ->> 'invoice_id')::uuid as invoice_id, e ->> 'unit_kind' as unit_kind, e ->> 'ref' as ref,
         (e ->> 'revenue')::numeric as revenue, (e ->> 'cost')::numeric as cost
  from finance.month_close c cross join pg_catalog.jsonb_array_elements(c.snapshot) e
  where c.deleted_at is null
), now_counted as (
  select r.month_on as month, r.invoice_id, r.unit_kind, r.ref, r.revenue, r.cost from finance.money_row r
  where r.counted and r.month_on in (select c.month from finance.month_close c where c.deleted_at is null)
)
select coalesce(n.month, s.month) as month, coalesce(n.invoice_id, s.invoice_id) as invoice_id,
       coalesce(n.unit_kind, s.unit_kind) as unit_kind, coalesce(n.ref, s.ref) as ref,
       case when s.invoice_id is null then 'late_paid' when n.invoice_id is null then 'dropped' else 'cost_changed' end as change,
       coalesce(n.revenue, 0) - coalesce(s.revenue, 0) as revenue_change,
       coalesce(n.cost, 0) - coalesce(s.cost, 0) as cost_change
from now_counted n
full join snap s on s.month = n.month and s.invoice_id = n.invoice_id and s.unit_kind = n.unit_kind
where s.invoice_id is null or n.invoice_id is null or s.cost is distinct from n.cost;

-- ================================================================ the channel tag (V613)
-- A person tags a unit's channel (who may is Q49 — until answered, Full on Finance). Commercial on an individual's unit
-- (no organisation) names the person credited: a one-share credit split, in the same request; leaving Commercial takes
-- that split back.
create function finance.channel_set(p_invoice uuid, p_channel text, p_person uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  inv finance.invoice;
  ch finance.channel;
  org uuid;
begin
  select * into inv from finance.invoice i where i.id = p_invoice and i.deleted_at is null for update;
  if inv.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if inv.kind not in ('transaction', 'standalone') then
    raise exception using errcode = 'P0001', message = 'finance.channel_on_units_only', detail = inv.kind;
  end if;
  if p_channel is not null then
    select * into ch from finance.channel c where c.key = p_channel and c.deleted_at is null and c.active;
    if ch.id is null then
      raise exception using errcode = 'P0002', message = 'finance.unknown_entry', detail = p_channel;
    end if;
  end if;
  select m.partner_id into org from finance.partner_match(inv.id) m;
  if coalesce(ch.credits_owner, false) and org is null and p_person is null then
    raise exception using errcode = 'P0001', message = 'finance.commercial_names_the_person';
  end if;
  if p_person is not null
     and not exists (select 1 from core.person x where x.id = p_person and x.active and x.kind = 'staff') then
    raise exception using errcode = 'P0001', message = 'person.not_active';
  end if;
  perform audit.begin('ui', 'finance.channel_set', pg_catalog.jsonb_build_object('ref', inv.ref, 'channel', p_channel), p_reason);
  update finance.invoice i set channel_id = ch.id, updated_at = pg_catalog.now(), updated_by = me, version = i.version + 1
  where i.id = inv.id;
  update finance.credit_split s set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'the channel changed'
  where s.invoice_id = inv.id and s.deleted_at is null and s.note = 'channel: commercial';
  if coalesce(ch.credits_owner, false) and org is null then
    insert into finance.credit_split (invoice_id, person_id, share, note, created_by)
    values (inv.id, p_person, 1, 'channel: commercial', me);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', inv.id, 'channel', p_channel);
end
$$;

create function api.finance_channel_set(p_invoice uuid, p_channel text, p_person uuid default null, p_reason text default null)
returns jsonb
language sql security invoker set search_path = ''
as $$ select finance.channel_set(p_invoice, p_channel, p_person, p_reason) $$;

-- ================================================================ grants
revoke all on function finance.month_close_do(date, text) from public;
revoke all on function finance.channel_set(uuid, text, uuid, text) from public;
grant execute on function finance.month_close_do(date, text) to authenticated;
grant execute on function finance.channel_set(uuid, text, uuid, text) to authenticated;
grant execute on function api.finance_month_close(date, text) to authenticated;
grant execute on function api.finance_channel_set(uuid, text, uuid, text) to authenticated;
