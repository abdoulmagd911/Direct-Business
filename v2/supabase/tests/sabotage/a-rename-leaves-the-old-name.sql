-- Sabotage: a-rename-leaves-the-old-name
-- Breaks: sql:NAME-01
-- Expect: the old name identifier is removed
-- Renaming a partner leaves its old name as an identifier, so invoices keep matching the old name only.
create or replace function partner.partner_update(p_id uuid, p_changes jsonb, p_version int, p_reason text default null)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p partner.partner := partner.writable(p_id);
  pv jsonb := partner.fields(p_changes);
  req uuid;
begin
  perform core.check_version('partner.partner', p_id, p_version,
    (select pg_catalog.array_agg(k) from pg_catalog.jsonb_object_keys(pv) k where (pg_catalog.to_jsonb(p) -> k) is distinct from (pv -> k)));
  req := audit.begin('ui', 'partner.updated', null, p_reason);
  perform audit.write_fields('partner.partner', p_id, pv);
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'version', (select x.version from partner.partner x where x.id = p_id),
                                       'request_id', req);
end
$$;
