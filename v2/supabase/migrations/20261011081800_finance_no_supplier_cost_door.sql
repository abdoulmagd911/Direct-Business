-- QA-534 (the Architect's ruling of 11 Oct; V621, V627): a person with Full on Finance keeps the no-supplier-cost
-- list — the flag on a product, nothing else. A product's name, service, commission flag and retiring it stay with
-- admins in Settings → Finance (V97/V138), so the product list goes back to that page, and this door sets the one flag:
-- logged, with a version check, and one Undo. Forward-only.

create function finance.no_supplier_cost_set(p_product uuid, p_value boolean, p_version int, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  p finance.product;
  req uuid;
begin
  if p_value is null then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'no_supplier_cost';
  end if;
  select * into p from finance.product x where x.id = p_product and x.deleted_at is null for update;
  if p.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p.no_supplier_cost = p_value then
    return pg_catalog.jsonb_build_object('id', p.id, 'version', p.version, 'request_id', null);
  end if;
  perform core.check_version('finance.product', p.id, p_version, array['no_supplier_cost']);
  req := audit.begin('ui', 'finance.no_supplier_cost_set', pg_catalog.jsonb_build_object('product', p.name_en, 'value', p_value),
                     p_reason);
  perform audit.write_fields('finance.product', p.id, pg_catalog.jsonb_build_object('no_supplier_cost', p_value));
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p.id, 'version', p.version + 1, 'request_id', req);
end
$$;
comment on function finance.no_supplier_cost_set(uuid, boolean, int, text) is 'QA-534, V621: Full on Finance marks a product as having no supplier cost, or not — the one field; the rest of the product list is admins''.';

create function api.finance_no_supplier_cost_set(p_product uuid, p_value boolean, p_version int, p_reason text default null)
returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.no_supplier_cost_set(p_product, p_value, p_version, p_reason) $$;

revoke all on function finance.no_supplier_cost_set(uuid, boolean, int, text) from public;
grant execute on function finance.no_supplier_cost_set(uuid, boolean, int, text) to authenticated;
revoke all on function api.finance_no_supplier_cost_set(uuid, boolean, int, text) from public;
grant execute on function api.finance_no_supplier_cost_set(uuid, boolean, int, text) to authenticated;
