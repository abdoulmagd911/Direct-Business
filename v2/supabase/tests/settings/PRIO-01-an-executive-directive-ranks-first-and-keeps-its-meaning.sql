-- PRIO-01 — the priority list ranks 'Executive directive' first (WRK-041), with a locked meaning: its names are
-- renamed like any value, but its meaning never changes and it is never removed or retired. Made up.
-- Sabotage: supabase/tests/sabotage/no-executive-directive.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select x ->> 'key' from jsonb_array_elements(api.list('priority')) x
                where coalesce((x ->> 'active')::boolean, true) order by (x ->> 'sort')::int limit 1),
  'executive_directive', 'Executive directive ranks first');
select set_config('t.ed', (select x ->> 'id' from jsonb_array_elements(api.list('priority')) x
                           where x ->> 'key' = 'executive_directive'), true);
select set_config('t.high', (select x ->> 'id' from jsonb_array_elements(api.list('priority')) x where x ->> 'key' = 'high'),
  true);
select test.raises(format('select api.list_save(%L, %L, %L)', 'priority', current_setting('t.ed'), '{"meaning": null}'),
  'P0001', 'its meaning never changes', 'list.meaning_locked');
select test.raises(format('select api.list_remove(%L, %L)', 'priority', current_setting('t.ed')), 'P0001',
  'it is never removed', 'list.meaning_locked');
select test.raises(format('select api.list_retire(%L, %L, %L, %L)', 'priority', current_setting('t.ed'),
  current_setting('t.high'), 'made up'), 'P0001', 'nor retired', 'list.meaning_locked');
