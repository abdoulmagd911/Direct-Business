-- HIST-03 — the whole log's changes carry their before and after (FIX-18, F202): an /activity Changes row shows
-- what changed, not a bare field name — so api.activity's change objects carry before and after, like
-- record_history already does. Every value is made up.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.dep', test.department('hist_three')::text, true);

select set_config('t.r', test.act(current_setting('t.admin')::uuid)::text, true);
update core.department set name_en = 'History Before After' where id = current_setting('t.dep')::uuid;
select test.done();

select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select r -> 'changes' -> 0 -> 'before' ->> 'name_en'
  from jsonb_array_elements(api.activity()) r where r ->> 'request_id' = current_setting('t.r')),
  'Hist Three', 'the change carries what stood before');
select test.eq((select r -> 'changes' -> 0 -> 'after' ->> 'name_en'
  from jsonb_array_elements(api.activity()) r where r ->> 'request_id' = current_setting('t.r')),
  'History Before After', 'and what it became');
