-- Mutant m63-fresh-by-logged-day: an activity freshens an organisation on the day it was logged, not the day it happened
CREATE OR REPLACE FUNCTION partner.stale_on(p_partner uuid)
 RETURNS date
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when p.archived_at is null and p.deleted_at is null
                   and exists (select 1 from partner.partner_side s where s.partner_id = p.id and s.deleted_at is null
                               and partner.side_on(p.id, s.side)
                               and partner.status_of(p.id, s.side) is distinct from 'lost')
              then greatest(coalesce(a.last_on, sd.since_on)
                              + coalesce((core.setting_at('partner.stale_after_days', null, core.riyadh_today()) #>> '{}')::int, 21),
                            a.next_on + 1) end
  from partner.partner p
  left join lateral (select pg_catalog.max(core.riyadh_day(n.logged_at)) as last_on, pg_catalog.max(n.next_step_on) as next_on
                     from core.note n
                     where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.kind = 'activity'
                       and n.deleted_at is null) a on true
  left join lateral (select pg_catalog.min(s.since) as since_on from partner.partner_side s
                     where s.partner_id = p.id and s.deleted_at is null and partner.side_on(p.id, s.side)) sd on true
  where p.id = p_partner
$function$
;
