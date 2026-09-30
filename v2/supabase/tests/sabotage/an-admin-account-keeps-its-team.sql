-- Sabotage: an-admin-account-keeps-its-team
-- Breaks: sql:ACCT-02
-- Expect: marking the admin account takes it out of its team and its manager's line
-- Marking the admin account leaves its team and manager in place (and the guard lets it).
create or replace function core.person_account_set(p_id uuid, p_account text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
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

create or replace function core.person_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cur uuid := new.manager_id;
  hops int := 0;
begin
  if new.team_id is not null
     and not exists (select 1 from core.team t where t.id = new.team_id and t.department_id = new.department_id) then
    raise exception using errcode = 'P0001', message = 'person.team_outside_department';
  end if;
  if new.manager_id is distinct from old.manager_id and new.manager_id is not null
     and not core.is_team_member(new.manager_id) then
    raise exception using errcode = 'P0001', message = 'person.manager_not_team_member';
  end if;
  while cur is not null and hops < 1000 loop
    if cur = new.id then
      raise exception using errcode = 'P0001', message = 'person.manager_cycle';
    end if;
    select p.manager_id into cur from core.person p where p.id = cur;
    hops := hops + 1;
  end loop;
  return new;
end
$$;
