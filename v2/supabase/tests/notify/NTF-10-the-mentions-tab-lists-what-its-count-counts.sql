-- NTF-10 — the Mentions tab lists what its count counts (the 13 Nov sweep): the badge counted a mention in a note
-- (note_mention) with the record mentions, but the Mentions tab listed only the record mentions, so a person
-- mentioned in a note saw "Mentions 1" over an empty tab. Every value is made up.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
insert into notify.notification (person_id, kind, actor_id, label_key, created_at) values
  (current_setting('t.am1')::uuid, 'mentioned', current_setting('t.admin')::uuid, 'note.mentioned', now() - interval '2 hours'),
  (current_setting('t.am1')::uuid, 'note_mention', current_setting('t.admin')::uuid, 'note.mentioned', now() - interval '1 hour'),
  (current_setting('t.am1')::uuid, 'assigned', current_setting('t.admin')::uuid, 'task.assigned', now());

select test.as_person(current_setting('t.am1')::uuid);
select test.eq((api.notifications() ->> 'unread_mentions')::int, 2, 'the Mentions count counts both kinds of mention');
select test.eq(jsonb_array_length(api.notifications('mentions') -> 'rows'), 2, 'and the Mentions tab lists both');
select test.eq((select string_agg(r ->> 'kind', ',' order by r ->> 'kind')
                  from jsonb_array_elements(api.notifications('mentions') -> 'rows') r),
               'mentioned,note_mention', 'the note mention among them');
select test.eq(jsonb_array_length(api.notifications('assigned') -> 'rows'), 1, 'the Assigned tab is unchanged');
