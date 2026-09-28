-- Rollback of cost-fallback.sql: the estimate is the pass-through lines only again (D23 as shipped). The last column
-- stays (a view cannot lose a column in place) and names only 'pass_through'.
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
       case when i.cost_sar is null and i.revenue_way is distinct from 'commission' and coalesce(lt.pass_through_sar, 0) > 0
            then lt.pass_through_sar end as est_cost_sar,
       (i.cost_sar is null and i.revenue_way is distinct from 'commission' and coalesce(lt.pass_through_sar, 0) > 0) as cost_estimated,
       i.transaction_date,
       case when i.cost_sar is null and i.revenue_way is distinct from 'commission' and coalesce(lt.pass_through_sar, 0) > 0
            then 'pass_through' end as est_cost_source
from public.finance_invoices i
join public.money_row_rules() m on m.id = i.id
left join public.money_line_totals lt on lt.invoice_no = i.invoice_no
where i.deleted_at is null;

create or replace view public.money_that_counts with (security_invoker = on) as
select * from public.money_rows where counts;

create or replace view public.finance_lines with (security_invoker = on) as
select m.id, m.invoice_no, m.invoice_date, m.client_group, m.business_id, m.revenue_sar, m.cost_sar, m.profit_sar,
       m.amount_received_sar, m.amount_remaining_sar,
       m.cost_missing, m.source_batch, m.est_cost_sar, m.cost_estimated, m.est_cost_source
from public.money_that_counts m;
