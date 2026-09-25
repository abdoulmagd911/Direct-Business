-- Phase 1a — the database attack tests for the four access levels (D2).
--
-- Runs against the LIVE database and changes nothing: everything happens inside one transaction
-- that ALWAYS ends in an exception, so Postgres throws all of it away. The result is the text of
-- that exception: "ACCESS-ATTACKS pass=N fail=M ..." with every failure named.
-- Run it with the Supabase SQL tool (or psql) as the database owner. No password of any person is
-- used: the attacker is the QA account (test@directksa.com), switched to employee or manager INSIDE
-- the transaction, and each attack is made under the `authenticated` database role so the real
-- row-level rules apply exactly as they do for a signed-in browser.
--
-- SABOTAGE CHECK (P5 / the probes-must-be-able-to-fail rule): set `sabotage` below to true. That
-- replaces page_level() — inside the same doomed transaction — with one that answers 'full' for
-- everyone. The run must then report failures (an employee opening Proposals, a viewer writing to
-- Finance, ...). If it still says fail=0, the tests prove nothing.

begin;
do $$
declare
  sabotage boolean := false;          -- flip to true for the sabotage run
  qa uuid; emp uuid; adm uuid; inv text; n int; lv jsonb; total_people int;
  pass int := 0; fail int := 0; msg text := '';
begin
  select id into qa  from public.app_users where email = 'test@directksa.com';
  select id into emp from public.app_users where role = 'team_member' and active and id <> qa order by email limit 1;
  select id into adm from public.app_users where role = 'admin' and active and id <> qa order by email limit 1;
  select id::text into inv from public.finance_invoices order by id limit 1;
  select count(*) into total_people from public.app_users;
  if qa is null or emp is null or adm is null or inv is null then
    raise exception 'ACCESS-ATTACKS cannot run: a fixture is missing (qa %, employee %, admin %, invoice %)', qa is not null, emp is not null, adm is not null, inv is not null;
  end if;

  if sabotage then
    execute $f$create or replace function public.page_level(p text) returns text language sql stable
               security definer set search_path to 'public' as $b$ select 'full'::text $b$ $f$;
  end if;

  -- helpers: act as the QA account (as `authenticated`), or step back to the owner for setup
  create temp table _t(name text, ok boolean, got text) on commit drop;
  grant all on pg_temp._t to authenticated, anon;

  ---------------------------------------------------------------- as an EMPLOYEE
  update public.app_users set role = 'team_member', page_access = public.default_page_levels('team_member') where id = qa;
  perform set_config('request.jwt.claims', json_build_object('sub', qa, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', qa::text, true);
  set local role authenticated;

  insert into _t values ('E1 employee: Leads is full',            public.page_level('leads') = 'full',      public.page_level('leads'));
  insert into _t values ('E2 employee: Proposals is none',        public.page_level('offers') = 'none',     public.page_level('offers'));
  insert into _t values ('E3 employee: Settings is none',         public.page_level('settings') = 'none',   public.page_level('settings'));
  insert into _t values ('E4 employee: an unknown page is none',  public.page_level('nonsense') = 'none',   public.page_level('nonsense'));
  insert into _t values ('E5 employee: the five new pages are none',
        (select bool_and(public.page_level(p) = 'none') from unnest(array['projects','bookings','invoices','tickets','sync']) p), null);
  lv := public.my_page_levels();
  insert into _t values ('E6 employee: my_page_levels names all 20 pages', (select count(*) from jsonb_object_keys(lv)) = 20, lv::text);

  begin
    perform public.set_page_levels(emp, '{"finance":"view"}'::jsonb);
    insert into _t values ('E7 employee cannot change anyone''s access', false, 'accepted');
  exception when others then
    insert into _t values ('E7 employee cannot change anyone''s access', sqlstate = '42501', sqlerrm);
  end;

  -- a direct write to the grid, going round the function
  update public.app_users set page_access = '{"settings":"full"}'::jsonb where id = qa;
  get diagnostics n = row_count;
  insert into _t values ('E8 employee cannot write their own grid directly', n = 0, n::text);
  insert into _t values ('E9 employee cannot read the team''s access list',
        (select count(*) from public.team_access_list()) = 0, (select count(*) from public.team_access_list())::text);
  reset role;

  ---------------------------------------------------------------- VIEW on Finance and Settings
  update public.app_users set page_access = '{"today":"full","finance":"view","settings":"view"}'::jsonb where id = qa;
  set local role authenticated;
  insert into _t values ('V1 viewer on Finance can still read invoices',
        (select count(*) from public.finance_invoices where id::text = inv) = 1, null);
  update public.finance_invoices set id = id where id::text = inv;
  get diagnostics n = row_count;
  insert into _t values ('V2 viewer on Finance cannot change an invoice', n = 0, n::text);
  update public.app_settings set updated_by = updated_by;
  get diagnostics n = row_count;
  insert into _t values ('V3 viewer on Settings cannot change settings', n = 0, n::text);
  reset role;

  -- the control for V2: the same write as FULL on Finance must go through (else V2 proves nothing)
  update public.app_users set page_access = '{"today":"full","finance":"full"}'::jsonb where id = qa;
  set local role authenticated;
  update public.finance_invoices set id = id where id::text = inv;
  get diagnostics n = row_count;
  insert into _t values ('V4 control: full on Finance CAN change an invoice', n = 1, n::text);
  reset role;

  -- OWN is not a write level yet anywhere (each page learns it in 1b)
  update public.app_users set page_access = '{"today":"full","finance":"own"}'::jsonb where id = qa;
  set local role authenticated;
  update public.finance_invoices set id = id where id::text = inv;
  get diagnostics n = row_count;
  insert into _t values ('O1 own on Finance does not yet write through the old rules', n = 0, n::text);
  insert into _t values ('O2 own on Finance still opens the page', public.can_see_page('finance'), null);
  reset role;

  ---------------------------------------------------------------- as the MANAGER
  update public.app_users set role = 'manager', page_access = public.default_page_levels('manager') where id = qa;
  set local role authenticated;
  begin
    perform public.set_page_levels(adm, '{"finance":"view"}'::jsonb);
    insert into _t values ('M1 manager cannot change an admin', false, 'accepted');
  exception when others then insert into _t values ('M1 manager cannot change an admin', sqlstate = '42501', sqlerrm); end;
  begin
    perform public.set_page_levels(qa, '{"reports":"full"}'::jsonb);
    insert into _t values ('M2 manager cannot change their own access', false, 'accepted');
  exception when others then insert into _t values ('M2 manager cannot change their own access', sqlstate = '42501', sqlerrm); end;
  begin
    perform public.set_page_levels(emp, '{"documents":"full"}'::jsonb);   -- the manager has no Generator
    insert into _t values ('M3 manager cannot give more than their own level', false, 'accepted');
  exception when others then insert into _t values ('M3 manager cannot give more than their own level', sqlstate = '42501', sqlerrm); end;
  begin
    perform public.set_page_levels(emp, '{"nonsense":"view"}'::jsonb);
    insert into _t values ('M4 an unknown page is refused', false, 'accepted');
  exception when others then insert into _t values ('M4 an unknown page is refused', sqlstate = '22023', sqlerrm); end;
  begin
    perform public.set_page_levels(emp, '{"finance":"editor"}'::jsonb);   -- only the four words
    insert into _t values ('M5 an old or unknown level word is refused', false, 'accepted');
  exception when others then insert into _t values ('M5 an old or unknown level word is refused', sqlstate = '22023', sqlerrm); end;
  begin
    lv := public.set_page_levels(emp, '{"offers":"full","finance":"view"}'::jsonb);
    insert into _t values ('M6 manager CAN give Proposals and lower Finance for an employee',
          lv->>'offers' = 'full' and lv->>'finance' = 'view' and lv->>'leads' = 'full', lv::text);
  exception when others then insert into _t values ('M6 manager CAN give Proposals and lower Finance for an employee', false, sqlerrm); end;
  insert into _t values ('M8 manager reads the whole team''s access list', (select count(*) from public.team_access_list()) = total_people,
        (select count(*) from public.team_access_list())::text || ' of ' || total_people);
  reset role;
  insert into _t values ('M7 the change is in the history log, naming who did it',
        exists(select 1 from public.record_history where table_name = 'access' and action = 'levels_changed'
               and record_id = emp and actor = qa and after_row->'levels'->>'offers' = 'full'), null);

  ---------------------------------------------------------------- the grid guard and the starting grid
  begin
    update public.app_users set page_access = '{"nonsense":"full"}'::jsonb where id = emp;
    insert into _t values ('G1 an unknown page cannot be stored, even by the owner', false, 'accepted');
  exception when others then insert into _t values ('G1 an unknown page cannot be stored, even by the owner', sqlstate = '22023', sqlerrm); end;
  begin
    update public.app_users set page_access = '{"finance":"god"}'::jsonb where id = emp;
    insert into _t values ('G2 an unknown level cannot be stored', false, 'accepted');
  exception when others then insert into _t values ('G2 an unknown level cannot be stored', sqlstate = '22023', sqlerrm); end;
  update public.app_users set role = 'admin', page_access = null where id = qa;
  update public.app_users set role = 'team_member' where id = qa;
  insert into _t values ('G3 someone moved down from admin gets the employee starting grid',
        (select page_access from public.app_users where id = qa) = public.default_page_levels('team_member'),
        (select page_access::text from public.app_users where id = qa));
  update public.app_users set page_access = '{}'::jsonb where id = emp;
  insert into _t values ('G4 taking every page away is kept (defaults do not come back)',
        (select page_access from public.app_users where id = emp) = '{}'::jsonb,
        (select page_access::text from public.app_users where id = emp));
  -- a brand-new sign-up (never committed: the whole transaction is thrown away)
  insert into auth.users(id, email, aud, role) values ('00000000-0000-4000-8000-0000000001a0', 'phase1a-probe@example.invalid', 'authenticated', 'authenticated');
  insert into _t values ('G5 a new person gets a starting grid',
        (select page_access is not null and page_access <> '{}'::jsonb from public.app_users where id = '00000000-0000-4000-8000-0000000001a0'),
        (select role::text || ' ' || coalesce(page_access::text, 'null') from public.app_users where id = '00000000-0000-4000-8000-0000000001a0'));

  ---------------------------------------------------------------- switched off, and nobody signed in
  -- G6 (Phase 1b part D): Team → Add creates the login first (sign-up grid) and sets the role SECOND
  insert into public.app_users(id, email, full_name, role, active, must_change_password)
    values ('00000000-0000-4000-8000-0000000001a0', 'phase1a-probe@example.invalid', 'Probe', 'team_member', true, false)
    on conflict (id) do update set role = excluded.role, active = excluded.active;
  insert into _t values ('G6 a person added through Team → Add as an employee gets the employee starting grid',
        (select page_access from public.app_users where id = '00000000-0000-4000-8000-0000000001a0') = public.default_page_levels('team_member'),
        (select page_access::text from public.app_users where id = '00000000-0000-4000-8000-0000000001a0'));
  update public.app_users set active = false, page_access = public.default_page_levels('team_member') where id = qa;
  insert into _t values ('X1 a switched-off account has no access', public.page_level('leads') = 'none', public.page_level('leads'));
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  insert into _t values ('X2 signed out: Finance is none', public.page_level('finance') = 'none', public.page_level('finance'));
  set local role anon;
  begin
    perform public.set_page_levels(emp, '{"finance":"full"}'::jsonb);
    insert into _t values ('X3 signed out cannot call the setter', false, 'accepted');
  exception when others then insert into _t values ('X3 signed out cannot call the setter', sqlstate = '42501', sqlerrm); end;
  reset role;

  select count(*) filter (where _t.ok), count(*) filter (where _t.ok is not true) into pass, fail from _t;
  select coalesce(string_agg(format(' [FAIL %s: %s]', _t.name, left(coalesce(_t.got,''), 120)), '' order by _t.name), '')
    into msg from _t where _t.ok is not true;
  raise exception 'ACCESS-ATTACKS sabotage=% pass=% fail=% %', sabotage, pass, fail, msg;
end $$;
