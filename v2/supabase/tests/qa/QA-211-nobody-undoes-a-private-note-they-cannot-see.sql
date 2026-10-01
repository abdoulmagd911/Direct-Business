-- QA-211 — Nobody undoes a private note they cannot see, admins included (V454, V183 on #139: a rule-only record type is
-- seen by its own rule alone, and "History, the Activity page, Follow, notifications and a manager's Undo all follow
-- it"). On #139 at 5921734 an admin cannot open a member's private note (api.note → common.not_found), yet api.undo of
-- the member's capture runs and removes the note. Undo is a write door, so it must ask the record's own rule for every
-- row it touches, as the admin shortcut does. Written by the QA auditor to fail until built (it needs P3-13's notes).
-- Made-up people only.
select test.ok(to_regprocedure('api.note_capture(text,jsonb,uuid[])') is not null, 'My day notes exist (P3-13)');

select set_config('t.author', test.person('Test Author', 'member')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);

select test.as_person(current_setting('t.author')::uuid);
select set_config('t.cap', api.note_capture('sticky', '{"title": "Made-up private thought"}'::jsonb)::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.note(%L)', current_setting('t.cap')::jsonb ->> 'id'), 'P0002',
  'the admin cannot open the member''s private note');
do $$
begin
  perform api.undo((current_setting('t.cap')::jsonb ->> 'request_id')::uuid);
exception when others then
  null; -- refused, whatever the words: the check below is what matters
end
$$;
select test.as_owner();
select test.ok(exists (select 1 from my.note where id = (current_setting('t.cap')::jsonb ->> 'id')::uuid
                                              and deleted_at is null),
  'the admin''s Undo leaves the private note alone');
