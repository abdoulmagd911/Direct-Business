-- LED-01 — the Finance ledger read answers (live failure 4 Nov 2026: Postgres 42702
-- "column reference code_key is ambiguous" on /rest/v1/rpc/finance_ledger, so the Finance
-- page and the company Finance tab could not load at all). A head person asks the ledger
-- for a wide period; the read must answer an object, never raise. Schema and grants checks
-- cannot catch a variable/column name clash — only calling the read can.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select test.eq(jsonb_typeof(api.finance_ledger('2026-01-01'::date, '2026-12-31'::date)), 'object', 'the ledger read answers an object');
select test.eq(jsonb_typeof(api.finance_ledger('2026-01-01'::date, '2026-12-31'::date, null, null, null, 'NOPE'::text, null)), 'object', 'the ledger read answers an object with a code filter too');
