-- Sabotage: a-receipts-amount-is-in-its-key
-- Breaks: sql:IMP-10
-- Expect: a corrected amount changes the receipt, never adds a second
-- A receipt's key carries its amount, so a corrected amount adds a second receipt (QA-539).
create or replace function finance.receipt_key(p_row jsonb) returns text
language plpgsql stable set search_path = ''
as $$
begin
  return pg_catalog.concat_ws('|', finance.row_text(p_row, 'ref'),
           coalesce(norm.fold(finance.row_text(p_row, 'ref_at_method')),
                    pg_catalog.concat_ws('|', norm.fold(coalesce(finance.row_text(p_row, 'method'), '—')),
                                         pg_catalog.to_char(finance.row_date(p_row, 'paid_on'), 'YYYY-MM-DD'), finance.row_text(p_row, 'amount_sar'))));
end
$$;
