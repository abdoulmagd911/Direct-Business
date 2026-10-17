-- Sabotage: a-credit-split-need-not-add-up
-- Breaks: sql:FLOW-03
-- Expect: shares that do not add up to 1 are refused
-- A credit split whose shares add up to more than 1 is kept, crediting more revenue than the unit has (section 3.6).
create or replace function finance.credit_split_set(p_invoice uuid, p_shares jsonb, p_note text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require_capability('finance.credit');
  inv finance.invoice;
  total numeric;
  req uuid;
begin
  select * into inv from finance.invoice i where i.id = p_invoice and i.deleted_at is null for update;
  if inv.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if pg_catalog.btrim(coalesce(p_note, '')) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if pg_catalog.jsonb_typeof(p_shares) is distinct from 'array'
     or exists (select 1 from pg_catalog.jsonb_array_elements(p_shares) e
                where pg_catalog.jsonb_typeof(e) <> 'object' or not (e ? 'person_id' and e ? 'share')) then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'shares';
  end if;
  if pg_catalog.jsonb_array_length(p_shares) > 0 then
    select sum((e ->> 'share')::numeric) into total from pg_catalog.jsonb_array_elements(p_shares) e;
    if false then
      raise exception using errcode = 'P0001', message = 'finance.credit_shares_sum', detail = total::text;
    end if;
    if (select pg_catalog.count(distinct e ->> 'person_id') from pg_catalog.jsonb_array_elements(p_shares) e)
       <> pg_catalog.jsonb_array_length(p_shares) then
      raise exception using errcode = 'P0001', message = 'finance.credit_person_twice';
    end if;
    if exists (select 1 from pg_catalog.jsonb_array_elements(p_shares) e
               where not exists (select 1 from core.person p where p.id = (e ->> 'person_id')::uuid and p.kind = 'staff'
                                 and p.deleted_at is null)) then
      raise exception using errcode = 'P0001', message = 'finance.credit_not_staff';
    end if;
  end if;
  req := audit.begin('ui', 'finance.credit_split_set', pg_catalog.jsonb_build_object('invoice', inv.ref,
                                                                                      'people', pg_catalog.jsonb_array_length(p_shares)),
                     p_note);
  update finance.credit_split s set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_note
  where s.invoice_id = inv.id and s.deleted_at is null;
  insert into finance.credit_split (invoice_id, person_id, share, note, created_by)
  select inv.id, (e ->> 'person_id')::uuid, (e ->> 'share')::numeric, p_note, me
  from pg_catalog.jsonb_array_elements(p_shares) e;
  perform audit.end();
  return pg_catalog.jsonb_build_object('invoice_id', inv.id, 'people', pg_catalog.jsonb_array_length(p_shares),
                                       'request_id', req);
end
$$;
