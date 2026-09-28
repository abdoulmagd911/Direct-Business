-- Rollback of d1-money-model.sql: the E views, the old trigger and the old four-argument commit come back; the item-name
-- list and the invoice item lines are dropped with their tables (the list's history stays in record_history); a missing cost
-- becomes 0 again (the old model) so the NOT NULL can return. The new columns are dropped — anything only they held is in the
-- backup taken before the apply (golive-backups bucket).
create or replace view public.finance_lines with (security_invoker = on) as
select i.id, i.invoice_no, i.invoice_date, i.client_group, null::uuid as business_id, i.revenue_sar, i.cost_sar, i.profit_sar,
       i.amount_received_sar, i.amount_remaining_sar, ((i.cost_sar is null) or (i.cost_sar = 0::numeric)) as cost_missing, i.source_batch
from public.finance_invoices i where false;   -- a placeholder for the moment the money views are rebuilt below
drop view if exists public.money_that_counts;
drop view if exists public.money_rows;
create or replace view public.money_rows with (security_invoker = on) as
select i.id, i.invoice_no, i.invoice_date, i.client_group, i.customer_raw_name, i.payments_client_id, i.discount_code,
       i.transaction_ref, i.integrity_status, i.revenue_way,
       i.revenue_sar, i.cost_sar, i.profit_sar, i.amount_received_sar, i.amount_remaining_sar, i.collection_due_date,
       i.source_batch,
       m.business_id, m.company_key, m.company_name, m.merge_state, m.profile_type,
       m.rule_id, m.rule_kind, m.rule_value, m.rule_reason,
       (m.rule_id is not null or i.exclusion_reason is not null) as excluded,
       (m.rule_id is null and i.exclusion_reason is null and i.integrity_status = 'verified_paid') as counts,
       case when m.rule_id is null and i.exclusion_reason is null and coalesce(i.amount_remaining_sar, 0) > 0
            then greatest(0, current_date - coalesce(i.collection_due_date, i.invoice_date)) end as open_age_days
from public.finance_invoices i
join public.money_row_rules() m on m.id = i.id
where i.deleted_at is null;
grant select on public.money_rows to authenticated;
create or replace view public.money_that_counts with (security_invoker = on) as select * from public.money_rows where counts;
grant select on public.money_that_counts to authenticated;
revoke all on public.money_rows, public.money_that_counts from anon;
create or replace view public.finance_lines with (security_invoker = on) as
select m.id, m.invoice_no, m.invoice_date, m.client_group, m.business_id, m.revenue_sar, m.cost_sar, m.profit_sar,
       m.amount_received_sar, m.amount_remaining_sar, ((m.cost_sar is null) or (m.cost_sar = 0::numeric)) as cost_missing, m.source_batch
from public.money_that_counts m;
drop view if exists public.money_line_totals;
drop function if exists public.money_item_key(text);
drop table if exists public.finance_invoice_lines;
drop table if exists public.money_item_classes;
drop function if exists public.money_item_classes_guard();
drop function if exists public.fn_commit_finance_import(jsonb, jsonb, jsonb, jsonb, jsonb);
create or replace function public.fn_commit_finance_import(p_insert jsonb default '[]'::jsonb, p_update jsonb default '[]'::jsonb, p_capture_lines jsonb default '[]'::jsonb, p_capture_gates jsonb default '[]'::jsonb)
 returns jsonb language plpgsql set search_path to 'public', 'pg_temp' as $function$
declare
  v_inserted int := 0; v_updated int := 0; v_capture_lines int := 0; v_capture_gates int := 0; v_touched_refs text[];
begin
  if p_insert is not null and jsonb_typeof(p_insert) = 'array' and jsonb_array_length(p_insert) > 0 then
    insert into public.finance_invoices (
      invoice_no, zatca_dpin, client_group, customer_raw_name, invoice_date, month, quarter,
      products, service_type, record_type, total_incl_vat_sar, wallet_portion_sar, revenue_sar,
      cost_sar, profit_sar, amount_received_sar, amount_remaining_sar, collection_due_date,
      integrity_status, exclusion_reason, notes, source_batch, line_no, branch, salesman,
      project_tag, discount_sar, origin, proposal_ref, items, transaction_ref, direct_uuid,
      vat_sar, revenue_way)
    select
      invoice_no, zatca_dpin, client_group, customer_raw_name, invoice_date, month, quarter,
      products, service_type, coalesce(record_type,'b2b'), coalesce(total_incl_vat_sar,0),
      coalesce(wallet_portion_sar,0), coalesce(revenue_sar,0), coalesce(cost_sar,0),
      coalesce(profit_sar,0), coalesce(amount_received_sar,0), coalesce(amount_remaining_sar,0),
      collection_due_date, coalesce(integrity_status,'pending'), exclusion_reason, notes,
      source_batch, coalesce(line_no,1), branch, salesman, project_tag, discount_sar, origin,
      proposal_ref, items, transaction_ref, direct_uuid, vat_sar, coalesce(revenue_way,'invoice')
    from jsonb_to_recordset(p_insert) as x(
      invoice_no text, zatca_dpin text, client_group text, customer_raw_name text,
      invoice_date date, month text, quarter text, products text, service_type text,
      record_type text, total_incl_vat_sar numeric, wallet_portion_sar numeric,
      revenue_sar numeric, cost_sar numeric, profit_sar numeric, amount_received_sar numeric,
      amount_remaining_sar numeric, collection_due_date date, integrity_status text,
      exclusion_reason text, notes text, source_batch text, line_no int, branch text,
      salesman text, project_tag text, discount_sar numeric, origin text, proposal_ref text,
      items jsonb, transaction_ref text, direct_uuid text, vat_sar numeric, revenue_way text);
    get diagnostics v_inserted = row_count;
  end if;
  if p_update is not null and jsonb_typeof(p_update) = 'array' and jsonb_array_length(p_update) > 0 then
    insert into public.finance_invoices (
      id, invoice_no, zatca_dpin, client_group, customer_raw_name, invoice_date, month, quarter,
      products, service_type, record_type, total_incl_vat_sar, wallet_portion_sar, revenue_sar,
      cost_sar, profit_sar, amount_received_sar, amount_remaining_sar, collection_due_date,
      integrity_status, exclusion_reason, notes, source_batch, line_no, branch, salesman,
      project_tag, discount_sar, origin, proposal_ref, items, transaction_ref, direct_uuid,
      vat_sar, revenue_way)
    select
      id, invoice_no, zatca_dpin, client_group, customer_raw_name, invoice_date, month, quarter,
      products, service_type, coalesce(record_type,'b2b'), coalesce(total_incl_vat_sar,0),
      coalesce(wallet_portion_sar,0), coalesce(revenue_sar,0), coalesce(cost_sar,0),
      coalesce(profit_sar,0), coalesce(amount_received_sar,0), coalesce(amount_remaining_sar,0),
      collection_due_date, coalesce(integrity_status,'pending'), exclusion_reason, notes,
      source_batch, coalesce(line_no,1), branch, salesman, project_tag, discount_sar, origin,
      proposal_ref, items, transaction_ref, direct_uuid, vat_sar, coalesce(revenue_way,'invoice')
    from jsonb_to_recordset(p_update) as x(
      id uuid, invoice_no text, zatca_dpin text, client_group text, customer_raw_name text,
      invoice_date date, month text, quarter text, products text, service_type text,
      record_type text, total_incl_vat_sar numeric, wallet_portion_sar numeric,
      revenue_sar numeric, cost_sar numeric, profit_sar numeric, amount_received_sar numeric,
      amount_remaining_sar numeric, collection_due_date date, integrity_status text,
      exclusion_reason text, notes text, source_batch text, line_no int, branch text,
      salesman text, project_tag text, discount_sar numeric, origin text, proposal_ref text,
      items jsonb, transaction_ref text, direct_uuid text, vat_sar numeric, revenue_way text)
    on conflict (id) do update set
      invoice_no=excluded.invoice_no, zatca_dpin=excluded.zatca_dpin, client_group=excluded.client_group,
      customer_raw_name=excluded.customer_raw_name, invoice_date=excluded.invoice_date,
      month=excluded.month, quarter=excluded.quarter, products=excluded.products,
      service_type=excluded.service_type, record_type=excluded.record_type,
      total_incl_vat_sar=excluded.total_incl_vat_sar, wallet_portion_sar=excluded.wallet_portion_sar,
      revenue_sar=excluded.revenue_sar, cost_sar=excluded.cost_sar, profit_sar=excluded.profit_sar,
      amount_received_sar=excluded.amount_received_sar, amount_remaining_sar=excluded.amount_remaining_sar,
      collection_due_date=excluded.collection_due_date, integrity_status=excluded.integrity_status,
      exclusion_reason=excluded.exclusion_reason, notes=excluded.notes, source_batch=excluded.source_batch,
      line_no=excluded.line_no, branch=excluded.branch, salesman=excluded.salesman,
      project_tag=excluded.project_tag, discount_sar=excluded.discount_sar, origin=excluded.origin,
      proposal_ref=excluded.proposal_ref, items=excluded.items, transaction_ref=excluded.transaction_ref,
      direct_uuid=excluded.direct_uuid, vat_sar=excluded.vat_sar, revenue_way=excluded.revenue_way,
      updated_at=now();
    get diagnostics v_updated = row_count;
  end if;
  if p_capture_lines is not null and jsonb_typeof(p_capture_lines) = 'array' and jsonb_array_length(p_capture_lines) > 0 then
    select array_agg(distinct transaction_ref) into v_touched_refs from jsonb_to_recordset(p_capture_lines) as x(transaction_ref text);
    delete from public.finance_expense_lines_capture where transaction_ref = any(v_touched_refs);
    insert into public.finance_expense_lines_capture (transaction_ref, amount_sar, expense_status, source_batch)
    select transaction_ref, amount_sar, expense_status, source_batch
    from jsonb_to_recordset(p_capture_lines) as x(transaction_ref text, amount_sar numeric, expense_status text, source_batch text);
    get diagnostics v_capture_lines = row_count;
  end if;
  if p_capture_gates is not null and jsonb_typeof(p_capture_gates) = 'array' and jsonb_array_length(p_capture_gates) > 0 then
    insert into public.finance_expense_gate_capture (transaction_ref, txn_expense_status, invoice_issuing_raw, source_batch, captured_at)
    select distinct on (transaction_ref) transaction_ref, txn_expense_status, invoice_issuing_raw, source_batch, now()
    from jsonb_to_recordset(p_capture_gates) as x(transaction_ref text, txn_expense_status text, invoice_issuing_raw text, source_batch text)
    on conflict (transaction_ref) do update set
      txn_expense_status=excluded.txn_expense_status, invoice_issuing_raw=excluded.invoice_issuing_raw,
      source_batch=excluded.source_batch, captured_at=now();
    get diagnostics v_capture_gates = row_count;
  end if;
  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'capture_lines', v_capture_lines, 'capture_gates', v_capture_gates);
end;
$function$;
grant execute on function public.fn_commit_finance_import(jsonb, jsonb, jsonb, jsonb) to authenticated;
create or replace function public.finance_derive_fields() returns trigger language plpgsql set search_path to 'public', 'pg_temp' as $function$
begin
  new.month := to_char(new.invoice_date, 'FMMonth');
  new.quarter := 'Q' || to_char(new.invoice_date, 'Q');
  if abs((new.total_incl_vat_sar - new.wallet_portion_sar) - new.revenue_sar) > 0.01 then
    new.revenue_sar := round(new.total_incl_vat_sar - new.wallet_portion_sar, 2);
  end if;
  if abs((new.revenue_sar - new.cost_sar) - new.profit_sar) > 0.01 then
    new.profit_sar := round(new.revenue_sar - new.cost_sar, 2);
  end if;
  if new.integrity_status in ('excluded','credit_note') then
    new.amount_remaining_sar := 0;
  end if;
  return new;
end $function$;
update public.finance_invoices set cost_sar = coalesce(cost_sar, 0), profit_sar = coalesce(profit_sar, revenue_sar - coalesce(cost_sar, 0))
 where cost_sar is null or profit_sar is null;
alter table public.finance_invoices alter column cost_sar set default 0, alter column cost_sar set not null,
                                    alter column profit_sar set default 0, alter column profit_sar set not null;
alter table public.finance_invoices drop constraint if exists finance_invoices_row_kind_check,
  drop constraint if exists finance_invoices_source_check,
  drop column if exists row_kind, drop column if exists payments_status, drop column if exists payments_status_at,
  drop column if exists paid_at, drop column if exists tax_invoice_date, drop column if exists invoice_created_on, drop column if exists audit_required,
  drop column if exists customer_email, drop column if exists billed_by_ref, drop column if exists source;
