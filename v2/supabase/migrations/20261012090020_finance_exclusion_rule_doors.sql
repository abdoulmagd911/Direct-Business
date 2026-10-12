-- The exclusion rules' doors (D16, V412, V413, V458; P4-2). Finance → Rules lists every rule with what it catches —
-- the rows and the riyals — and an admin adds, edits and removes them: logged, with a version check, and one Undo each.
-- A rule applies to every row at once, past ones included. Exclude is admin-only (V458), so these doors are too.
-- Forward-only.

-- Every live rule with the rows it catches now (the first rule that matches a row is the one that catches it).
create function finance.exclusion_rules() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform authz.require_admin();
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', r.id, 'kind', r.kind, 'value', r.value_raw, 'mode', r.mode, 'reason', r.reason,
             'version', r.version, 'created_at', r.created_at, 'created_by', r.created_by,
             'rows', coalesce(c.n, 0), 'amount_sar', coalesce(c.amount, 0))
           order by r.mode, r.kind, r.value_raw)
    from finance.exclusion_rule r
    left join (select (finance.exclusion_of(i.id)).id as rule_id, pg_catalog.count(*) as n,
                      sum(coalesce(i.total_sar, 0)) as amount
               from finance.invoice i where i.deleted_at is null
               group by 1) c on c.rule_id = r.id
    where r.deleted_at is null), '[]'::jsonb);
end
$$;

-- Add a rule (p_id null) or change one: kind, value, mode (exclude · hide) and the reason, which is required.
create function finance.exclusion_rule_save(p_id uuid, p_fields jsonb, p_version int default null,
                                            p_reason text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
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

-- Remove a rule (its rows count again at once); the reason is required.
create function finance.exclusion_rule_remove(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := authz.require_admin();
  cur finance.exclusion_rule;
  req uuid;
begin
  if pg_catalog.btrim(coalesce(p_reason, '')) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  select * into cur from finance.exclusion_rule x where x.id = p_id and x.deleted_at is null for update;
  if cur.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  req := audit.begin('ui', 'finance.exclusion_rule_removed',
                     pg_catalog.jsonb_build_object('kind', cur.kind, 'value', cur.value_raw), p_reason);
  update finance.exclusion_rule x set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = p_reason
  where x.id = cur.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cur.id, 'request_id', req);
end
$$;

create function api.finance_exclusion_rules() returns jsonb
language sql stable security invoker set search_path = ''
as $$ select finance.exclusion_rules() $$;
create function api.finance_exclusion_rule_save(p_id uuid, p_fields jsonb, p_version int default null,
                                                p_reason text default null) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.exclusion_rule_save(p_id, p_fields, p_version, p_reason) $$;
create function api.finance_exclusion_rule_remove(p_id uuid, p_reason text) returns jsonb
language sql volatile security invoker set search_path = ''
as $$ select finance.exclusion_rule_remove(p_id, p_reason) $$;

revoke all on function finance.exclusion_rules(), finance.exclusion_rule_save(uuid, jsonb, int, text),
  finance.exclusion_rule_remove(uuid, text), api.finance_exclusion_rules(),
  api.finance_exclusion_rule_save(uuid, jsonb, int, text), api.finance_exclusion_rule_remove(uuid, text) from public;
grant execute on function finance.exclusion_rules(), finance.exclusion_rule_save(uuid, jsonb, int, text),
  finance.exclusion_rule_remove(uuid, text), api.finance_exclusion_rules(),
  api.finance_exclusion_rule_save(uuid, jsonb, int, text), api.finance_exclusion_rule_remove(uuid, text) to authenticated;
