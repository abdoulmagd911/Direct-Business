-- SPD-02 — who is asking is answered once, and from a kept plan (Landing 35; owner's live sweep, 21 Nov 2026:
-- even the smallest read took seconds on live).
-- Every read asks who is calling and what they may do (authz.me, authz.level, authz.can, authz.is_admin, behind
-- authz.require). These were SQL-language functions with a pinned search_path (SEC-01), which Postgres can
-- neither fold into the caller nor keep a plan for: it planned authz.me — four nested bodies — again on every
-- call (2.3 ms), and authz.is_admin compared EVERY person row with authz.me(), asking "who am I" once per
-- person (26 ms with a dozen people, more with every person added). Two guards:
--   1. the identity functions are plpgsql, which keeps a statement's plan for the connection;
--   2. a clock: with 300 made-up people on the list, a hundred rounds of the four questions take well under a
--      second (asking "who am I" once per person they take seconds; asked once they take a few hundredths).
-- The answers are the ones ACC-01 … ACC-10 pin; this file only adds that a switched-off person, a signed-out
-- device and an admin are still told apart by the kept-plan versions. Every value is made up.
-- Sabotages: supabase/tests/sabotage/who-am-i-is-planned-on-every-call.sql,
-- is-admin-asks-who-am-i-once-per-person.sql.
select test.eq(
  (select coalesce(pg_catalog.string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text), '')
   from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid = p.prolang
   where p.oid in ('authz.me()'::regprocedure, 'authz.real_me()'::regprocedure, 'authz.switch_target(uuid)'::regprocedure,
                   'authz.switched_by()'::regprocedure, 'authz.is_admin()'::regprocedure,
                   'authz.level(text)'::regprocedure, 'authz.level_of(uuid,text)'::regprocedure,
                   'authz.can(text)'::regprocedure, 'authz.can_of(uuid,text)'::regprocedure,
                   'authz.in_my_departments(uuid)'::regprocedure, 'authz.reports_to(uuid)'::regprocedure,
                   'authz.reports_to(uuid,uuid)'::regprocedure, 'authz.can_see(text,uuid)'::regprocedure,
                   'authz.can_upload_file(text,text)'::regprocedure, 'authz.require(text,core.level)'::regprocedure,
                   'core.live_device()'::regprocedure, 'core.clock()'::regprocedure, 'core.riyadh_today()'::regprocedure,
                   'core.jwt_session_id()'::regprocedure, 'core.device_idle_days()'::regprocedure)
     and l.lanname <> 'plpgsql'),
  '', 'who is asking is answered from a kept plan: every identity function is plpgsql');

-- 300 made-up people on the list, one of them asking
select set_config('t.member', test.person('Test Member', 'member')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select test.person('Made Up Colleague ' || g, 'member') from generate_series(1, 298) g;

select test.as_person(current_setting('t.member')::uuid);
select test.eq(authz.me(), current_setting('t.member')::uuid, 'a signed-in person is themselves');
select test.eq(authz.is_admin(), false, 'a member is not an admin');
select test.eq(authz.level('tasks') >= 'view', true, 'a member reads Tasks');
select test.eq(authz.level('settings.org'), 'none'::core.level, 'and no Settings page');
select test.eq(authz.switched_by() is null, true, 'nobody switched into them');
create temp table spd_who (ms numeric) on commit drop;
do $$
declare
  t0 timestamptz := pg_catalog.clock_timestamp();
  i int;
begin
  for i in 1..100 loop
    perform authz.me(), authz.is_admin(), authz.level('finance'), authz.can('tasks.assign');
  end loop;
  insert into spd_who values (extract(epoch from pg_catalog.clock_timestamp() - t0) * 1000);
end $$;
select test.ok((select ms < 700 from spd_who),
  format('a hundred rounds of "who is asking, and may they" take under 0.7 s with 300 people on the list — took %s ms',
         (select pg_catalog.round(ms) from spd_who)));

select test.as_person(current_setting('t.admin')::uuid);
select test.eq(authz.is_admin(), true, 'an admin is an admin');
select test.eq(authz.level('settings.org') >= 'view', true, 'and reads the Settings pages');

-- a person switched off mid-session is nobody at once: the kept plan reads the row as it is now
select test.as_owner();
update core.person set active = false where id = current_setting('t.member')::uuid;
select test.as_person(current_setting('t.member')::uuid);
select test.eq(authz.me() is null, true, 'a switched-off person is nobody');
select test.eq(authz.is_admin(), false, 'and no admin');
select test.eq(authz.level('tasks'), 'none'::core.level, 'with no level on any page');
select test.raises($$select api.tasks()$$, '42501', 'and every read refuses them', 'auth.no_active_person');
