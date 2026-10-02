-- Mutant m43-credit-shown-without-finance: the card shows credit limits without Finance View
CREATE OR REPLACE FUNCTION partner.partner_get(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.me();
  p partner.partner;
  sees_client boolean;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  select * into p from partner.partner where id = p_id and deleted_at is null;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform partner.require_level(p_id, null, 'view');
  sees_client := authz.level_of(me, 'clients') >= 'view';
  return pg_catalog.to_jsonb(p) - array['deleted_at', 'deleted_by', 'delete_reason'] || pg_catalog.jsonb_build_object(
    'sides', coalesce((select pg_catalog.jsonb_agg(partner.side_json(p.id, s.side) || pg_catalog.jsonb_build_object(
        'status_history', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', c.id, 'status', c.status, 'effective_on', c.effective_on, 'reason_id', c.reason_id, 'note', c.note,
            'set_by', c.created_by, 'set_at', c.created_at) order by c.effective_on desc, c.created_at desc)
          from partner.side_status_change c where c.partner_id = p.id and c.side = s.side and c.deleted_at is null), '[]'::jsonb),
        'owners', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'id', m.id, 'person_id', m.person_id, 'from', m.effective_from, 'to', m.effective_to, 'reason', m.reason)
            order by m.effective_from desc)
          from partner.side_owner m where m.partner_id = p.id and m.side = s.side and m.deleted_at is null), '[]'::jsonb))
        order by s.side)
      from partner.partner_side s where s.partner_id = p.id and s.deleted_at is null
        and authz.level_of(me, partner.side_page(s.side)) >= 'view'), '[]'::jsonb),
    'identifiers', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', i.id, 'kind', i.kind, 'subkind', i.subkind, 'value', i.value_raw, 'valid_from', i.valid_from,
        'valid_to', i.valid_to, 'source', i.source, 'reason', i.reason, 'added_by', i.created_by, 'added_at', i.created_at)
        order by i.kind, i.created_at)
      from partner.identifier i where i.partner_id = p.id and i.deleted_at is null
        and (sees_client or i.kind not in ('payments_client_id', 'discount_code'))), '[]'::jsonb),
    'owner_id', (select x from partner.owners(p.id) x limit 1),
    'contacts', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) - array['deleted_at', 'deleted_by',
        'delete_reason', 'created_by', 'updated_by'] order by c.is_primary desc, c.name_en)
      from partner.contact c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb),
    'credit_limits', case when sees_client then coalesce((
        select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', c.id, 'amount_sar', c.amount_sar, 'prepaid_only', c.amount_sar = 0, 'effective_from', c.effective_from,
          'approved_by', c.approved_by, 'reason', c.reason) order by c.effective_from desc)
        from partner.credit_limit c where c.partner_id = p.id and c.deleted_at is null), '[]'::jsonb) end,
    'references', partner.references(p.id),
    'last_activity_on', partner.last_activity_on(p.id),
    'stale_on', partner.stale_on(p.id),
    'next_step', (select pg_catalog.jsonb_build_object('note_id', n.id, 'text', n.next_step, 'on', n.next_step_on)
                  from core.note n
                  where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.kind = 'activity'
                    and n.deleted_at is null and n.next_step_on >= core.riyadh_today()
                  order by n.next_step_on, n.logged_at limit 1),
    'flags', partner.flags(p.id, me),
    'counts', pg_catalog.jsonb_build_object(
      'contracts', (select pg_catalog.count(*) from partner.contract c where c.partner_id = p.id and c.deleted_at is null
                      and partner.sees_side(me, p.id, c.side)),
      'files', (select pg_catalog.count(*) from core.file_link l join core.file f on f.id = l.file_id
                where l.entity_table = 'partner.partner' and l.entity_id = p.id and l.deleted_at is null
                  and f.deleted_at is null and l.purpose <> 'logo' and authz.file_visible(f.id)),
      'notes', (select pg_catalog.count(*) from core.note n
                where n.entity_table = 'partner.partner' and n.entity_id = p.id and n.deleted_at is null)));
end
$function$
;
