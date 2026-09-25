-- Phase 1b, part E — attack tests: Leads and Clients at "own work". One transaction, always thrown away.
-- The QA account is put on Own work for Leads; a lead is handed to it INSIDE the transaction (its
-- assigned_to set to the QA account's name, owner_id then follows by trigger). Sabotage: `sabotage`
-- true makes can_write_company answer true for everyone.
begin;
do $$
declare
  sabotage boolean := false;
  qa uuid; qa_name text; mine uuid; theirs uuid; their_name text; cont uuid; n int; r text;
  pass int; fail int; msg text;
begin
  select id, full_name into qa, qa_name from public.app_users where email = 'test@directksa.com';
  select id into mine from public.businesses where not is_client and archived_at is null and owner_id is not null order by id limit 1;
  select b.id, b.assigned_to into theirs, their_name from public.businesses b where not b.is_client and b.archived_at is null and b.owner_id is not null and b.id <> mine
     order by exists(select 1 from public.contacts c where c.business_id = b.id) desc, b.id limit 1;   -- one with a contact, so O7 runs
  select c.id into cont from public.contacts c where c.business_id = theirs limit 1;
  if sabotage then
    execute $f$create or replace function public.can_write_company(p_is_client boolean, p_owner uuid) returns boolean language sql stable security definer set search_path to 'public' as $b$ select true $b$ $f$;
  end if;
  create temp table _t(name text, ok boolean, got text) on commit drop;
  grant all on pg_temp._t to authenticated, anon;
  update public.businesses set assigned_to = qa_name where id = mine;          -- hand one lead to the QA account
  insert into _t values ('W0 the database worked out the owner account from the name', (select owner_id from public.businesses where id = mine) = qa, null);
  perform set_config('request.jwt.claims', json_build_object('sub', qa, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', qa::text, true);
  update public.app_users set role = 'team_member', page_access = '{"today":"full","leads":"own","clients":"view"}'::jsonb where id = qa;
  set local role authenticated;
  update public.businesses set notes = coalesce(notes,'') where id = mine; get diagnostics n = row_count;
  insert into _t values ('O1 own: changes their own lead', n = 1, n::text);
  update public.businesses set notes = coalesce(notes,'') where id = theirs; get diagnostics n = row_count;
  insert into _t values ('O2 own: cannot change somebody else''s lead', n = 0, n::text);
  begin update public.businesses set assigned_to = their_name where id = mine;
    insert into _t values ('O3 own: cannot hand their lead to somebody else', false, 'accepted');
  exception when others then insert into _t values ('O3 own: cannot hand their lead to somebody else', sqlstate = '42501', sqlerrm); end;
  begin update public.businesses set owner_id = qa where id = theirs; get diagnostics n = row_count;
    insert into _t values ('O4 own: cannot claim somebody else''s lead by writing an id', n = 0, n::text);
  exception when others then insert into _t values ('O4 own: cannot claim somebody else''s lead by writing an id', true, sqlerrm); end;
  begin insert into public.businesses(name, assigned_to, is_client, stage) values ('Phase1b probe lead '||gen_random_uuid(), their_name, false, 'new');
    insert into _t values ('O5 own: cannot create a lead for somebody else', false, 'accepted');
  exception when others then insert into _t values ('O5 own: cannot create a lead for somebody else', sqlstate = '42501', sqlerrm); end;
  begin insert into public.businesses(name, assigned_to, is_client, stage) values ('Phase1b probe lead '||gen_random_uuid(), qa_name, false, 'new');
    insert into _t values ('O6 control: own: creates a lead of their own', true, null);
  exception when others then insert into _t values ('O6 control: own: creates a lead of their own', false, sqlerrm); end;
  if cont is not null then
    update public.contacts set name = name where id = cont; get diagnostics n = row_count;
    insert into _t values ('O7 own: cannot change a contact of somebody else''s lead', n = 0, n::text);
  else
    insert into _t values ('O7 NOT EXERCISED — no lead with a contact to attack', false, null);
  end if;
  insert into _t values ('O8 own: still READS every lead', (select count(*) from public.businesses where not is_client) > 1, null);
  update public.businesses set notes = coalesce(notes,'') where is_client and archived_at is null; get diagnostics n = row_count;
  insert into _t values ('V1 view on Clients: changes no client', n = 0, n::text);
  reset role;
  update public.app_users set page_access = '{"today":"full","leads":"full","clients":"full"}'::jsonb where id = qa;
  set local role authenticated;
  update public.businesses set notes = coalesce(notes,'') where id = theirs; get diagnostics n = row_count;
  insert into _t values ('F1 full on Leads: changes anybody''s lead', n = 1, n::text);
  reset role;
  select count(*) filter (where _t.ok), count(*) filter (where _t.ok is not true) into pass, fail from _t;
  select coalesce(string_agg(format(' [FAIL %s: %s]', _t.name, left(coalesce(_t.got,''), 90)), '' order by _t.name), '') into msg from _t where _t.ok is not true;
  raise exception 'ACCESS-1B-OWN sabotage=% pass=% fail=% %', sabotage, pass, fail, msg;
end $$;
