-- The SQL test harness, applied after the migrations on both stacks (plain Postgres and the Supabase stack), never on
-- the cloud project. Ported from scripts/qa/phase3/attacks.py: its as_user, expect_fail (here test.raises) and the
-- per-test rollback (the runner wraps every test file in begin … rollback).
--
-- A test file is plain SQL; it fails when any statement errors. Assertions raise SQLSTATE TF001 with "FAIL: …".
drop schema if exists test cascade;
create schema test;
grant usage on schema test to anon, authenticated, service_role;
alter default privileges in schema test grant execute on functions to anon, authenticated, service_role;

-- ---------------------------------------------------------------- assertions

create function test.fail(what text) returns void
language plpgsql as $$
begin
  raise exception using errcode = 'TF001', message = 'FAIL: ' || what;
end
$$;

create function test.ok(cond boolean, what text) returns void
language plpgsql as $$
begin
  if cond is not true then
    perform test.fail(what);
  end if;
end
$$;

create function test.eq(got anyelement, want anyelement, what text) returns void
language plpgsql as $$
begin
  if got is distinct from want then
    perform test.fail(format('%s — expected %s, got %s', what, coalesce(want::text, 'NULL'), coalesce(got::text, 'NULL')));
  end if;
end
$$;

-- Runs `sql` in a sub-transaction (rolled back either way) and requires it to raise `errcode`, and when given, a
-- message matching `message_like` (ILIKE). A statement that runs is a failure: "a refusal is always an error" (A6).
create function test.raises(sql text, errcode text, what text, message_like text default null) returns void
language plpgsql as $$
declare
  st text;
  msg text;
begin
  begin
    execute sql;
  exception when others then
    get stacked diagnostics st = returned_sqlstate, msg = message_text;
    if st = 'TF001' then
      raise;
    end if;
    if st is distinct from errcode then
      perform test.fail(format('%s — expected error %s, got %s: %s', what, errcode, st, msg));
    end if;
    if message_like is not null and msg not ilike message_like then
      perform test.fail(format('%s — error %s said "%s", not like "%s"', what, st, msg, message_like));
    end if;
    return;
  end;
  perform test.fail(format('%s — expected error %s, but the statement ran', what, errcode));
end
$$;

-- ---------------------------------------------------------------- who is asking
-- As on Supabase: PostgREST switches to the request's role and puts the JWT claims in request.jwt.claims; auth.uid()
-- reads `sub` from them. These last until the test's transaction ends.

create function test.as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
end
$$;

create function test.as_auth(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
end
$$;

create function test.as_owner() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end
$$;

-- ---------------------------------------------------------------- the grants snapshot (A8)

-- v2's own schemas: every grant on them is in supabase/grants.expected. A schema made by a migration and missing
-- here fails GRANTS-02, so nothing escapes the snapshot.
create function test.v2_schemas() returns text[]
language sql immutable as $$
  select array['core', 'audit', 'notify', 'authz', 'api', 'norm', 'measure',
               'partner', 'finance', 'work', 'perf', 'report', 'appraisal', 'io']
$$;

-- The roles a request can act as. Grants to the owner and to platform roles are not part of the promise.
create function test.api_roles() returns text[]
language sql immutable as $$
  select array['public', 'anon', 'authenticated', 'service_role', 'authenticator']
$$;

create function test.role_name(oid) returns text
language sql stable as $$
  select case when $1 = 0 then 'public' else pg_get_userbyid($1) end
$$;

-- One line per privilege a request role holds on v2's schemas, tables, columns and functions, plus the migration
-- role's effective default privileges (what a NEW object will grant).
create function test.grants_actual() returns setof text
language sql stable as $$
  with v2 as (
    select n.oid, n.nspname, n.nspacl, n.nspowner from pg_namespace n where n.nspname = any (test.v2_schemas())
  ),
  schema_lines as (
    select format('schema %s %s %s', v2.nspname, lower(a.privilege_type), test.role_name(a.grantee)) as line
    from v2, aclexplode(coalesce(v2.nspacl, acldefault('n', v2.nspowner))) a
  ),
  rel as (
    select c.oid, v2.nspname, c.relname, c.relkind, c.relacl, c.relowner
    from pg_class c join v2 on v2.oid = c.relnamespace
    where c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
  ),
  rel_lines as (
    select format('%s %s.%s %s %s',
             case rel.relkind when 'S' then 'sequence' when 'v' then 'view' when 'm' then 'view' else 'table' end,
             rel.nspname, rel.relname, lower(a.privilege_type), test.role_name(a.grantee)) as line
    from rel, aclexplode(coalesce(rel.relacl, acldefault((case rel.relkind when 'S' then 's' else 'r' end)::"char", rel.relowner))) a
  ),
  col_lines as (
    select format('column %s.%s.%s %s %s', rel.nspname, rel.relname, att.attname, lower(a.privilege_type),
             test.role_name(a.grantee)) as line
    from rel join pg_attribute att on att.attrelid = rel.oid and att.attnum > 0 and not att.attisdropped
      and att.attacl is not null,
      aclexplode(att.attacl) a
  ),
  fn_lines as (
    select format('function %s.%s(%s) %s %s', v2.nspname, p.proname, pg_get_function_identity_arguments(p.oid),
             lower(a.privilege_type), test.role_name(a.grantee)) as line
    from pg_proc p join v2 on v2.oid = p.pronamespace,
      aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  ),
  type_lines as (
    select format('type %s.%s %s %s', v2.nspname, t.typname, lower(a.privilege_type), test.role_name(a.grantee)) as line
    from pg_type t join v2 on v2.oid = t.typnamespace,
      aclexplode(coalesce(t.typacl, acldefault('T', t.typowner))) a
    where t.typtype in ('e', 'd', 'c') and not exists (select 1 from pg_class c where c.reltype = t.oid)
  ),
  -- effective global defaults of the migration role (the role running this = the role that ran the migrations)
  default_global as (
    select k.objtype, a.privilege_type, a.grantee
    from (values ('r'), ('S'), ('f'), ('T')) k(objtype)
      left join pg_default_acl d
        on d.defaclrole = current_user::regrole and d.defaclnamespace = 0 and d.defaclobjtype = k.objtype::"char",
      aclexplode(coalesce(d.defaclacl, acldefault((case k.objtype when 'r' then 'r' when 'S' then 's' when 'f' then 'f' else 'T' end)::"char",
                                                 current_user::regrole))) a
  ),
  default_schema as (
    select v2.nspname, d.defaclobjtype::text as objtype, a.privilege_type, a.grantee
    from pg_default_acl d join v2 on v2.oid = d.defaclnamespace, aclexplode(d.defaclacl) a
    where d.defaclrole = current_user::regrole
  ),
  default_lines as (
    select format('default %s everywhere %s %s',
             case objtype when 'r' then 'tables' when 'S' then 'sequences' when 'f' then 'functions' else 'types' end,
             lower(privilege_type), test.role_name(grantee)) as line
    from default_global
    union all
    select format('default %s in %s %s %s',
             case objtype when 'r' then 'tables' when 'S' then 'sequences' when 'f' then 'functions' else 'types' end,
             nspname, lower(privilege_type), test.role_name(grantee)) as line
    from default_schema
  )
  select line from (
    select line from schema_lines union select line from rel_lines union select line from col_lines
    union select line from fn_lines union select line from type_lines union select line from default_lines
  ) all_lines
  where split_part(line, ' ', array_length(string_to_array(line, ' '), 1)) = any (test.api_roles())
  order by line
$$;

create table test.grants_expected (line text primary key);
