-- Mutant m52-merge-without-capability: merging needs no merge capability
CREATE OR REPLACE FUNCTION partner.partner_merge(p_kept uuid, p_merged uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  kept partner.partner := partner.writable(p_kept);
  gone partner.partner := partner.writable(p_merged);
  me uuid := authz.me();
  why text := core.access_reason(p_reason);
  i partner.identifier;
  s partner.partner_side;
  st text;
  req uuid;
begin
  if p_kept = p_merged then
    raise exception using errcode = 'P0001', message = 'partner.merge_itself';
  end if;
  req := audit.begin('ui', 'partner.merged', pg_catalog.jsonb_build_object('kept', kept.number, 'merged', gone.number), why);
  insert into partner.merge (kept_id, merged_id, reason, request_id) values (p_kept, p_merged, why, req);
  for s in select * from partner.partner_side x where x.partner_id = p_merged and x.deleted_at is null loop
    continue when exists (select 1 from partner.partner_side y where y.partner_id = p_kept and y.side = s.side
                          and y.deleted_at is null);
    insert into partner.partner_side (partner_id, side, type_id, tier_id, field_values, since, until)
    values (p_kept, s.side, s.type_id, s.tier_id, s.field_values, s.since, s.until);
    perform partner.side_owner_set_inner(p_kept, s.side, (select x from partner.side_owners(p_merged, s.side) x limit 1),
                                         core.riyadh_today(), why);
    st := partner.status_of(p_merged, s.side);
    if st is not null then
      insert into partner.side_status_change (partner_id, side, status, effective_on, reason_id, note)
      select p_kept, s.side, c.status, core.riyadh_today(), c.reason_id, 'merged from ' || gone.number
      from partner.side_status_change c where c.partner_id = p_merged and c.side = s.side and c.deleted_at is null
        and c.effective_on <= core.riyadh_today()
      order by c.effective_on desc, c.created_at desc limit 1;
    end if;
  end loop;
  for i in select * from partner.identifier x where x.partner_id = p_merged and x.deleted_at is null order by x.created_at loop
    update partner.identifier set deleted_at = core.clock(), deleted_by = me,
                                  delete_reason = 'merged into ' || kept.number
    where id = i.id;
    if not exists (select 1 from partner.identifier x where x.partner_id = p_kept and x.kind = i.kind
                   and x.value_key = i.value_key and x.deleted_at is null) then
      insert into partner.identifier (partner_id, kind, subkind, value_raw, value_key, norm_version, reason, source,
                                      valid_from, valid_to, note)
      values (p_kept, i.kind, case when i.kind = 'name' then 'alias' else i.subkind end, i.value_raw, i.value_key,
              i.norm_version, why, 'merge', i.valid_from, i.valid_to, i.note);
    end if;
  end loop;
  update partner.contact set partner_id = p_kept, is_primary = false where partner_id = p_merged and deleted_at is null;
  update partner.contract set partner_id = p_kept where partner_id = p_merged and deleted_at is null;
  update partner.reference set partner_id = p_kept where partner_id = p_merged and deleted_at is null;
  update core.note set entity_id = p_kept
  where entity_table = 'partner.partner' and entity_id = p_merged and deleted_at is null;
  if kept.logo_file_id is null and gone.logo_file_id is not null then
    update partner.partner set logo_file_id = gone.logo_file_id where id = p_kept;
  end if;
  update core.file_link l set entity_id = p_kept
  where l.entity_table = 'partner.partner' and l.entity_id = p_merged and l.deleted_at is null
    and (l.purpose <> 'logo' or (kept.logo_file_id is null and l.file_id = gone.logo_file_id))
    and not exists (select 1 from core.file_link x where x.file_id = l.file_id and x.entity_table = 'partner.partner'
                    and x.entity_id = p_kept and x.purpose = l.purpose and x.deleted_at is null);
  update partner.partner set archived_at = core.clock(), merged_into_id = p_kept where id = p_merged;
  perform audit.end();
  return pg_catalog.jsonb_build_object('kept', p_kept, 'merged', p_merged, 'request_id', req);
end
$function$
;
