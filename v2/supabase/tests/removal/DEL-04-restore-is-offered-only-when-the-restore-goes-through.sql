-- DEL-04 — QA-585: Recently deleted offers Restore only when the restore itself would go through, and otherwise says
-- why, in the restore's own words. A side's owner replaced the same day is a removed Side owner: its member, who owned
-- it, may not restore it without the Client side's Assign; a head who holds Assign may not either, because the new
-- owner holds the same days; nor a phone number another organisation now holds. Then, for each of them and an admin,
-- every row the list shows is restored for real (and undone): it goes through exactly when the list offered Restore, and
-- is refused with exactly the reason the list gave.
-- Every value is made up.
-- Sabotage: supabase/tests/sabotage/restore-offered-without-the-records-own-checks.sql.
select set_config('v2.test_now', '2026-10-12 09:00:00+03', true);
select set_config('t.head', test.person('Test Restore Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Replaced Owner', 'member')::text, true);
select set_config('t.am2', test.person('Test Same Day Owner', 'member')::text, true);
select set_config('t.admin', test.person('Test Restore Admin', 'admin')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);

-- the owner set and corrected the same day: the first owner's row is removed ('replaced')
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Restore Check',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select api.partner_owner_set(current_setting('t.p')::uuid, 'client', current_setting('t.am2')::uuid);
select test.as_owner();
select set_config('t.so', (select id::text from partner.side_owner where partner_id = current_setting('t.p')::uuid
                           and person_id = current_setting('t.am1')::uuid and deleted_at is not null), true);
select test.ok(current_setting('t.so') <> '', 'the replaced owner''s row is removed');

-- the member who owned it: no Restore, because restoring an owner needs the side's Assign
select test.as_person(current_setting('t.am1')::uuid);
select test.eq((select jsonb_build_object('can', x -> 'can_restore', 'why', x -> 'restore_blocked')
                from jsonb_array_elements(api.recently_deleted()) x where x ->> 'id' = current_setting('t.so')),
  jsonb_build_object('can', false, 'why', 'access.needs_capability'),
  'the member sees the removed owner without Restore, and why');
select test.raises(format('select api.restore(%L, %L)', 'side_owner', current_setting('t.so')), '42501',
  'as the door refuses it', 'access.needs_capability');

-- the head, who holds Assign: no Restore either, because the new owner holds the same days
select test.as_person(current_setting('t.head')::uuid);
select test.eq((select jsonb_build_object('can', x -> 'can_restore', 'why', x -> 'restore_blocked')
                from jsonb_array_elements(api.recently_deleted()) x where x ->> 'id' = current_setting('t.so')),
  jsonb_build_object('can', false, 'why', 'restore.blocked_by_duplicate'),
  'the head sees it without Restore: the side already has an owner for those days');
select test.raises(format('select api.restore(%L, %L)', 'side_owner', current_setting('t.so')), '23505',
  'as the door refuses it', 'restore.blocked_by_duplicate');

-- a phone number another organisation now holds: no Restore, by a plain uniqueness rule this time
select set_config('t.p2', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Restore Check Two',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.ph', api.identifier_add(current_setting('t.p')::uuid, 'phone', '0500000077', 'made up: from a form')
  ->> 'id', true);
select api.identifier_remove(current_setting('t.ph')::uuid, 'made up: belongs to the other one');
select api.identifier_add(current_setting('t.p2')::uuid, 'phone', '0500000077', 'made up: the right one');
select test.eq((select jsonb_build_object('can', x -> 'can_restore', 'why', x -> 'restore_blocked')
                from jsonb_array_elements(api.recently_deleted()) x where x ->> 'id' = current_setting('t.ph')),
  jsonb_build_object('can', false, 'why', 'restore.blocked_by_duplicate'),
  'a phone number another organisation holds is listed without Restore');

-- a row that may be restored still offers it, with no reason
select set_config('t.ach', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up restorable award',
  'happened_on', '2026-10-05')) ->> 'id', true);
select api.achievements_remove(array[current_setting('t.ach')::uuid], 'made up: logged twice');
select test.eq((select jsonb_build_object('can', x -> 'can_restore', 'why', x -> 'restore_blocked')
                from jsonb_array_elements(api.recently_deleted()) x where x ->> 'id' = current_setting('t.ach')),
  jsonb_build_object('can', true, 'why', null), 'a removal its remover may restore offers Restore');

-- for each of them, every listed row: the list's answer is the door's answer
create temporary table t_said (who text, entity text, id text, offered boolean, blocked text, went boolean, refused text);
grant all on t_said to authenticated;
do $$
declare
  p text;
  r jsonb;
  went boolean;
  refused text;
begin
  foreach p in array array['t.am1', 't.am2', 't.head', 't.admin'] loop
    perform test.as_person(current_setting(p)::uuid);
    for r in select x from jsonb_array_elements(api.recently_deleted()) x loop
      begin
        perform api.restore(r ->> 'entity', (r ->> 'id')::uuid);
        went := true;
        refused := null;
        raise exception using errcode = 'P0001', message = 'test.roll_back';
      exception when others then
        if sqlerrm <> 'test.roll_back' then
          went := false;
          refused := sqlerrm;
        end if;
      end;
      insert into t_said values (p, r ->> 'entity', r ->> 'id', (r ->> 'can_restore')::boolean, r ->> 'restore_blocked',
                                 went, refused);
    end loop;
  end loop;
end
$$;
select test.as_owner();
select test.ok((select count(*) from t_said where id = current_setting('t.so')) >= 3,
  'the removed owner is listed to the member, the head and the admin');
select test.eq((select coalesce(jsonb_agg(jsonb_build_object('who', who, 'entity', entity, 'offered', offered,
                                                             'blocked', blocked, 'went', went, 'refused', refused)), '[]')
                from t_said where offered is distinct from went or blocked is distinct from refused),
  '[]'::jsonb, 'every row: Restore is offered exactly when the restore goes through, and the reason is the door''s');
