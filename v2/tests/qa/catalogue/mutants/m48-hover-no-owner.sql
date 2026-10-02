-- Mutant m48-hover-no-owner: the hover card does not name the owner
CREATE OR REPLACE FUNCTION partner.hover(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
begin
  if not exists (select 1 from partner.partner p where p.id = p_id and p.deleted_at is null) then
    return null;
  end if;
  perform partner.require_level(p_id, null, 'view');
  return (select pg_catalog.jsonb_build_object(
      'id', p.id, 'number', p.number, 'trade_name_en', p.trade_name_en, 'trade_name_ar', p.trade_name_ar,
      'logo_file_id', p.logo_file_id, 'key_partner', p.key_partner,
      'owner_id', null,
      'sides', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                  'side', s.side, 'type', t.key, 'status', partner.status_of(p.id, s.side)) order by s.side)
                from partner.partner_side s join partner.side_type t on t.id = s.type_id
                where s.partner_id = p.id and s.deleted_at is null and partner.side_on(p.id, s.side)
                  and authz.level_of(me, partner.side_page(s.side)) >= 'view'), '[]'::jsonb))
    from partner.partner p where p.id = p_id);
end
$function$
;
