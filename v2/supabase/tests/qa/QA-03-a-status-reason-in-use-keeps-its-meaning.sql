-- QA-03 — A status reason in use keeps its meaning (V62; owner decision 29 Sep 2026: stage meanings are locked): once a
-- status change cites a reason, the status the reason belongs to (at risk / lost) never changes, so history never says
-- "at risk because of a lost reason". Written by the QA auditor to fail until it is built: on v2/main at 72577fa
-- api.list_save moves a used reason from at_risk to lost, and partner.status_guard only checks at the change's insert.
-- Finding: docs/v2/QA-LOG.md, 2026-09-29, QA-03. Made-up values only.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.reason', (select id::text from partner.status_reason where key = 'price'), true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Trading QA3',
  'account_manager_id', current_setting('t.admin')), 'made up') ->> 'id', true);
select api.partner_status_set(current_setting('t.p')::uuid, 'at_risk', null, current_setting('t.reason')::uuid, 'made up');

select test.raises(format('select api.list_save(%L, %L, %L, 1, %L)', 'status_reason', current_setting('t.reason'),
  '{"status": "lost"}', 'made up'), 'P0001', 'a reason already cited keeps its status');
select test.as_owner();
select test.eq((select r.status from partner.status_change s join partner.status_reason r on r.id = s.reason_id
                where s.partner_id = current_setting('t.p')::uuid), 'at_risk', 'the at-risk change still cites an at-risk reason');
