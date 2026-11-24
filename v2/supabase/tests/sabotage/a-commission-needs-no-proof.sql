-- Sabotage: a-commission-needs-no-proof
-- Breaks: sql:CMN-01
-- Expect: a commission needs its proof
-- The door no longer asks for the proof of a commission.
create or replace function finance.commission_set(p_invoice uuid, p_type text, p_proof text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := authz.require('finance', 'full');
  why text := pg_catalog.btrim(coalesce(p_reason, ''));
  proof text := nullif(pg_catalog.btrim(coalesce(p_proof, '')), '');
  inv finance.invoice;
  req uuid;
begin
  select * into inv from finance.invoice where id = p_invoice and deleted_at is null;
  if inv.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if why = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  -- commissions never come from the payment system's files: a hand-typed row only
  if inv.source <> 'manual' or inv.kind not in ('transaction', 'standalone') then
    raise exception using errcode = 'P0001', message = 'finance.commission_is_typed_by_hand', detail = inv.ref;
  end if;
  if p_type is null or p_type not in ('airlines', 'provider', 'cashback', 'study_abroad', 'other') then
    raise exception using errcode = 'P0001', message = 'finance.commission_needs_type';
  end if;
  if false then
    raise exception using errcode = 'P0001', message = 'finance.commission_needs_proof';
  end if;
  if pg_catalog.length(proof) > 500 then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'proof';
  end if;
  req := audit.begin('ui', 'finance.commission_set', pg_catalog.jsonb_build_object('number', inv.ref, 'type', p_type), why);
  update finance.invoice set commission_type = p_type, commission_proof = proof,
    updated_at = now(), updated_by = me, version = version + 1 where id = inv.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('invoice_id', inv.id, 'commission_type', p_type, 'request_id', req);
end
$$;
