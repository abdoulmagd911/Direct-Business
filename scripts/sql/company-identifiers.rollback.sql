-- Rollback of company-identifiers.sql: matching goes back to the money rules of E (its money_row_rules, restored below word
-- for word from e-money-rules.sql); money_rows keeps its appended columns (a view cannot drop columns in place) but they no
-- longer read the matcher; the feeds and the matcher go. The identifiers table and finance_invoices.customer_phone stay
-- (they hold what people typed — dropping them is a wipe: D9).
drop trigger if exists business_merges_carry_zidentifiers on public.business_merges;
drop function if exists public.business_merges_carry_identifiers();
drop trigger if exists name_aliases_feed_identifiers on public.company_name_aliases;
drop function if exists public.name_aliases_feed_identifiers();
drop trigger if exists discount_links_feed_identifiers on public.company_discount_codes;
drop function if exists public.discount_links_feed_identifiers();
drop trigger if exists client_profiles_feed_identifiers on public.client_profiles;
drop function if exists public.client_profiles_feed_identifiers();
drop function if exists public.company_identifier_feed(uuid, text, text, text, date, date);
drop function if exists public.company_identifier_ensure(uuid, text, text, text, date, date);
drop function if exists public.company_identifier_drop(uuid, text, text);
drop function if exists public.fn_identifiers_from_payments_clients(text[], jsonb);
drop function if exists public.payments_client_match(text);
drop function if exists public.payments_client_crs(text, text, text);

create or replace function public.money_row_rules()
returns table (id uuid, business_id uuid, company_key text, company_name text, merge_state text, profile_type text,
               rule_id uuid, rule_kind text, rule_value text, rule_reason text)
language plpgsql stable security definer set search_path to public as $$
begin
  if not public.can_see_page('finance') then return; end if;
  return query
  with r as (select * from money_exclusion_rules x where x.active and x.removed_at is null),
  base as (
    select i.id, i.invoice_no, i.transaction_ref, i.client_group, i.customer_raw_name,
           money_norm(i.payments_client_id) cid, money_norm(i.customer_tax_no) tax, money_norm(i.discount_code) code,
           cp.business_id cid_biz, cp.profile_type ptype, dc.business_id code_biz, na.business_id name_biz
    from finance_invoices i
    left join client_profiles cp on money_norm(cp.direct_client_id) = money_norm(i.payments_client_id)
    left join lateral (select c.business_id from company_discount_codes c join promo_codes p on p.id = c.promo_code_id
                       where c.removed_at is null and money_norm(p.code) = money_norm(i.discount_code) limit 1) dc on true
    left join lateral (select a.business_id from company_name_aliases a where a.removed_at is null
                       and a.name_norm in (money_norm(i.client_group), money_norm(i.customer_raw_name)) limit 1) na on true
    where i.deleted_at is null),
  res as (
    select b.*, coalesce(b.cid_biz, case when b.cid is null then coalesce(b.code_biz, b.name_biz) end) biz from base b)   -- a row with its own client ID goes by that ID alone
  select s.id, s.biz,
         case when s.biz is not null then 'biz:' || s.biz::text
              when s.cid is not null then 'cid:' || s.cid
              when s.code is not null then 'codes:unassigned'
              else 'name:' || coalesce(money_norm(coalesce(s.client_group, s.customer_raw_name)), '?') end,
         case when s.biz is not null then bz.name
              when s.cid is not null then coalesce(s.customer_raw_name, s.client_group)
              when s.code is not null then 'Unassigned codes'
              else coalesce(s.client_group, s.customer_raw_name) end,
         case when s.biz is not null then 'merged' when s.cid is not null then 'not_merged'
              when s.code is not null then 'unassigned_code' else 'no_client_id' end,
         case when s.cid_biz is not null then s.ptype end,
         x.id, x.kind, x.value, x.reason
  from res s
  left join businesses bz on bz.id = s.biz
  left join lateral (
    select r.id, r.kind, r.value, r.reason from r
    where (r.kind = 'transaction' and r.value_norm in (money_norm(s.transaction_ref), money_norm(s.invoice_no)))
       or (r.kind = 'client_id' and r.value_norm = s.cid)
       or (r.kind = 'tax_no' and (r.value_norm = s.tax
                                   or (length(r.value_norm) >= 8 and strpos(coalesce(money_norm(bz.cr_vat), ''), r.value_norm) > 0)))
       or (r.kind = 'discount_code' and r.value_norm = s.code)
       or (r.kind = 'name' and s.cid is null and r.value_norm in (money_norm(s.client_group), money_norm(s.customer_raw_name)))
    order by array_position(array['transaction', 'client_id', 'tax_no', 'discount_code', 'name'], r.kind), r.created_at
    limit 1) x on true;
end $$;
revoke all on function public.money_row_rules() from public, anon;
grant execute on function public.money_row_rules() to authenticated;

create or replace view public.money_rows with (security_invoker = on) as
select i.id, i.invoice_no, i.invoice_date, i.client_group, i.customer_raw_name, i.payments_client_id, i.discount_code,
       i.transaction_ref, i.integrity_status, i.revenue_way,
       i.revenue_sar, i.cost_sar, i.profit_sar, i.amount_received_sar, i.amount_remaining_sar, i.collection_due_date,
       i.source_batch,
       m.business_id, m.company_key, m.company_name, m.merge_state, m.profile_type,
       m.rule_id, m.rule_kind, m.rule_value, m.rule_reason,
       (m.rule_id is not null or i.exclusion_reason is not null) as excluded,
       (m.rule_id is null and i.exclusion_reason is null and i.integrity_status = 'verified_paid' and i.row_kind = 'sale') as counts,
       case when m.rule_id is null and i.exclusion_reason is null and coalesce(i.amount_remaining_sar, 0) > 0
            then greatest(0, current_date - coalesce(i.collection_due_date, i.invoice_date)) end as open_age_days,
       i.row_kind, i.payments_status, i.paid_at, i.tax_invoice_date, i.invoice_created_on, i.audit_required, i.source, i.billed_by_ref,
       (i.cost_sar is null and i.revenue_way is distinct from 'commission') as cost_missing,
       (i.cost_sar is not null and i.cost_sar > i.revenue_sar) as loss,
       lt.pass_through_sar, lt.fee_sar, lt.unclassed_sar,
       case when i.cost_sar is null and i.revenue_way is distinct from 'commission'
            then coalesce(case when pf.rr_total_expense_sar > 0 then pf.rr_total_expense_sar end,
                          case when coalesce(lt.pass_through_sar, 0) > 0 then lt.pass_through_sar end) end as est_cost_sar,
       (i.cost_sar is null and i.revenue_way is distinct from 'commission'
        and (coalesce(pf.rr_total_expense_sar, 0) > 0 or coalesce(lt.pass_through_sar, 0) > 0)) as cost_estimated,
       i.transaction_date,                                  -- the main builder's D26 column, kept in its place
       case when i.cost_sar is null and i.revenue_way is distinct from 'commission' then
            case when coalesce(pf.rr_total_expense_sar, 0) > 0 then 'submitted_expenses'
                 when coalesce(lt.pass_through_sar, 0) > 0 then 'pass_through' end end as est_cost_source,
       null::text as match_level, null::text as match_state, null::uuid[] as match_candidates, i.customer_email, i.customer_tax_no,
       i.customer_phone, i.payments_client_id as row_client_id
from public.finance_invoices i
join public.money_row_rules() m on m.id = i.id
left join public.money_line_totals lt on lt.invoice_no = i.invoice_no
left join public.finance_payments_facts pf on pf.ref = i.invoice_no
where i.deleted_at is null;


drop function if exists public.money_company_match();
