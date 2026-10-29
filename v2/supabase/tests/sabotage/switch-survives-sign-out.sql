-- Sabotage: switch-survives-sign-out
-- Breaks: sql:SWITCH-01
-- Expect: signing out while switched signs this device out
-- QA-612 undone: the device's own sign-out looks for the device under the TEST person, finds none and signs nothing out.
create or replace function core.device_sign_out(p_device uuid default null) returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  n int;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  n := core.end_devices(me, coalesce(p_device, (core.live_device()).id), null, 'person', me);
  if n = 0 then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return n;
end
$$;
