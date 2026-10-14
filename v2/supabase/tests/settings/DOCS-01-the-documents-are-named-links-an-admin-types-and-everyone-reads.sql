-- DOCS-01 — the SOP and SLA library stays in Drive, shown as named links (V435): an admin adds, renames and retires a
-- link in Settings → App; the link must be a secure address (https), a name carries no banned word, and a key is
-- not taken twice; every signed-in person reads the live links, a member cannot change one, and nothing is seeded
-- (rule 7: no address is in the repository). Every address and name below is made up.
-- Sabotages: supabase/tests/sabotage/a-document-link-takes-any-address.sql.
select test.eq((select count(*)::int from core.doc_link), 0, 'no link is seeded');

select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.member', test.person('Test Member', 'member')::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.id', (api.list_save('doc_link', null, '{"key": "sop.test_escalation", "name_en": "Test escalation matrix",
  "name_ar": "جدول التصعيد التجريبي", "link": "https://files.example.com/test-escalation", "kind": "sop"}') ->> 'id'), true);
select test.ok(current_setting('t.id') is not null, 'an admin adds a link');
select test.raises($$select api.list_save('doc_link', null, '{"key": "sop.test_plain", "name_en": "Test plain",
  "name_ar": "تجريبي", "link": "http://files.example.com/plain", "kind": "sop"}')$$, 'P0001', 'a plain-http address is refused',
  'list.invalid');
select test.raises($$select api.list_save('doc_link', null, '{"key": "sop.test_word", "name_en": "Test plain",
  "name_ar": "تجريبي", "link": "javascript:alert(1)", "kind": "sop"}')$$, 'P0001', 'so is any other kind of address',
  'list.invalid');
select test.raises($$select api.list_save('doc_link', null, '{"key": "sop.test_kind", "name_en": "Test kind",
  "name_ar": "تجريبي", "link": "https://files.example.com/k", "kind": "memo"}')$$, 'P0001', 'a kind outside sop, sla and other is refused',
  'list.invalid');
select test.raises($$select api.list_save('doc_link', null, '{"key": "sop.test_b2c", "name_en": "Test b2c desk",
  "name_ar": "تجريبي", "link": "https://files.example.com/b2c", "kind": "other"}')$$, 'P0001', 'a banned word in a name is refused',
  'list.banned_word');
select test.raises($$select api.list_save('doc_link', null, '{"key": "sop.test_escalation", "name_en": "Test again",
  "name_ar": "تجريبي", "link": "https://files.example.com/again", "kind": "sop"}')$$, '23505', 'a key is taken once', 'list.key_taken');

select test.as_person(current_setting('t.member')::uuid);
select test.eq(jsonb_array_length(api.list('doc_link')), 1, 'a member reads the live links');
select test.eq(api.list('doc_link') -> 0 ->> 'link', 'https://files.example.com/test-escalation', 'with their addresses');
select test.raises($$select api.list_save('doc_link', null, '{"key": "sop.test_member", "name_en": "Test member",
  "name_ar": "تجريبي", "link": "https://files.example.com/m", "kind": "sop"}')$$, '42501', 'a member cannot add one',
  'access.needs_level');
