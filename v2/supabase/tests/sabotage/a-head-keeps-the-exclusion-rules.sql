-- Sabotage: a-head-keeps-the-exclusion-rules
-- Breaks: sql:EXC-02
-- Expect: a head cannot add a rule
-- Full on Finance adds an exclusion rule, which is admin-only (V458).
create or replace function finance.exclusion_rule_save(p_id uuid, p_fields jsonb, p_version int default null,
                                            p_reason text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require('finance', 'full');
  cur finance.exclusion_rule;
  req uuid;
  rid uuid;
  allowed text[] := array['kind', 'value', 'mode', 'reason'];
  changes jsonb := '{}'::jsonb;
begin
  if pg_catalog.jsonb_typeof(p_fields) is distinct from 'object'
     or exists (select 1 from pg_catalog.jsonb_object_keys(p_fields) k where k <> all (allowed)) then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'fields';
  end if;
  begin
    if p_id is null then
      req := audit.begin('ui', 'finance.exclusion_rule_added',
                         pg_catalog.jsonb_build_object('kind', p_fields ->> 'kind', 'value', p_fields ->> 'value'), p_reason);
      insert into finance.exclusion_rule (kind, value_raw, mode, reason, created_by)
      values (p_fields ->> 'kind', p_fields ->> 'value', coalesce(p_fields ->> 'mode', 'exclude'), p_fields ->> 'reason', me)
      returning id into rid;
      perform audit.end();
      return pg_catalog.jsonb_build_object('id', rid, 'version', 1, 'request_id', req);
    end if;
    select * into cur from finance.exclusion_rule x where x.id = p_id and x.deleted_at is null for update;
    if cur.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if p_fields ? 'kind' and p_fields ->> 'kind' is distinct from cur.kind then
      changes := changes || pg_catalog.jsonb_build_object('kind', p_fields ->> 'kind');
    end if;
    if p_fields ? 'value' and p_fields ->> 'value' is distinct from cur.value_raw then
      changes := changes || pg_catalog.jsonb_build_object('value_raw', p_fields ->> 'value');
    end if;
    if p_fields ? 'mode' and p_fields ->> 'mode' is distinct from cur.mode then
      changes := changes || pg_catalog.jsonb_build_object('mode', p_fields ->> 'mode');
    end if;
    if p_fields ? 'reason' and p_fields ->> 'reason' is distinct from cur.reason then
      changes := changes || pg_catalog.jsonb_build_object('reason', p_fields ->> 'reason');
    end if;
    if changes = '{}'::jsonb then
      return pg_catalog.jsonb_build_object('id', cur.id, 'version', cur.version, 'request_id', null);
    end if;
    perform core.check_version('finance.exclusion_rule', cur.id, p_version,
                               array(select pg_catalog.jsonb_object_keys(changes)));
    req := audit.begin('ui', 'finance.exclusion_rule_changed',
                       pg_catalog.jsonb_build_object('kind', cur.kind, 'value', cur.value_raw), p_reason);
    perform audit.write_fields('finance.exclusion_rule', cur.id, changes);
    perform audit.end();
    return pg_catalog.jsonb_build_object('id', cur.id, 'version', cur.version + 1, 'request_id', req);
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'finance.exclusion_rule_exists',
                          detail = coalesce(p_fields ->> 'value', cur.value_raw);
  end;
end
$$;
