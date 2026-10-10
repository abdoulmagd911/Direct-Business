-- Sabotage: a-tender-names-another-organisations-client-id
-- Breaks: sql:TND-01
-- Expect: another organisation's tender ID is refused
-- A tender names another organisation's tender client ID, and that organisation's paid units consume it (V614).
create or replace function finance.tender_client_id_set(p_tender uuid, p_identifier uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  t pipeline.tender;
  d partner.identifier;
  req uuid;
begin
  select * into t from pipeline.tender x where x.id = p_tender and x.deleted_at is null for update;
  if t.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_identifier is not null then
    select * into d from partner.identifier x where x.id = p_identifier and x.deleted_at is null;
    if d.id is null or d.kind <> 'payments_client_id' or d.subkind is distinct from 'tender' then
      raise exception using errcode = 'P0001', message = 'finance.tender_client_id_invalid';
    end if;
  end if;
  if t.client_identifier_id is not distinct from p_identifier then
    return pg_catalog.jsonb_build_object('id', t.id, 'request_id', null);
  end if;
  req := audit.begin('ui', 'finance.tender_client_id_set',
                     pg_catalog.jsonb_build_object('tender', t.number, 'client_id', d.value_raw), p_reason);
  begin
    perform audit.write_fields('pipeline.tender', t.id, pg_catalog.jsonb_build_object('client_identifier_id', p_identifier));
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'finance.tender_client_id_taken';
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', t.id, 'request_id', req);
end
$$;
