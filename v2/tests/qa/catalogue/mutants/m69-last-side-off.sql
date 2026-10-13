-- Mutant m69-last-side-off: the last side may be switched off
CREATE OR REPLACE FUNCTION partner.side_off(p_id uuid, p_side text, p_until date DEFAULT NULL::date, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  p partner.partner := partner.writable(p_id);
  cur partner.partner_side;
  day date := coalesce(p_until, core.riyadh_today());
  req uuid;
begin
  perform partner.require_level(p_id, p_side, 'full');
  select * into cur from partner.partner_side s where s.partner_id = p_id and s.side = p_side and s.deleted_at is null;
  if cur.id is null or not partner.side_on(p_id, p_side) then
    raise exception using errcode = 'P0001', message = 'partner.side_not_on', detail = p_side;
  end if;
  if not exists (select 1 from partner.partner_side s where s.partner_id = p_id and s.side <> p_side
                 and s.deleted_at is null and partner.side_on(p_id, s.side)) then
    null;
  end if;
  if cur.since is not null and day < cur.since then
    raise exception using errcode = 'P0001', message = 'partner.side_off_before_on';
  end if;
  req := audit.begin('ui', 'partner.side_off', pg_catalog.jsonb_build_object('side', p_side), p_reason);
  perform audit.write_fields('partner.partner_side', cur.id, pg_catalog.jsonb_build_object('until', day));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cur.id, 'request_id', req);
end
$function$
;
