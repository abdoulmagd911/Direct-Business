-- Phase 1b, part C — attack tests: Undo asks the record's page. One transaction, always thrown away.
-- History rows are PLANTED inside it (a no-op change to a real lead and a real client, "made" by the
-- QA account a minute ago), so the undo writes back exactly what is there. Sabotage: `sabotage` true.
begin;
do $$
declare
  sabotage boolean := false;
  qa uuid; lead_id uuid; client_id uuid; hl bigint; hc bigint; ha bigint; r text;
  pass int; fail int; msg text;
begin
  select id into qa from public.app_users where email = 'test@directksa.com';
  select id into lead_id from public.businesses where not is_client and archived_at is null order by id limit 1;
  select id into client_id from public.businesses where is_client and archived_at is null order by id limit 1;
  if sabotage then
    execute $f$create or replace function public.page_level(p text) returns text language sql stable security definer set search_path to 'public' as $b$ select 'full'::text $b$ $f$;
  end if;
  create temp table _t(name text, ok boolean, got text) on commit drop;
  grant all on pg_temp._t to authenticated, anon;
  insert into public.record_history(at, actor, actor_name, table_name, record_id, action, before_row, after_row)
    select now() - interval '1 minute', qa, 'QA', 'businesses', b.id, 'edit', to_jsonb(b), to_jsonb(b) from public.businesses b where b.id = lead_id returning id into hl;
  insert into public.record_history(at, actor, actor_name, table_name, record_id, action, before_row, after_row)
    select now() - interval '1 minute', qa, 'QA', 'businesses', b.id, 'edit', to_jsonb(b), to_jsonb(b) from public.businesses b where b.id = client_id returning id into hc;
  insert into public.record_history(at, actor, actor_name, table_name, record_id, action, before_row, after_row)
    values (now() - interval '1 minute', qa, 'QA', 'access', qa, 'levels_changed', '{"levels":{}}', '{"levels":{}}') returning id into ha;
  perform set_config('request.jwt.claims', json_build_object('sub', qa, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', qa::text, true);

  -- an employee who may only VIEW Leads cannot undo a change on a lead
  update public.app_users set role = 'team_member', page_access = '{"today":"full","leads":"view","clients":"full"}'::jsonb where id = qa;
  set local role authenticated;
  r := public.undo_change(hl);
  insert into _t values ('U1 view on Leads: undo on a lead is refused, in words', r like 'Undoing this needs full control of the Leads page%', r);
  -- …but may undo their own change on a client (full on Clients)
  r := public.undo_change(hc);
  insert into _t values ('U2 control: full on Clients: undo on a client goes through', r = 'ok', r);
  -- a page-access change is not something Undo can put back
  r := public.undo_change(ha);
  insert into _t values ('U3 an access change is refused in words, not an internal error', r = 'This kind of change cannot be undone here.', r);
  reset role;

  -- full on Leads: the lead undo now goes through
  update public.app_users set page_access = '{"today":"full","leads":"full"}'::jsonb where id = qa;
  set local role authenticated;
  r := public.undo_change(hl);
  insert into _t values ('U4 full on Leads: undo on a lead goes through', r = 'ok', r);
  reset role;

  select count(*) filter (where _t.ok), count(*) filter (where _t.ok is not true) into pass, fail from _t;
  select coalesce(string_agg(format(' [FAIL %s: %s]', _t.name, left(coalesce(_t.got,''), 90)), '' order by _t.name), '') into msg from _t where _t.ok is not true;
  raise exception 'ACCESS-1B-UNDO sabotage=% pass=% fail=% %', sabotage, pass, fail, msg;
end $$;
