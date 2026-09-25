-- Phase 1b, part B — attack tests for the workspace blob's per-section check. Same shape as the
-- other access-levels-attacks files: one transaction, always thrown away; the QA account plays each
-- person; saves run under the `authenticated` role. Sabotage: set `sabotage` true (page_level → full).
begin;
do $$
declare
  sabotage boolean := false;
  qa uuid; n int; before jsonb; after jsonb; logs0 int; logs1 int; logs2 int;
  pass int := 0; fail int := 0; msg text := '';
begin
  select id into qa from public.app_users where email = 'test@directksa.com';
  if sabotage then
    execute $f$create or replace function public.page_level(p text) returns text language sql stable
               security definer set search_path to 'public' as $b$ select 'full'::text $b$ $f$;
  end if;
  create temp table _t(name text, ok boolean, got text) on commit drop;
  grant all on pg_temp._t to authenticated, anon;
  select data into before from public.app_state where id = 1;
  perform set_config('request.jwt.claims', json_build_object('sub', qa, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', qa::text, true);

  -- an EMPLOYEE: tries to overwrite the airline register, the company's bank details and settings,
  -- in the same save as their own recents
  update public.app_users set role = 'team_member', page_access = public.default_page_levels('team_member') where id = qa;
  set local role authenticated;
  select count(*) into logs0 from public.record_history where actor = qa and action = 'sections_kept';
  perform public.save_state_patch(jsonb_build_object('airlines','[]'::jsonb,'agency',jsonb_build_object('iban','XX-PROBE'),'settings',jsonb_build_object('probe',true),'recents',jsonb_build_array('phase1b-probe')));
  reset role;
  select data into after from public.app_state where id = 1;
  insert into _t values ('B1 employee cannot empty the airline register through a patch', after->'airlines' = before->'airlines', jsonb_array_length(coalesce(after->'airlines','[]'))::text);
  insert into _t values ('B2 employee cannot change the company''s bank details', after->'agency' = before->'agency', left((after->'agency')::text, 60));
  insert into _t values ('B3 employee cannot change settings', after->'settings' = before->'settings', null);
  insert into _t values ('B4 control: the same save DID keep the employee''s own recents', after->'recents' = jsonb_build_array('phase1b-probe'), left((after->'recents')::text, 60));
  select count(*) into logs1 from public.record_history where actor = qa and action = 'sections_kept';
  insert into _t values ('B5 the held-back sections are in the history log, once', logs1 = logs0 + 1, (logs1 - logs0)::text);
  set local role authenticated;
  perform public.save_state_patch(jsonb_build_object('airlines','[]'::jsonb,'agency',jsonb_build_object('iban','XX-PROBE'),'settings',jsonb_build_object('probe',true)));
  reset role;
  select count(*) into logs2 from public.record_history where actor = qa and action = 'sections_kept';
  insert into _t values ('B6 …and the same attempt again the same day is not logged twice', logs2 = logs1, (logs2 - logs1)::text);

  -- the whole-blob fallback (save_state) must not be the way round: an employee sends a blob with
  -- NO airlines, vendors or agency at all
  set local role authenticated;
  perform public.save_state((before - 'airlines' - 'vendors' - 'agency') || jsonb_build_object('recents', jsonb_build_array('phase1b-full')));
  reset role;
  select data into after from public.app_state where id = 1;
  insert into _t values ('B7 the whole-blob save cannot delete the airline register', after->'airlines' = before->'airlines', null);
  insert into _t values ('B8 …nor Suppliers, nor the bank details', after->'vendors' = before->'vendors' and after->'agency' = before->'agency', null);
  insert into _t values ('B9 control: the whole-blob save still wrote the employee''s recents', after->'recents' = jsonb_build_array('phase1b-full'), null);
  insert into _t values ('B10 leads never go through the blob (unchanged rule)', after->'businesses' is not distinct from before->'businesses', null);

  -- the MANAGER: full on Airlines and Settings, no Suppliers / SOP page
  update public.app_users set role = 'manager', page_access = public.default_page_levels('manager') where id = qa;
  set local role authenticated;
  perform public.save_state_patch(jsonb_build_object('airlines', jsonb_build_array(jsonb_build_object('probe','m')), 'vendors','[]'::jsonb, 'sops','[]'::jsonb));
  reset role;
  select data into after from public.app_state where id = 1;
  insert into _t values ('M1 the manager changes the airline register (full on Airlines)', after->'airlines' = jsonb_build_array(jsonb_build_object('probe','m')), null);
  insert into _t values ('M2 the manager cannot empty Suppliers or SOPs (no page)', after->'vendors' = before->'vendors' and after->'sops' = before->'sops', null);

  -- VIEW on Airlines is view: nothing changes
  update public.app_users set role = 'team_member', page_access = '{"today":"full","airlines":"view"}'::jsonb where id = qa;
  set local role authenticated;
  perform public.save_state_patch(jsonb_build_object('airlines','[]'::jsonb));
  reset role;
  select data into after from public.app_state where id = 1;
  insert into _t values ('V1 view on Airlines cannot change the register', jsonb_array_length(after->'airlines') = 1, null);

  -- a section nobody mapped is the admins' only
  update public.app_users set role = 'manager', page_access = public.default_page_levels('manager') where id = qa;
  set local role authenticated;
  perform public.save_state_patch(jsonb_build_object('phase1bUnmapped', true));
  reset role;
  insert into _t values ('X1 a section nobody mapped cannot be created by a non-admin', not ((select data from public.app_state where id = 1) ? 'phase1bUnmapped'), null);

  select count(*) filter (where _t.ok), count(*) filter (where _t.ok is not true) into pass, fail from _t;
  select coalesce(string_agg(format(' [FAIL %s: %s]', _t.name, left(coalesce(_t.got,''), 80)), '' order by _t.name), '') into msg from _t where _t.ok is not true;
  raise exception 'ACCESS-1B-BLOB sabotage=% pass=% fail=% %', sabotage, pass, fail, msg;
end $$;
