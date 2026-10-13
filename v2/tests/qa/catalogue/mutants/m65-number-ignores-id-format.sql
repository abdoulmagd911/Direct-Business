-- Mutant m65-number-ignores-id-format: the organisation number is hard-coded (DK-P, width 4), not read from partner.id_format
CREATE OR REPLACE FUNCTION partner.partner_create(p_partner jsonb, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  pv jsonb;
  fmt jsonb := core.setting_at('partner.id_format', null, core.riyadh_today());
  pid uuid;
  num text;
  req uuid;
  s jsonb;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  if pg_catalog.jsonb_typeof(p_partner -> 'sides') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_partner -> 'sides') = 0 then
    raise exception using errcode = 'P0001', message = 'partner.side_required';
  end if;
  for s in select * from pg_catalog.jsonb_array_elements(p_partner -> 'sides') loop
    if s ->> 'side' is null or s ->> 'side' not in ('client', 'supplier_partner') then
      raise exception using errcode = 'P0001', message = 'partner.unknown_side', detail = s ->> 'side';
    end if;
    perform authz.require(partner.side_page(s ->> 'side'), 'full');
  end loop;
  pv := partner.fields(p_partner - 'sides');
  if not (pv ? 'trade_name_en') then
    raise exception using errcode = 'P0001', message = 'partner.trade_name_required';
  end if;
  req := audit.begin('ui', 'partner.created', null, p_reason);
  -- organisation numbers never restart: the counter's year 2000 row is their all-time row
  num := 'DK-P-' || pg_catalog.lpad(core.next_number('partner', 2000)::text, 4, '0');
  insert into partner.partner (number, trade_name_en, trade_name_ar, official_name_en, official_name_ar, priority_id,
                               key_partner, website, city, country, address, notes, client_since)
  select num, pg_catalog.btrim(x.trade_name_en), x.trade_name_ar, x.official_name_en, x.official_name_ar, x.priority_id,
         coalesce(x.key_partner, false), x.website, x.city, x.country, x.address, x.notes, x.client_since
  from pg_catalog.jsonb_populate_record(null::partner.partner, pv) x
  returning id into pid;
  perform partner.names_sync(pid, p_reason);
  for s in select * from pg_catalog.jsonb_array_elements(p_partner -> 'sides') loop
    perform partner.side_put(pid, s ->> 'side', s - 'side', p_reason);
  end loop;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', pid, 'number', num, 'version', 1, 'request_id', req);
end
$function$
;
