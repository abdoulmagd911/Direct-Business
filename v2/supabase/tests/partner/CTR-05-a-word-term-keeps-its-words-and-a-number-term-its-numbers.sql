-- CTR-05 — the contract terms the calls added (V480): payment model, minimum monthly commitment, cancellation /
-- force-majeure refund term, minimum volume, commission %, target, IATA RHC limit, bank guarantee and risk status, each
-- typed — never Finance money. A word term keeps its words, a number term its numbers before → after; words on a number
-- term and numbers on a word term are refused, whatever writes them. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-word-term-takes-numbers.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.sup', test.person('Test Supplier Desk', 'manager')::text, true);

select test.eq((select jsonb_object_agg(key, unit) from partner.term
                where key in ('payment_model', 'minimum_monthly_commitment', 'cancellation_refund_term', 'minimum_volume',
                              'commission', 'target', 'iata_rhc_limit', 'bank_guarantee', 'risk_status') and active),
  '{"payment_model": "text", "minimum_monthly_commitment": "sar", "cancellation_refund_term": "text",
    "minimum_volume": "count", "commission": "percent", "target": "text", "iata_rhc_limit": "sar",
    "bank_guarantee": "sar", "risk_status": "text"}'::jsonb, 'the nine terms from the calls, each with its unit');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Terms Air',
  'sides', jsonb_build_array(jsonb_build_object('side', 'supplier_partner', 'type', 'airline',
                                                'owner_id', current_setting('t.sup'))))) ->> 'id', true);
select test.as_person(current_setting('t.sup')::uuid);
select set_config('t.c', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'supplier_partner',
  'title', 'Made-up supply agreement', 'start_on', core.riyadh_today(),
  'terms', jsonb_build_array(jsonb_build_object('term', 'payment_model', 'value', ' Postpaid '),
                             jsonb_build_object('term', 'commission', 'before', 5, 'after', 7),
                             jsonb_build_object('term', 'risk_status', 'value', 'Low')))) ->> 'id', true);
select test.eq((select jsonb_object_agg(t ->> 'term', jsonb_build_object('before', t -> 'before', 'after', t -> 'after',
                                                                         'value', t -> 'value'))
                from jsonb_array_elements(api.contracts(current_setting('t.p')::uuid) -> 0 -> 'terms') t),
  '{"payment_model": {"before": null, "after": null, "value": "Postpaid"},
    "commission": {"before": 5, "after": 7, "value": null},
    "risk_status": {"before": null, "after": null, "value": "Low"}}'::jsonb,
  'a word term keeps its words, a number term its numbers before and after');

select test.raises(format('select api.contract_save(%L, %L, %L, 1)', current_setting('t.p'), current_setting('t.c'),
  jsonb_build_object('terms', jsonb_build_array(jsonb_build_object('term', 'commission', 'value', 'high'))))::text,
  'P0001', 'words on a number term are refused', 'contract.term_takes_numbers');
select test.raises(format('select api.contract_save(%L, %L, %L, 1)', current_setting('t.p'), current_setting('t.c'),
  jsonb_build_object('terms', jsonb_build_array(jsonb_build_object('term', 'payment_model', 'after', 2))))::text,
  'P0001', 'and numbers on a word term', 'contract.term_takes_words');
select api.contract_save(current_setting('t.p')::uuid, current_setting('t.c')::uuid, jsonb_build_object('terms',
  jsonb_build_array(jsonb_build_object('term', 'payment_model', 'value', 'Prepaid'),
                    jsonb_build_object('term', 'commission', 'before', 5, 'after', 6))), 1);
select test.eq((select jsonb_object_agg(t ->> 'term', coalesce(nullif(t -> 'value', 'null'::jsonb), t -> 'after'))
                from jsonb_array_elements(api.contracts(current_setting('t.p')::uuid) -> 0 -> 'terms') t),
  '{"payment_model": "Prepaid", "commission": 6}'::jsonb, 'changed in place; a term left out is removed');

select test.as_owner();
select test.raises(format('update partner.contract_term set value_text = %L where term_id = (select id from partner.term
  where key = %L) and deleted_at is null', 'many', 'commission'), 'P0001', 'whatever writes it',
  'contract.term_takes_numbers');
