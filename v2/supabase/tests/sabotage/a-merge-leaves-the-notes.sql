-- Sabotage: a-merge-leaves-the-notes
-- Breaks: sql:MRG-02
-- Expect: the merged partner's notes and calls are on the kept one's timeline
-- A merge leaves the merged partner's notes and calls behind on the archived record.
create or replace function partner.partner_merge(p_kept uuid, p_merged uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  kept partner.partner := partner.writable(p_kept);
  gone partner.partner := partner.writable(p_merged);
  me uuid := authz.require_capability('partners.merge');
  why text := core.access_reason(p_reason);
  i partner.identifier;
  req uuid;
begin
  if p_kept = p_merged then
    raise exception using errcode = 'P0001', message = 'partner.merge_itself';
  end if;
  req := audit.begin('ui', 'partner.merged', pg_catalog.jsonb_build_object('kept', kept.number, 'merged', gone.number), why);
  insert into partner.merge (kept_id, merged_id, reason, request_id) values (p_kept, p_merged, why, req);
  for i in select * from partner.identifier x where x.partner_id = p_merged and x.deleted_at is null order by x.created_at loop
    update partner.identifier set deleted_at = pg_catalog.now(), deleted_by = me,
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
  insert into partner.partner_role (partner_id, role_id, subkind, field_values, since, until)
  select p_kept, r.role_id, r.subkind, r.field_values, r.since, r.until from partner.partner_role r
  where r.partner_id = p_merged and r.deleted_at is null
    and not exists (select 1 from partner.partner_role x where x.partner_id = p_kept and x.role_id = r.role_id
                    and x.deleted_at is null);
  update partner.contact set partner_id = p_kept, is_primary = false where partner_id = p_merged and deleted_at is null;
  update partner.contract set partner_id = p_kept where partner_id = p_merged and deleted_at is null;
  if kept.logo_file_id is null and gone.logo_file_id is not null then
    update partner.partner set logo_file_id = gone.logo_file_id where id = p_kept;
  end if;
  update core.file_link l set entity_id = p_kept
  where l.entity_table = 'partner.partner' and l.entity_id = p_merged and l.deleted_at is null
    and (l.purpose <> 'logo' or (kept.logo_file_id is null and l.file_id = gone.logo_file_id))
    and not exists (select 1 from core.file_link x where x.file_id = l.file_id and x.entity_table = 'partner.partner'
                    and x.entity_id = p_kept and x.purpose = l.purpose and x.deleted_at is null);
  update partner.partner set archived_at = pg_catalog.now(), merged_into_id = p_kept where id = p_merged;
  perform audit.end();
  return pg_catalog.jsonb_build_object('kept', p_kept, 'merged', p_merged, 'request_id', req);
end
$$;
