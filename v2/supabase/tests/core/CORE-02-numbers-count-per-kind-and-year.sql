-- CORE-02 — people-facing numbers count 1, 2, 3 … per kind and per year, never repeat, and read like TSK-2026-0042;
-- a signed-in person cannot draw one directly (only api.* write functions do).
-- Sabotage: supabase/tests/sabotage/numbers-never-advance.sql.
select test.eq(core.next_number('task', 2026), 1, 'the first task number of 2026');
select test.eq(core.next_number('task', 2026), 2, 'the second task number of 2026');
select test.eq(core.next_number('task', 2027), 1, 'a new year starts again at 1');
select test.eq(core.next_number('project', 2026), 1, 'each kind counts on its own');
select test.eq(core.next_number('task', 2026), 3, 'the 2026 task count went on after the others');
select test.eq(core.format_number('TSK', 2026, 42), 'TSK-2026-0042', 'four digits by default');
select test.eq(core.format_number('PRJ', 2026, 7, 3), 'PRJ-2026-007', 'three digits when asked');
select test.raises($$select core.next_number('Task!', 2026)$$, '23514', 'a kind is a lower-case code');
select test.as_auth(gen_random_uuid());
select test.raises($$select core.next_number('task', 2026)$$, '42501', 'a signed-in person cannot draw a number');
