-- §3.5 "Sources" (P4-3): every import source that carries partner clues shows them as a keys view (source_table,
-- source_id, kind, key, match_date); in v1 that is finance.invoice_keys — the client ID, the tax number (compared with
-- both VAT and CR), the discount code with the row's booking day, the email, the phone and both customer names. The
-- client ID a Payments client's contact email would give comes with that client list (P7-4). Forward-only.

-- the index on the invoice's key columns had the name the spec gives the view
alter index finance.invoice_keys rename to invoice_match_keys;

create view finance.invoice_keys with (security_invoker = true) as
select 'finance.invoice'::text as source_table, i.id as source_id, k.kind, k.key, i.created_on as match_date
from finance.invoice i
cross join lateral (values ('client_id', i.client_id_key), ('tax_no', i.tax_key), ('code', i.code_key),
                           ('email', i.email_key), ('phone', i.phone_key), ('name', i.name_key), ('name', i.name2_key))
  k(kind, key)
where i.deleted_at is null and k.key is not null;
comment on view finance.invoice_keys is '§3.5: each invoice''s match clues, one row per clue, with the day the match judges them on.';
