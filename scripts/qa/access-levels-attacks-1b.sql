-- Phase 1b, part A — database attack tests: writes follow the page level. 2026-09-25.
-- Same shape as access-levels-attacks.sql: one transaction that ALWAYS ends in an exception, so
-- nothing is kept; the QA account plays an employee and then the manager inside it, and every
-- attack is made under the `authenticated` database role so the real row rules apply.
-- Sabotage: set `sabotage` true — page_level() then answers 'full' for everyone, and the attacks
-- that depend on the level must fail.
begin;
do $$
declare
  sabotage boolean := false;
  qa uuid; ev uuid; pc uuid; ft uuid; n int; bak bigint; txt text;
  pass int := 0; fail int := 0; msg text := '';
begin
  select id into qa from public.app_users where email = 'test@directksa.com';
  select id into ev from public.ksa_events order by id limit 1;
  select id into pc from public.promo_codes order by id limit 1;
  select id into ft from public.finance_transactions order by id limit 1;
  if qa is null or ev is null or pc is null or ft is null then
    raise exception 'ACCESS-1B cannot run: a fixture is missing (qa %, event %, promo %, transaction %)', qa is not null, ev is not null, pc is not null, ft is not null;
  end if;
  if sabotage then
    execute $f$create or replace function public.page_level(p text) returns text language sql stable
               security definer set search_path to 'public' as $b$ select 'full'::text $b$ $f$;
  end if;
  create temp table _t(name text, ok boolean, got text) on commit drop;
  grant all on pg_temp._t to authenticated, anon;
  perform set_config('request.jwt.claims', json_build_object('sub', qa, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', qa::text, true);

  ---------------------------------------------------------------- an EMPLOYEE (Today, Leads, Clients, Finance)
  update public.app_users set role = 'team_member', page_access = public.default_page_levels('team_member') where id = qa;
  set local role authenticated;
  begin insert into public.app_offers(id, data) values ('probe-1b-o', '{}');
    insert into _t values ('E1 employee cannot write a proposal (no Proposals page)', false, 'accepted');
  exception when others then insert into _t values ('E1 employee cannot write a proposal (no Proposals page)', sqlstate = '42501', sqlerrm); end;
  begin insert into public.app_requests(id, data) values ('probe-1b-r', '{}');
    insert into _t values ('E2 employee cannot write an operations request', false, 'accepted');
  exception when others then insert into _t values ('E2 employee cannot write an operations request', sqlstate = '42501', sqlerrm); end;
  begin insert into public.app_projects(id, data) values ('probe-1b-p', '{}');
    insert into _t values ('E3 employee cannot write a project', false, 'accepted');
  exception when others then insert into _t values ('E3 employee cannot write a project', sqlstate = '42501', sqlerrm); end;
  begin txt := public.next_document_number('PRB');
    insert into _t values ('E4 employee cannot take a document number', false, txt);
  exception when others then insert into _t values ('E4 employee cannot take a document number', sqlstate = '42501', sqlerrm); end;
  update public.ksa_events set id = id where id = ev; get diagnostics n = row_count;
  insert into _t values ('E5 employee cannot change an event (no Events page)', n = 0, n::text);
  update public.promo_codes set id = id where id = pc; get diagnostics n = row_count;
  insert into _t values ('E6 control: employee (full on Finance) still changes a promo code', n = 1, n::text);
  update public.finance_transactions set id = id where id = ft; get diagnostics n = row_count;
  insert into _t values ('E7 employee still cannot change a transaction (role floor kept — nobody gains)', n = 0, n::text);
  insert into public.app_state_bak(data, note) values ('{}', 'phase1b probe') returning bak_id into bak;
  insert into _t values ('E8 employee can still add a backup (the one-time upload keeps working)', bak is not null, bak::text);
  insert into _t values ('E9 …and read it back, which that upload checks', (select count(*) from public.app_state_bak where bak_id = bak) = 1, null);
  delete from public.app_state_bak where bak_id = bak; get diagnostics n = row_count;
  insert into _t values ('E10 employee cannot delete a backup (no Settings page)', n = 0, n::text);
  begin insert into storage.objects(bucket_id, name) values ('company-docs', 'phase1b-probe/e.txt');
    insert into _t values ('E11 employee cannot upload a company document', false, 'accepted');
  exception when others then insert into _t values ('E11 employee cannot upload a company document', sqlstate = '42501', sqlerrm); end;
  begin insert into storage.objects(bucket_id, name) values ('expenses', 'phase1b-probe/e.txt');
    insert into _t values ('E12 control: employee (full on Finance) can still upload an expense receipt', true, null);
  exception when others then insert into _t values ('E12 control: employee (full on Finance) can still upload an expense receipt', false, sqlerrm); end;
  reset role;

  ---------------------------------------------------------------- VIEW on Finance
  update public.app_users set page_access = '{"today":"full","finance":"view"}'::jsonb where id = qa;
  set local role authenticated;
  update public.promo_codes set id = id where id = pc; get diagnostics n = row_count;
  insert into _t values ('V1 view on Finance cannot change a promo code', n = 0, n::text);
  begin insert into storage.objects(bucket_id, name) values ('payment-proofs', 'phase1b-probe/v.txt');
    insert into _t values ('V2 view on Finance cannot upload a payment proof', false, 'accepted');
  exception when others then insert into _t values ('V2 view on Finance cannot upload a payment proof', sqlstate = '42501', sqlerrm); end;
  reset role;

  ---------------------------------------------------------------- the MANAGER (starting grid, now with the Generator)
  update public.app_users set role = 'manager', page_access = public.default_page_levels('manager') where id = qa;
  set local role authenticated;
  begin txt := public.next_document_number('PRB');
    insert into _t values ('M1 manager takes a document number (full on the Generator)', txt like 'PRB-%', txt);
  exception when others then insert into _t values ('M1 manager takes a document number (full on the Generator)', false, sqlerrm); end;
  update public.ksa_events set id = id where id = ev; get diagnostics n = row_count;
  insert into _t values ('M2 manager changes an event (full on Events)', n = 1, n::text);
  begin insert into public.app_offers(id, data) values ('probe-1b-o', '{}');
    insert into _t values ('M3 manager writes a proposal (full on Proposals)', true, null);
  exception when others then insert into _t values ('M3 manager writes a proposal (full on Proposals)', false, sqlerrm); end;
  begin insert into public.app_requests(id, data) values ('probe-1b-r', '{}');
    insert into _t values ('M4 manager cannot write an operations request (no Operations page)', false, 'accepted');
  exception when others then insert into _t values ('M4 manager cannot write an operations request (no Operations page)', sqlstate = '42501', sqlerrm); end;
  update public.finance_transactions set id = id where id = ft; get diagnostics n = row_count;
  insert into _t values ('M5 manager changes a transaction (full on Finance, role allowed before too)', n = 1, n::text);
  insert into public.app_state_bak(data, note) values ('{}', 'phase1b probe') returning bak_id into bak;
  delete from public.app_state_bak where bak_id = bak; get diagnostics n = row_count;
  insert into _t values ('M6 manager deletes a backup (full on Settings)', n = 1, n::text);
  begin insert into storage.objects(bucket_id, name) values ('company-docs', 'phase1b-probe/m.txt');
    insert into _t values ('M7 manager uploads a company document', true, null);
  exception when others then insert into _t values ('M7 manager uploads a company document', false, sqlerrm); end;
  reset role;

  ---------------------------------------------------------------- a signed-up account nobody approved
  update public.app_users set role = 'viewer', active = false, page_access = '{"today":"view"}'::jsonb where id = qa;
  set local role authenticated;
  insert into _t values ('U1 an unapproved account reads no events (was: every event)', (select count(*) from public.ksa_events) = 0, (select count(*) from public.ksa_events)::text);
  update public.ksa_events set id = id where id = ev; get diagnostics n = row_count;
  insert into _t values ('U2 …and changes none (was: could change any)', n = 0, n::text);
  reset role;

  select count(*) filter (where _t.ok), count(*) filter (where _t.ok is not true) into pass, fail from _t;
  select coalesce(string_agg(format(' [FAIL %s: %s]', _t.name, left(coalesce(_t.got,''), 120)), '' order by _t.name), '')
    into msg from _t where _t.ok is not true;
  raise exception 'ACCESS-1B sabotage=% pass=% fail=% %', sabotage, pass, fail, msg;
end $$;
