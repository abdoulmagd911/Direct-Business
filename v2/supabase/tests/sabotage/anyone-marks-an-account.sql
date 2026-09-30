-- Sabotage: anyone-marks-an-account
-- Breaks: sql:ACCT-01
-- Expect: a team member marks no account
-- Marking an account forgets that it is an admin's: anyone takes themselves out of the team or makes the admin account a member again.
create or replace function core.person_account_set(p_id uuid, p_account text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  req uuid;
begin
  if p_reason is null or pg_catalog.btrim(p_reason) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if p_account is null or p_account not in ('team_member', 'admin_account', 'test_account') then
    raise exception using errcode = 'P0001', message = 'person.unknown_account', detail = p_account;
  end if;
  if not exists (select 1 from core.person p where p.id = p_id and p.kind = 'staff' and p.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_account <> 'team_member'
     and exists (select 1 from core.person p where p.manager_id = p_id and p.deleted_at is null) then
    raise exception using errcode = 'P0001', message = 'person.has_reports';
  end if;
  if p_account <> 'team_member' and exists (select 1 from core.person p where p.account = p_account
                                            and p.id <> p_id and p.deleted_at is null) then
    raise exception using errcode = '23505', message = 'person.account_taken', detail = p_account;
  end if;
  req := audit.begin('ui', 'person.account_set', pg_catalog.jsonb_build_object('account', p_account), p_reason);
  update core.person set account = p_account where id = p_id and account is distinct from p_account;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'account', p_account,
                                       'version', (select p.version from core.person p where p.id = p_id),
                                       'request_id', req);
end
$$;
