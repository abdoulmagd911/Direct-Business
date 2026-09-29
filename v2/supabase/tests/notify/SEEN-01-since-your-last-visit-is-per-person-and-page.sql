-- SEEN-01 — "Since your last visit" (§6, V61): opening a page records the time and answers when that person last opened
-- it — nothing the first time — so the page counts what is newer; each person and page apart; a page the person cannot
-- open is refused.
-- Sabotage: supabase/tests/sabotage/the-last-visit-is-always-now.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Manager', 'member')::text, true);

select set_config('t.first', (now() + interval '1 hour')::text, true);
select set_config('v2.test_now', current_setting('t.first'), true);
select test.as_person(current_setting('t.am1')::uuid);
select test.eq(api.page_seen('my_day'), null::timestamptz, 'the first visit has no last visit');
select set_config('v2.test_now', (now() + interval '1 day')::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select test.eq(api.page_seen('my_day'), current_setting('t.first')::timestamptz,
  'the next visit answers when the page was last seen');
select test.eq(api.page_seen('tasks'), null::timestamptz, 'each page apart');
select test.as_person(current_setting('t.am2')::uuid);
select test.eq(api.page_seen('my_day'), null::timestamptz, 'each person apart');
select test.raises('select api.page_seen(''activity'')', '42501', 'a page the person cannot open is refused',
  'access.needs_level');
