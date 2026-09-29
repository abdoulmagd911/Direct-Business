-- Mutant m51-second-live-code: a second live discount code is taken without 'a second is meant'
CREATE OR REPLACE FUNCTION partner.identifier_add(p_partner uuid, p_kind text, p_value text, p_reason text, p_subkind text DEFAULT NULL::text, p_valid_from date DEFAULT NULL::date, p_valid_to date DEFAULT NULL::date, p_note text DEFAULT NULL::text, p_second_code boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p partner.partner := partner.writable(p_partner);
  client_only boolean := p_kind in ('payments_client_id', 'discount_code');
  why text;
  req uuid;
  iid uuid;
begin
  perform partner.require_cap(p_partner, case when client_only then 'client' end, 'identify');
  why := core.access_reason(p_reason);
  if p_kind = 'name' and p_subkind is distinct from 'alias' then
    raise exception using errcode = 'P0001', message = 'identifier.name_follows_partner';
  end if;
  if p_kind = 'discount_code'
     and coalesce((core.setting_at('partner.one_code_per_partner', null, core.riyadh_today()) #>> '{}')::boolean, true)
     and exists (select 1 from partner.identifier i where i.partner_id = p_partner and i.kind = 'discount_code'
                 and i.deleted_at is null
                 and pg_catalog.daterange(i.valid_from, i.valid_to, '[]') && pg_catalog.daterange(p_valid_from, p_valid_to, '[]')) then
    null;
  end if;
  req := audit.begin('ui', 'identifier.added', pg_catalog.jsonb_build_object('kind', p_kind), why);
  iid := partner.identifier_insert(p_partner, p_kind, p_value, p_subkind, why, 'person', p_valid_from, p_valid_to, p_note);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', iid, 'request_id', req);
end
$function$
;
