-- merge-rollback-tests.sql — behaviour tests for fn_merge_businesses / fn_unmerge_businesses
-- that run against the LIVE database and change NOTHING: each block creates two throwaway
-- companies, exercises the functions, and ends by RAISING its verdict, which rolls the whole
-- block back. Run one block at a time (e.g. through the Supabase SQL editor or the execute_sql
-- tool) and read the verdict out of the error message. Written 2026-09-02 (attack rounds 2–3).
--
-- Expected verdicts are in the comment above each block. A different verdict = a regression.

-- ---------------------------------------------------------------------------------------------
-- T1 — Undo keeps an edit made on the kept company AFTER the merge; un-fills only what the
--      merge filled.  Expected: "kept.payment_terms=Net 60 (edited after merge) | cr_vat=(null)"
-- ---------------------------------------------------------------------------------------------
do $$
declare k uuid := gen_random_uuid(); d uuid := gen_random_uuid(); r jsonb; mid uuid; v text;
begin
  insert into businesses(id,name,stage,is_client,payment_terms) values (k,'ZZ-probe-keep','won',true,null);
  insert into businesses(id,name,stage,is_client,payment_terms,cr_vat) values (d,'ZZ-probe-drop','won',true,'Net 30','VAT 000');
  r := public.fn_merge_businesses(k,d,'probe',false); mid := (r->>'merge_id')::uuid;
  update businesses set payment_terms='Net 60 (edited after merge)' where id=k;
  perform public.fn_unmerge_businesses(mid);
  select payment_terms || ' | cr_vat=' || coalesce(cr_vat,'(null)') into v from businesses where id=k;
  raise exception 'VERDICT T1 after undo: kept.payment_terms=%', v;
end $$;

-- ---------------------------------------------------------------------------------------------
-- T2 — A lead absorbing a client becomes a client on both flags, stage won, converted date
--      carried; undo reverses exactly that.
--      Expected: "after merge: is_client=true raw.isClient=true stage=won converted=2026-05-01
--                 || after undo: is_client=false raw.isClient=false stage=new converted=(null)"
-- ---------------------------------------------------------------------------------------------
do $$
declare k uuid := gen_random_uuid(); d uuid := gen_random_uuid(); r jsonb; mid uuid; v1 text; v2 text;
begin
  insert into businesses(id,name,stage,is_client,raw) values (k,'ZZ-probe-lead','new',false,'{}'::jsonb);
  insert into businesses(id,name,stage,is_client,converted_date,raw) values (d,'ZZ-probe-client','won',true,date '2026-05-01','{"isClient":"true"}'::jsonb);
  r := public.fn_merge_businesses(k,d,'probe',false); mid := (r->>'merge_id')::uuid;
  select 'after merge: is_client='||is_client||' raw.isClient='||coalesce(raw->>'isClient','(null)')||' stage='||stage||' converted='||coalesce(converted_date::text,'(null)') into v1 from businesses where id=k;
  perform public.fn_unmerge_businesses(mid);
  select 'after undo: is_client='||is_client||' raw.isClient='||coalesce(raw->>'isClient','(null)')||' stage='||stage||' converted='||coalesce(converted_date::text,'(null)') into v2 from businesses where id=k;
  raise exception 'VERDICT T2 % || %', v1, v2;
end $$;

-- ---------------------------------------------------------------------------------------------
-- T3 — Two open postpaid profiles: the moved one is closed with a note and reopened on undo.
--      Expected: "after merge: open_postpaid=1 closed_note=yes || after undo: open_postpaid=1
--                 dropped_open=1 note_restored=yes"
-- ---------------------------------------------------------------------------------------------
do $$
declare k uuid := gen_random_uuid(); d uuid := gen_random_uuid(); r jsonb; mid uuid; v1 text; v2 text; pk uuid := gen_random_uuid(); pd uuid := gen_random_uuid();
begin
  insert into businesses(id,name,stage,is_client) values (k,'ZZ-probe-keep','won',true),(d,'ZZ-probe-drop','won',true);
  insert into client_profiles(id,business_id,direct_client_id,profile_type,status,opened_at,notes) values (pk,k,'ZZ-9001','postpaid','active',current_date,null),(pd,d,'ZZ-9002','postpaid','active',current_date,'original note');
  r := public.fn_merge_businesses(k,d,'probe',false); mid := (r->>'merge_id')::uuid;
  select 'after merge: open_postpaid='||(select count(*) from client_profiles where business_id=k and profile_type='postpaid' and closed_at is null)||' closed_note='||(case when (select notes from client_profiles where id=pd) ilike '%merg%' then 'yes' else 'no' end) into v1;
  perform public.fn_unmerge_businesses(mid);
  select 'after undo: open_postpaid='||(select count(*) from client_profiles where business_id=k and profile_type='postpaid' and closed_at is null)||' dropped_open='||(select count(*) from client_profiles where business_id=d and closed_at is null)||' note_restored='||(case when (select notes from client_profiles where id=pd)='original note' then 'yes' else 'no' end) into v2;
  raise exception 'VERDICT T3 % || %', v1, v2;
end $$;
