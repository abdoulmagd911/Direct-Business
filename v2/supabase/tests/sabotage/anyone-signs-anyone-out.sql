-- Sabotage: anyone-signs-anyone-out
-- Breaks: sql:SIGN-09
-- Expect: a team member cannot sign someone out
-- Signing a person out asks only that the caller is signed in, not that they hold org.sign_out.
create or replace function core.person_sign_out(p_person uuid, p_device uuid default null) returns int
language plpgsql volatile security definer set search_path = ''
as $$
begin
  return core.end_devices(p_person, p_device, null, 'admin', authz.me());
end
$$;
