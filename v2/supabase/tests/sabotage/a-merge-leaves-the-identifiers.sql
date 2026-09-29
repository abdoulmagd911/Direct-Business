-- Sabotage: a-merge-leaves-the-identifiers
-- Breaks: sql:MRG-01
-- Expect: the merged partner's identifiers move to the kept one
-- A merge leaves the merged partner's identifiers behind, on an archived record.
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
  insert into partner.partner_role (partner_id, role_id, subkind, field_values, since, until)
  select p_kept, r.role_id, r.subkind, r.field_values, r.since, r.until from partner.partner_role r
  where r.partner_id = p_merged and r.deleted_at is null
    and not exists (select 1 from partner.partner_role x where x.partner_id = p_kept and x.role_id = r.role_id
                    and x.deleted_at is null);
  update partner.contact set partner_id = p_kept, is_primary = false where partner_id = p_merged and deleted_at is null;
  update partner.partner set archived_at = pg_catalog.now(), merged_into_id = p_kept where id = p_merged;
  perform audit.end();
  return pg_catalog.jsonb_build_object('kept', p_kept, 'merged', p_merged, 'request_id', req);
end
$$;
