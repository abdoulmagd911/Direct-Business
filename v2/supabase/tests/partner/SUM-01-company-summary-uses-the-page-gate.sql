-- SUM-01 — the company Finance tab and the files archive use the company page's own gate, not the
-- blanket partners page level: a reader who may open the company (a side at view) gets the summary
-- even without partners/view; a reader with no side at view is refused; a missing company is not
-- found. Every company and person is made up.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Zeta", "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.reader', test.person('Test Reader', 'member')::text, true);
select set_config('t.blind', test.person('Test Blind', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.reader')::uuid, 'clients', 'view', 'made up for a test'),
       (current_setting('t.reader')::uuid, 'partners', 'none', 'made up for a test'),
       (current_setting('t.blind')::uuid, 'clients', 'none', 'made up for a test'),
       (current_setting('t.blind')::uuid, 'suppliers_partners', 'none', 'made up for a test'),
       (current_setting('t.blind')::uuid, 'partners', 'none', 'made up for a test');

select test.as_person(current_setting('t.reader')::uuid);
select test.ok((api.company_summary(current_setting('t.p')::uuid) ->> 'partner_id') = current_setting('t.p'),
  'a reader who may open the company gets its summary without partners/view');
select test.ok(api.company_files() = '[]'::jsonb, 'and the files archive answers (empty) for the same reader');
select test.raises(format('select api.company_summary(%L)', '00000000-0000-0000-0000-000000000000'),
  'P0002', 'a missing company is not found', 'common.not_found');

select test.as_person(current_setting('t.blind')::uuid);
select test.raises(format('select api.company_summary(%L)', current_setting('t.p')),
  '42501', 'a reader with no side at view is refused', 'access.needs_level');
