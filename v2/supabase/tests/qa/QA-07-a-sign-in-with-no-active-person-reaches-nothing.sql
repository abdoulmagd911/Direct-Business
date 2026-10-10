-- QA-07 — A sign-in with no active person behind it reaches nothing (V109, V116): a session whose person was switched
-- off reads no organisation, search, list, hover card, notification or sign-in log, and undoes nothing. On v2/main at
-- 72577fa each of these doors refuses, but deleting its "no active person" check leaves all 79 tests green (the QA
-- auditor's mutation run, docs/v2/QA-LOG.md, 2026-09-29, QA-07) — and without its check api.sign_in_log(null) returns
-- everyone's log to that session. Passes on v2/main; fails when any one of these checks goes.
-- Made-up people only.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.gone', test.person('Test Switched Off', 'member')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.req', api.department_save(null, 'qa_seven', 'Made up department', 'قسم مختلق', null, null,
  'made up') ->> 'request_id', true);
select test.as_owner();
update core.person set can_sign_in = false where id = current_setting('t.gone')::uuid;

select test.as_person(current_setting('t.gone')::uuid);
select test.raises($$select api.org()$$, '42501', 'no organisation', 'auth.no_active_person');
select test.raises($$select api.search('test')$$, '42501', 'no search', 'auth.no_active_person');
select test.raises($$select api.list('segment')$$, '42501', 'no setting list', 'auth.no_active_person');
select test.raises(format('select api.hover_person(%L)', current_setting('t.admin')), '42501', 'no hover card',
  'auth.no_active_person');
select test.raises($$select api.notifications('all')$$, '42501', 'no notifications', 'auth.no_active_person');
select test.raises($$select api.notifications_unread()$$, '42501', 'no unread count', 'auth.no_active_person');
select test.raises($$select api.notifications_mark_read(null)$$, '42501', 'no marking read', 'auth.no_active_person');
select test.raises($$select api.sign_in_log(null)$$, '42501', 'no sign-in log — least of all everyone''s',
  'auth.no_active_person');
select test.raises(format('select api.undo(%L)', current_setting('t.req')), '42501', 'and no Undo of anyone''s request',
  'auth.no_active_person');
