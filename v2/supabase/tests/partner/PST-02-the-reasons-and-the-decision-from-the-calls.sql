-- PST-02 — what the calls added to the lists (V476, V478): a side at risk or lost may give product gap, payment method
-- not supported or price vs competitor as its reason — each status its own entries; a decision taken with the
-- organisation is logged as an activity of type Decision. Admins edit both lists. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-calls-reasons-are-missing.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select test.eq((select jsonb_object_agg(status, keys) from (
    select status, jsonb_agg(key order by sort) as keys from partner.side_status_reason
    where key in ('product_gap', 'payment_method_not_supported', 'price_vs_competitor', 'lost_product_gap',
                  'lost_payment_method_not_supported', 'lost_price_vs_competitor') and active
    group by status) s),
  '{"at_risk": ["product_gap", "payment_method_not_supported", "price_vs_competitor"],
    "lost": ["lost_product_gap", "lost_payment_method_not_supported", "lost_price_vs_competitor"]}'::jsonb,
  'the three reasons for At risk and for Lost');
select set_config('t.gap', (select id::text from partner.side_status_reason where key = 'product_gap'), true);
select set_config('t.lost', (select id::text from partner.side_status_reason where key = 'lost_price_vs_competitor'), true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Reasons Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select test.as_person(current_setting('t.am1')::uuid);
select test.runs(format('select api.partner_status_set(%L, %L, %L, null, %L)', current_setting('t.p'), 'client',
  'at_risk', current_setting('t.gap')), 'a client at risk for a product gap');
select test.raises(format('select api.partner_status_set(%L, %L, %L, null, %L)', current_setting('t.p'), 'client',
  'lost', current_setting('t.gap')), 'P0001', 'an At risk reason is not a Lost one', 'partner.reason_not_for_status');
select test.runs(format('select api.partner_status_set(%L, %L, %L, null, %L)', current_setting('t.p'), 'client',
  'lost', current_setting('t.lost')), 'lost on price against a competitor');
select test.runs(format('select api.activity_log(%L, %L, null, null, %L)', current_setting('t.p'), 'decision',
  'Made-up: they chose the postpaid model'), 'a decision is logged as an activity of its own type');
select test.as_owner();
select test.eq((select t.key from core.note n join partner.activity_type t on t.id = n.activity_type_id
                where n.entity_table = 'partner.partner' and n.entity_id = current_setting('t.p')::uuid
                  and n.deleted_at is null), 'decision', 'of type Decision');
