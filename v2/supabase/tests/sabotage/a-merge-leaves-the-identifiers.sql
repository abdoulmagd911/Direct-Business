-- Sabotage: a-merge-leaves-the-identifiers
-- Breaks: sql:MRG-01
-- Expect: the merged partner's identifiers move to the kept one
-- A merge leaves the merged organisation's identifiers behind, on an archived record.
create or replace function partner.partner_merge(p_kept uuid, p_merged uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  kept partner.partner := partner.writable(p_kept);
  gone partner.partner := partner.writable(p_merged);
  me uuid := partner.require_cap(p_kept, null, 'merge');
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
  update partner.contact set partner_id = p_kept, is_primary = false where partner_id = p_merged and deleted_at is null;
  update partner.partner set archived_at = pg_catalog.now(), merged_into_id = p_kept where id = p_merged;
  perform audit.end();
  return pg_catalog.jsonb_build_object('kept', p_kept, 'merged', p_merged, 'request_id', req);
end
$$;
