-- Sabotage: a-head-excludes-a-ledger-row
-- Breaks: sql:TGL-01
-- Expect: a head cannot exclude a row
-- Exclude on a ledger row is open to Full on Finance instead of admins only.
create or replace function finance.row_exclude(p_partner uuid, p_number text, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  why text := pg_catalog.btrim(coalesce(p_reason, ''));
  num text := pg_catalog.btrim(coalesce(p_number, ''));
  key text := norm.fold(pg_catalog.btrim(coalesce(p_number, '')));
  req uuid;
  rid uuid;
begin
  if why = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if p_partner is null or num = '' then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'row';
  end if;
  -- the row must be there: a unit recorded here or an imported money row of that organisation, by its own number
  if not exists (select 1 from finance.money_row_live m where m.partner_id = p_partner and norm.fold(m.ref) = key)
     and not exists (select 1 from finance.import_unit u where u.partner_id = p_partner and norm.fold(u.number) = key) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  begin
    req := audit.begin('ui', 'finance.row_excluded', pg_catalog.jsonb_build_object('number', num), why);
    insert into finance.exclusion_rule (kind, value_raw, mode, reason, partner_id, created_by)
    values ('invoice', num, 'exclude', why, p_partner, me)
    returning id into rid;
    perform audit.end();
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'finance.row_already_excluded', detail = num;
  end;
  return pg_catalog.jsonb_build_object('id', rid, 'number', num, 'request_id', req);
end
$$;
