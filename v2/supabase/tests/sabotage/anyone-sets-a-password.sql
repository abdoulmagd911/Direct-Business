-- Sabotage: anyone-sets-a-password
-- Breaks: sql:SIGN-10
-- Expect: a team member sets no password, not even their own
-- Setting a password forgets that it is an admin's (V166): any signed-in person resets anyone's sign-in.
create or replace function core.person_password_set(p_email uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  e core.person_email;
  a core.person_auth;
  req uuid;
  n int;
begin
  if p_reason is null or pg_catalog.btrim(p_reason) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  select * into e from core.person_email where id = p_email and deleted_at is null;
  if e.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  select * into a from core.person_auth x where x.email operator(extensions.=) e.email::extensions.citext;
  if a.id is null then
    raise exception using errcode = 'P0001', message = 'person_password.no_sign_in', detail = e.email::text;
  end if;
  req := audit.begin('ui', 'person_auth.password_set', pg_catalog.jsonb_build_object('email', e.email), p_reason);
  update core.person_auth set must_change_password = true, password_set_at = core.clock(), password_set_by = me
  where id = a.id;
  n := core.end_devices(a.person_id, null, null, 'admin', me);
  perform audit.end();
  return pg_catalog.jsonb_build_object('auth_user_id', a.auth_user_id, 'email', e.email, 'person_id', a.person_id,
                                       'signed_out', n, 'request_id', req);
end
$$;
