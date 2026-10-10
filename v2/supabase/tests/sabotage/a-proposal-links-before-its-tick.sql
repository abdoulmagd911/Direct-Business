-- Sabotage: a-proposal-links-before-its-tick
-- Breaks: sql:IMP-02
-- Expect: and links nothing until ticked
-- An amount proposal links its transactions before a person ticks it (V616).
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
      or exists (select 1 from finance.billing_link l where l.billing_invoice_id = bi.id and l.deleted_at is null)
      or exists (select 1 from finance.billing_proposal p where p.billing_invoice_id = bi.id and p.deleted_at is null
                 and p.state = 'open');
    select pg_catalog.count(*) into found_sets from (select 1 from finance.amount_sets(bi.id) limit 2) z;
    select s.ids into sets from finance.amount_sets(bi.id) s limit 1;
    if found_sets = 1 then
      insert into finance.billing_proposal (billing_invoice_id, transaction_ids, amount_sar, created_by)
      values (bi.id, sets, bi.total_sar, p_imp);
      insert into finance.billing_link (billing_invoice_id, transaction_invoice_id, source, created_by)
      select bi.id, x, 'proposal', p_imp from pg_catalog.unnest(sets) x;
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
