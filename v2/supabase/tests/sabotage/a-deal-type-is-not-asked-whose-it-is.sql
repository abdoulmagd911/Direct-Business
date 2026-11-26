-- Sabotage: a-deal-type-is-not-asked-whose-it-is
-- Breaks: sql:OWN-02
-- Expect: a colleague cannot set its deal type
-- A deal type is set without asking whose client the row is.
CREATE OR REPLACE FUNCTION finance.deal_type_set(p_partner uuid, p_number text, p_type text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
  why text := pg_catalog.btrim(coalesce(p_reason, ''));
  num text := pg_catalog.btrim(coalesce(p_number, ''));
  key text := norm.fold(pg_catalog.btrim(coalesce(p_number, '')));
  req uuid;
  n_manual int := 0;
  n_import int := 0;
begin
  -- Landing 56: the row's organisation is the writer's own client (or the writer holds Full).
  if why = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if num = '' or (p_type is not null and p_type not in ('prepaid', 'postpaid', 'tender', 'promo')) then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'deal_type';
  end if;
  req := audit.begin('ui', 'finance.deal_type_set', pg_catalog.jsonb_build_object('number', num, 'type', p_type), why);
  -- the row recorded here with that number, at that organisation (or at none, when none is given)
  update finance.invoice i set deal_type = p_type, updated_at = now(), updated_by = me, version = i.version + 1
    where i.deleted_at is null and norm.fold(i.ref) = key and i.kind in ('transaction', 'standalone', 'billing')
      and (select m.partner_id from finance.partner_match(i.id) m limit 1) is not distinct from p_partner
      and i.deal_type is distinct from p_type;
  get diagnostics n_manual = row_count;
  -- the imported row with that number at that organisation
  if p_partner is not null then
    update work.import_record x set deal_type = p_type, updated_at = now(), updated_by = me, version = x.version + 1
      where x.deleted_at is null and x.partner_id = p_partner and x.kind in ('transaction', 'invoice')
        and norm.fold(coalesce(x.transaction_ref, x.invoice_ref)) = key
        and x.deal_type is distinct from p_type;
    get diagnostics n_import = row_count;
  end if;
  perform audit.end();
  if n_manual + n_import = 0 and not exists (
       select 1 from finance.invoice i where i.deleted_at is null and norm.fold(i.ref) = key
         and (select m.partner_id from finance.partner_match(i.id) m limit 1) is not distinct from p_partner)
     and not exists (
       select 1 from work.import_record x where x.deleted_at is null and x.partner_id = p_partner
         and x.kind in ('transaction', 'invoice') and norm.fold(coalesce(x.transaction_ref, x.invoice_ref)) = key) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return pg_catalog.jsonb_build_object('number', num, 'deal_type', p_type, 'changed', n_manual + n_import, 'request_id', req);
end
$function$;
