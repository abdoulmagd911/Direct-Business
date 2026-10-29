-- Sabotage: switch-allows-any-admin
-- Breaks: sql:SWITCH-01
-- Expect: an admin not on the list is refused
-- Any admin may switch: the holder list is not checked.
create or replace function core.test_switch_start(p_person uuid) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  holder uuid := authz.real_me();
  dev uuid := (core.live_device()).id;
begin
  if holder is null or dev is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if not exists (select 1 from core.person o join core.role r on r.id = o.role_id where o.id = holder and r.is_admin) then
    raise exception using errcode = '42501', message = 'test_switch.not_allowed';
  end if;
  if authz.switch_target(holder) is not null then
    raise exception using errcode = 'P0001', message = 'test_switch.already_switched';
  end if;
  if not exists (select 1 from core.person t where t.id = p_person and t.is_test and t.active and t.deleted_at is null) then
    raise exception using errcode = '42501', message = 'test_switch.not_a_test_user';
  end if;
  update core.device_session set as_person_id = p_person, as_since = pg_catalog.now() where id = dev;
  -- logged as the TEST person, the owner named
  perform audit.begin('ui', 'test_switch.started', pg_catalog.jsonb_build_object('person_id', p_person));
  perform audit.end();
  return pg_catalog.jsonb_build_object('person_id', p_person);
end
$$;
