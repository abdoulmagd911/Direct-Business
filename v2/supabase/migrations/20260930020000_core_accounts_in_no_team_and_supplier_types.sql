-- Two production findings of 29 Sep (the oversight's walk of the live site, 23:57 Riyadh), V179 and V180.

-- ================================================================ W26: the admin and test accounts are in no team (V179)
-- The owner's admin account showed a team and a manager: V444 says it is never a team member — not in team lists,
-- KPIs, leaderboards or reports-to pickers. An admin or test account now has no team and no manager: marking a person
-- as one takes them out of both in the same request, and neither can be given back while the account stands.

-- core.person_guard as P3-2b wrote it, plus the account's rule.
create or replace function core.person_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cur uuid := new.manager_id;
  hops int := 0;
begin
  if new.account <> 'team_member' and (new.team_id is not null or new.manager_id is not null) then
    raise exception using errcode = 'P0001', message = 'person.account_in_no_team', detail = new.account;
  end if;
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

-- core.person_account_set as P3-2b wrote it: marking the admin or the test account also clears the person's team and
-- manager, in the same logged request (one Undo puts all three back).
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
  update core.person set account = p_account,
                         team_id = case when p_account = 'team_member' then team_id end,
                         manager_id = case when p_account = 'team_member' then manager_id end
  where id = p_id
    and (account is distinct from p_account
         or (p_account <> 'team_member' and (team_id is not null or manager_id is not null)));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'account', p_account,
                                       'version', (select p.version from core.person p where p.id = p_id),
                                       'request_id', req);
end
$$;

-- ================================================================ W12: the owner's seven Supplier & partner types (V180)
-- V448: Hotel supplier · Airline · Visa/Embassy · Payment provider · Sales channel · Technology · Strategic partner.
-- A key never changes, so the entries that mean the same keep theirs: supplier is named Hotel supplier, payment_solution
-- Payment provider, integration (a technical integration's partner, V99, V407) Technology; Airline and Visa/Embassy are
-- added. Nothing is retired. Only an entry still as seeded changes: one an admin has renamed or re-sorted in Settings
-- stays theirs.
select audit.begin('system', 'partner.supplier_types_v448', null, 'V180: the owner''s seven Supplier & partner types');
update partner.side_type set name_en = 'Payment provider', name_ar = 'مزود خدمات الدفع', sort = 40
where side = 'supplier_partner' and key = 'payment_solution' and name_en = 'Payment solution' and sort = 50;
update partner.side_type set name_en = 'Technology', name_ar = 'تقنية', sort = 60
where side = 'supplier_partner' and key = 'integration' and name_en = 'Integration' and sort = 40;
update partner.side_type set sort = 50 where side = 'supplier_partner' and key = 'sales_channel' and sort = 30;
update partner.side_type set sort = 70 where side = 'supplier_partner' and key = 'strategic_partner' and sort = 20;
update partner.side_type set name_en = 'Hotel supplier', name_ar = 'مورد فنادق', sort = 10
where side = 'supplier_partner' and key = 'supplier' and name_en = 'Supplier' and sort = 10;
insert into partner.side_type (side, key, name_en, name_ar, sort) values
  ('supplier_partner', 'airline', 'Airline', 'شركة طيران', 20),
  ('supplier_partner', 'visa_embassy', 'Visa/Embassy', 'التأشيرات والسفارات', 30)
on conflict (side, key) do nothing;
select audit.end();
