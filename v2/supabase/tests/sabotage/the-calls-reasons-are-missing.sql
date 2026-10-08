-- Sabotage: the-calls-reasons-are-missing
-- Breaks: sql:PST-02
-- Expect: the three reasons for At risk and for Lost
-- The side-status reasons from the calls are not offered (V476).
update partner.side_status_reason set active = false
where key in ('product_gap', 'payment_method_not_supported', 'price_vs_competitor');
