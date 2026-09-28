-- phase3-rollback-tests.sql — the task manager, achievements + proofs, KPI targets and the company card, exercised
-- AGAINST THE LIVE DATABASE as real people, changing NOTHING. Written 2026-09-27 (bulletproof audit).
--
-- How it cannot write: each block is one DO statement that ends by RAISING its verdict, which rolls the whole block
-- back — the rows, the history lines, the storage rows, and the task/report number counters (document_counters is an
-- ordinary table, not a sequence, so an undone number is really undone; checked before this file was written).
-- Before and after a run, read the fingerprint at the bottom: every count must be the same.
--
-- Who it acts as: real accounts by id only (no passwords, no new accounts). `pg_temp.run(uid, sql)` signs in as that
-- person the way PostgREST does (request.jwt.claims + role authenticated), runs one statement, and reports
-- 'ok rows=N val=…' or 'ERR <the database's words>'. A View-level colleague is made by changing one team member's
-- page_access INSIDE the block — rolled back with everything else.
--   :T  = the first active team member ON THE TEAM LIST (by id). Not 72ac82c2…: that login is the owner's
--         Team-Member test view (D8), deliberately not on the team list, so it can own no task — the Tasks page says so.
--   :M  = the manager                                    06bb5086-9c8c-4a1b-9452-eb0b14c24fa9
--   :A  = the QA admin account (for setup steps only)    096eec1a-6d2c-4be4-a5f9-19e920062e7c
-- Run each block through the execute_sql tool (or the SQL editor) and read the verdict out of the error message.
-- Every item in a verdict is `name=PASS` or `name=FAIL(<what happened>)`; a FAIL anywhere is a regression.

-- ---------------------------------------------------------------------------------------------------------------
-- helpers — create once per session (temp schema; gone when the connection closes)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function pg_temp.run(u uuid, q text) returns text language plpgsql as $f$
declare v text; n bigint;
begin
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    if q ~* '^\s*(select|with)' or q ~* '\mreturning\M' then execute q into v; else execute q; end if;
    get diagnostics n = row_count;
    execute 'reset role';
    return 'ok rows='||n||coalesce(' val='||v,'');
  exception when others then
    execute 'reset role';
    return 'ERR '||left(sqlerrm,160);
  end;
end $f$;
create or replace function pg_temp.chk(name text, cond boolean, got text) returns text language sql as $f$
  select name || case when coalesce(cond,false) then '=PASS' else '=FAIL('||coalesce(got,'null')||')' end
$f$;

-- ---------------------------------------------------------------------------------------------------------------
-- L1 — tasks: create, number, refuse client work without a company, status log, checklist, comment, View is view,
--      no hard delete, a manager's change reaches the owner, the owner undoes it (D7), done → achievement
-- ---------------------------------------------------------------------------------------------------------------
do $$
declare T uuid; M uuid := '06bb5086-9c8c-4a1b-9452-eb0b14c24fa9';
        A uuid := '096eec1a-6d2c-4be4-a5f9-19e920062e7c'; V uuid; tm uuid; td uuid; tid uuid; r text; out text[] := '{}';
        h bigint; cat uuid; n int;
begin
  perform set_config('request.jwt.claims', json_build_object('sub',A,'role','authenticated')::text, true);
  select u.id into T from app_users u join team_members m on m.user_id=u.id and m.active where u.role='team_member' and u.active order by u.id limit 1;
  select id, department_id into tm, td from team_members where user_id=T and active;
  select u.id into V from app_users u join team_members m on m.user_id=u.id and m.active where u.role='team_member' and u.active and u.id<>T limit 1;
  update app_users set page_access = coalesce(page_access,'{}'::jsonb) || '{"tasks":"view","reports":"view","clients":"view","leads":"view"}' where id=V;
  select id into cat from report_categories order by 1 limit 1;

  r := pg_temp.run(T, format($q$insert into tasks(title,owner_id,department_id,work_type) values ('QA-TEST audit task',%L,%L,'internal') returning id::text||'|'||coalesce(code,'')$q$, tm, td));
  out := out || pg_temp.chk('create_internal_task', r ~ 'val=[0-9a-f-]+\|TSK-\d{4}-\d{3}$', r);
  tid := nullif(split_part(split_part(r,'val=',2),'|',1),'')::uuid;
  r := pg_temp.run(T, format($q$insert into tasks(title,owner_id,department_id,work_type) values ('QA-TEST client work',%L,%L,'sales')$q$, tm, td));
  out := out || pg_temp.chk('client_work_needs_company', r ~* 'ERR.*compan', r);
  r := pg_temp.run(T, format($q$update tasks set status='in_progress' where id=%L$q$, tid));
  select count(*) into n from task_status_log where task_id=tid;
  out := out || pg_temp.chk('status_change_logged', r='ok rows=1' and n>=1, r||' log='||n);
  r := pg_temp.run(T, format($q$insert into task_checklist(task_id,text) values (%L,'QA step') returning id::text$q$, tid));
  out := out || pg_temp.chk('checklist_add', r ~ '^ok rows=1', r);
  r := pg_temp.run(T, format($q$update task_checklist set is_done=true, done_at=now() where task_id=%L$q$, tid));   -- as js/108 v108Tick sends it
  out := out || pg_temp.chk('checklist_tick', r='ok rows=1', r);
  r := pg_temp.run(T, format($q$insert into task_comments(task_id,author_id,body) values (%L,%L,'QA update')$q$, tid, tm));
  out := out || pg_temp.chk('comment_add', r='ok rows=1', r);
  r := pg_temp.run(V, format($q$select count(*)::text from tasks where id=%L$q$, tid));
  out := out || pg_temp.chk('view_sees_task', r='ok rows=1 val=1', r);
  r := pg_temp.run(V, format($q$update tasks set title='hijack' where id=%L$q$, tid));
  out := out || pg_temp.chk('view_cannot_edit', r='ok rows=0' or r ~ '^ERR', r);
  r := pg_temp.run(V, format($q$insert into tasks(title,owner_id,department_id,work_type) values ('QA view',%L,%L,'internal')$q$, tm, td));
  out := out || pg_temp.chk('view_cannot_create', r ~ '^ERR', r);
  r := pg_temp.run(T, format($q$delete from tasks where id=%L$q$, tid));
  out := out || pg_temp.chk('no_hard_delete', (r='ok rows=0' or r ~ '^ERR') and exists(select 1 from tasks where id=tid), r);
  r := pg_temp.run(M, format($q$update tasks set title='QA-TEST renamed by manager' where id=%L$q$, tid));
  out := out || pg_temp.chk('manager_edits_colleague_task', r='ok rows=1', r);
  r := pg_temp.run(T, $q$select count(*)::text from changes_to_my_tasks(7) c where c::text ilike '%renamed by manager%'$q$);
  out := out || pg_temp.chk('owner_told_of_change', r ~ 'val=[1-9]', r);
  select id into h from record_history where table_name='tasks' and record_id=tid and after_row->>'title'='QA-TEST renamed by manager' order by id desc limit 1;
  r := pg_temp.run(T, format('select undo_change(%s)', h));
  out := out || pg_temp.chk('owner_undoes_manager_change_D7', r='ok rows=1 val=ok' and (select title from tasks where id=tid)='QA-TEST audit task', r);
  r := pg_temp.run(T, format($q$update tasks set include_in_report=true, report_category_id=%L, status='done' where id=%L$q$, cat, tid));
  select count(*) into n from report_entries where source='task' and source_id=tid and section='achievement';
  out := out || pg_temp.chk('done_registers_achievement', r='ok rows=1' and n=1, r||' entries='||n);
  raise exception 'VERDICT L1 %', array_to_string(out, ' · ');
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- L2 — achievements and proofs: your own line, not a colleague's; a proof on an open month; finalize stamps who;
--      a View colleague cannot finalize; once the month is issued its proofs and lines are frozen
-- ---------------------------------------------------------------------------------------------------------------
do $$
declare T uuid; M uuid := '06bb5086-9c8c-4a1b-9452-eb0b14c24fa9';
        A uuid := '096eec1a-6d2c-4be4-a5f9-19e920062e7c'; V uuid; tm uuid; td uuid; vm uuid; per uuid; cat uuid; e uuid; r text; out text[] := '{}';
begin
  perform set_config('request.jwt.claims', json_build_object('sub',A,'role','authenticated')::text, true);
  select u.id into T from app_users u join team_members m on m.user_id=u.id and m.active where u.role='team_member' and u.active order by u.id limit 1;
  select id, department_id into tm, td from team_members where user_id=T and active;
  select u.id, m.id into V, vm from app_users u join team_members m on m.user_id=u.id and m.active where u.role='team_member' and u.active and u.id<>T limit 1;
  update app_users set page_access = coalesce(page_access,'{}'::jsonb) || '{"reports":"view","tasks":"view"}' where id=V;
  select id into per from periods where kind='month' and current_date between start_date and end_date;
  select id into cat from report_categories order by 1 limit 1;

  r := pg_temp.run(T, format($q$insert into report_entries(period_id,department_id,member_id,section,category_id,title,status) values (%L,%L,%L,'achievement',%L,'QA-TEST achievement','draft') returning id::text$q$, per, td, tm, cat));
  out := out || pg_temp.chk('own_achievement', r ~ '^ok rows=1', r);
  e := nullif(split_part(r,'val=',2),'')::uuid;
  r := pg_temp.run(T, format($q$insert into report_entries(period_id,department_id,member_id,section,category_id,title,status) values (%L,%L,%L,'achievement',%L,'QA credit colleague','draft')$q$, per, td, vm, cat));
  out := out || pg_temp.chk('cannot_credit_colleague', r ~* 'ERR.*(manager|head)', r);
  r := pg_temp.run(T, format($q$insert into evidence_files(entry_id,storage_path,file_name,uploaded_by) values (%L,%L,'qa.pdf',%L)$q$, e, 'proofs/'||e||'/1-qa.pdf', tm));   -- the path js/111 addProofs writes
  out := out || pg_temp.chk('proof_on_open_month', r='ok rows=1', r);
  r := pg_temp.run(T, format($q$insert into storage.objects(bucket_id,name,owner) values ('proofs',%L,%L)$q$, 'proofs/'||e||'/2-qa.pdf', T));
  out := out || pg_temp.chk('proof_file_store_accepts', r='ok rows=1', r);
  r := pg_temp.run(V, format($q$update report_entries set status='final' where id=%L$q$, e));
  out := out || pg_temp.chk('view_cannot_finalize', r='ok rows=0' or r ~ '^ERR', r);
  r := pg_temp.run(T, format($q$update report_entries set status='final' where id=%L returning coalesce(finalized_by::text,'')$q$, e));
  out := out || pg_temp.chk('finalize_stamps_who', r = 'ok rows=1 val='||tm, r);
  -- issuing a month (a numbered report) is the NEXT release; until then the month is locked here as a setup step
  update periods set locked_at=now() where id=per;
  r := pg_temp.run(T, format($q$select count(*)::text from evidence_files where entry_id=%L$q$, e));
  out := out || pg_temp.chk('proof_readable_by_owner', r='ok rows=1 val=1', r);
  r := pg_temp.run(T, format($q$insert into evidence_files(entry_id,storage_path,file_name,uploaded_by) values (%L,%L,'late.pdf',%L)$q$, e, 'proofs/'||e||'/3-late.pdf', tm));
  out := out || pg_temp.chk('issued_month_proof_row_refused', r ~* 'ERR.*(frozen|issued)', r);
  r := pg_temp.run(T, format($q$insert into storage.objects(bucket_id,name,owner) values ('proofs',%L,%L)$q$, 'proofs/'||e||'/4-late.pdf', T));
  out := out || pg_temp.chk('issued_month_proof_file_refused', r ~ '^ERR', r);
  r := pg_temp.run(M, format($q$update report_entries set title='QA changed after issue' where id=%L$q$, e));
  out := out || pg_temp.chk('issued_month_line_frozen', r ~* 'ERR.*locked' or r='ok rows=0', r);
  raise exception 'VERDICT L2 %', array_to_string(out, ' · ');
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- L3 — KPI targets: the manager sets one; a team member cannot; the team member reads theirs
-- ---------------------------------------------------------------------------------------------------------------
do $$
declare T uuid; M uuid := '06bb5086-9c8c-4a1b-9452-eb0b14c24fa9';
        A uuid := '096eec1a-6d2c-4be4-a5f9-19e920062e7c'; tm uuid; per uuid; k uuid; r text; out text[] := '{}';
begin
  perform set_config('request.jwt.claims', json_build_object('sub',A,'role','authenticated')::text, true);
  select u.id into T from app_users u join team_members m on m.user_id=u.id and m.active where u.role='team_member' and u.active order by u.id limit 1;
  select id into tm from team_members where user_id=T and active;
  select id into per from periods where kind='month' and current_date between start_date and end_date;
  select id into k from kpi_definitions where active and method='manual' order by code limit 1;
  r := pg_temp.run(M, format($q$insert into kpi_targets(kpi_id,scope,member_id,period_id,target_value) values (%L,'member',%L,%L,7) returning id::text$q$, k, tm, per));
  out := out || pg_temp.chk('manager_sets_target', r ~ '^ok rows=1', r);
  r := pg_temp.run(T, format($q$insert into kpi_targets(kpi_id,scope,member_id,period_id,target_value) values (%L,'member',%L,%L,99)$q$, k, tm, per));
  out := out || pg_temp.chk('member_cannot_set_target', r ~ '^ERR', r);
  r := pg_temp.run(T, format($q$update kpi_targets set target_value=1 where member_id=%L and period_id=%L$q$, tm, per));
  out := out || pg_temp.chk('member_cannot_change_target', r='ok rows=0' or r ~ '^ERR', r);
  r := pg_temp.run(T, format($q$select target_value::text from kpi_targets where member_id=%L and period_id=%L and kpi_id=%L$q$, tm, per, k));
  out := out || pg_temp.chk('member_reads_own_target', r ~ 'val=7', r);
  raise exception 'VERDICT L3 %', array_to_string(out, ' · ');
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- L4 — the company card on a real client (all undone): client IDs trimmed, at most three open, unique; discount codes
--      linked to one company only, a removed link stays removed; files at their own path only, IBAN readable by the
--      manager and not the team member, a CR readable at View; the "on file" counts; View cannot write
-- ---------------------------------------------------------------------------------------------------------------
do $$
declare T uuid; M uuid := '06bb5086-9c8c-4a1b-9452-eb0b14c24fa9';
        A uuid := '096eec1a-6d2c-4be4-a5f9-19e920062e7c'; V uuid; b uuid; b2 uuid; pc uuid; open_n int; i int; r text; out text[] := '{}';
        d1 uuid := gen_random_uuid(); d2 uuid := gen_random_uuid(); cdc uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub',A,'role','authenticated')::text, true);
  select u.id into T from app_users u join team_members m on m.user_id=u.id and m.active where u.role='team_member' and u.active order by u.id limit 1;
  select u.id into V from app_users u join team_members m on m.user_id=u.id and m.active where u.role='team_member' and u.active and u.id<>T limit 1;
  update app_users set page_access = coalesce(page_access,'{}'::jsonb) || '{"clients":"view","leads":"view"}' where id=V;
  update app_users set page_access = coalesce(page_access,'{}'::jsonb) || '{"clients":"full"}' where id=T;
  select b0.id into b from businesses b0 where b0.is_client and b0.archived_at is null
    and (select count(*) from client_profiles c where c.business_id=b0.id and c.closed_at is null) < 3 order by b0.id limit 1;
  select b0.id into b2 from businesses b0 where b0.is_client and b0.archived_at is null and b0.id<>b order by b0.id limit 1;
  select id into pc from promo_codes order by code limit 1;
  select count(*) into open_n from client_profiles where business_id=b and closed_at is null;

  r := pg_temp.run(T, format($q$insert into client_profiles(business_id,direct_client_id,profile_type) values (%L,'  QA-AUD-1  ','tender') returning direct_client_id$q$, b));
  out := out || pg_temp.chk('client_id_trimmed', r='ok rows=1 val=QA-AUD-1', r);
  r := pg_temp.run(T, format($q$insert into client_profiles(business_id,direct_client_id,profile_type) values (%L,'QA-AUD-1','tender')$q$, b2));
  out := out || pg_temp.chk('client_id_unique', r ~ '^ERR', r);
  for i in 2..(3-open_n) loop
    r := pg_temp.run(T, format($q$insert into client_profiles(business_id,direct_client_id,profile_type) values (%L,%L,'tender')$q$, b, 'QA-AUD-'||i));
  end loop;
  r := pg_temp.run(T, format($q$insert into client_profiles(business_id,direct_client_id,profile_type) values (%L,'QA-AUD-9','tender')$q$, b));
  out := out || pg_temp.chk('at_most_three_open', r ~* 'ERR.*(three|3)', r);
  r := pg_temp.run(V, format($q$insert into client_profiles(business_id,direct_client_id,profile_type) values (%L,'QA-AUD-V','tender')$q$, b2));
  out := out || pg_temp.chk('view_cannot_add_client_id', r ~ '^ERR', r);

  r := pg_temp.run(T, format($q$insert into company_discount_codes(business_id,promo_code_id) values (%L,%L) returning id::text$q$, b, pc));
  out := out || pg_temp.chk('code_linked', r ~ '^ok rows=1', r);
  cdc := nullif(split_part(r,'val=',2),'')::uuid;
  r := pg_temp.run(T, format($q$insert into company_discount_codes(business_id,promo_code_id) values (%L,%L)$q$, b2, pc));
  out := out || pg_temp.chk('code_one_company_only', r ~ '^ERR', r);
  r := pg_temp.run(T, format($q$update company_discount_codes set removed_at=now() where id=%L$q$, cdc));
  out := out || pg_temp.chk('code_unlinked', r='ok rows=1', r);
  r := pg_temp.run(T, format($q$update company_discount_codes set removed_at=null, removed_by=null where id=%L$q$, cdc));
  out := out || pg_temp.chk('unlink_is_final', r ~ '^ERR' or r='ok rows=0', r);
  r := pg_temp.run(T, format($q$delete from company_discount_codes where id=%L$q$, cdc));
  out := out || pg_temp.chk('code_link_never_deleted', r ~ '^ERR' or r='ok rows=0', r);

  r := pg_temp.run(T, format($q$insert into company_documents(id,business_id,doc_type,storage_path,file_name) values (%L,%L,'cr',%L,'qa-cr.pdf')$q$, d1, b, 'clients/'||b||'/'||d1||'/qa-cr.pdf'));
  out := out || pg_temp.chk('cr_row_filed', r='ok rows=1', r);
  r := pg_temp.run(T, format($q$insert into storage.objects(bucket_id,name,owner) values ('company-docs',%L,%L)$q$, 'clients/'||b||'/'||d1||'/qa-cr.pdf', T));
  out := out || pg_temp.chk('cr_file_at_own_path', r='ok rows=1', r);
  r := pg_temp.run(T, format($q$insert into storage.objects(bucket_id,name,owner) values ('company-docs',%L,%L)$q$, 'clients/'||b||'/'||gen_random_uuid()||'/stray.pdf', T));
  out := out || pg_temp.chk('stray_path_refused', r ~ '^ERR', r);
  r := pg_temp.run(T, format($q$insert into company_documents(id,business_id,doc_type,storage_path,file_name) values (%L,%L,'iban',%L,'qa-iban.pdf')$q$, d2, b, 'clients/'||b||'/'||d2||'/qa-iban.pdf'));
  out := out || pg_temp.chk('iban_row_filed_by_member', r='ok rows=1', r);
  r := pg_temp.run(T, format($q$select count(*)::text from company_documents where id=%L$q$, d2));
  out := out || pg_temp.chk('member_cannot_read_iban', r='ok rows=1 val=0', r);
  r := pg_temp.run(M, format($q$select count(*)::text from company_documents where id=%L$q$, d2));
  out := out || pg_temp.chk('manager_reads_iban', r='ok rows=1 val=1', r);
  r := pg_temp.run(V, format($q$select count(*)::text from company_documents where id in (%L,%L)$q$, d1, d2));
  out := out || pg_temp.chk('view_reads_cr_not_iban', r='ok rows=1 val=1', r);
  r := pg_temp.run(T, format($q$select company_documents_presence(%L)::text$q$, b));
  out := out || pg_temp.chk('on_file_counts', r ~ '"cr": 1' and r ~ '"iban": 1', r);
  r := pg_temp.run(T, format($q$update company_documents set deleted_at=now() where id=%L$q$, d1));
  out := out || pg_temp.chk('file_removed', r='ok rows=1', r);
  r := pg_temp.run(A, format($q$update company_documents set deleted_at=null, deleted_by=null where id=%L$q$, d1));
  out := out || pg_temp.chk('removal_final_even_for_admin', r ~ '^ERR' or r='ok rows=0', r);
  r := pg_temp.run(T, format($q$update storage.objects set name=name||'.x' where bucket_id='company-docs' and name like %L$q$, 'clients/'||b||'/'||d1||'/%'));
  out := out || pg_temp.chk('file_never_overwritten', r ~ '^ERR' or r='ok rows=0', r);
  raise exception 'VERDICT L4 %', array_to_string(out, ' · ');
end $$;


-- ---------------------------------------------------------------------------------------------------------------
-- L5 — E, the money rules (D16): a team member reads nothing and writes no rule; an admin's rule leaves a row out of
--      money_rows / finance_lines at once and stamps who; a rule is never deleted, switching it off brings the row back,
--      a removed rule stays removed; a name rule never catches a row that has a client ID; a typed name merges a row
--      with no client ID into its company; exclusion beats merge. The test rows are made inside the block (QA-TEST …).
-- ---------------------------------------------------------------------------------------------------------------
do $$
declare T uuid; M uuid := '06bb5086-9c8c-4a1b-9452-eb0b14c24fa9';
        A uuid := '096eec1a-6d2c-4be4-a5f9-19e920062e7c'; b uuid; i1 uuid; i2 uuid; rid uuid; r text; out text[] := '{}';
begin
  perform set_config('request.jwt.claims', json_build_object('sub',A,'role','authenticated')::text, true);
  select u.id into T from app_users u join team_members m on m.user_id=u.id and m.active where u.role='team_member' and u.active order by u.id limit 1;
  select id into b from businesses order by created_at limit 1;
  insert into finance_invoices(invoice_no, client_group, invoice_date, total_incl_vat_sar, revenue_sar, payments_client_id)
    values ('QA-TEST-E1', 'QA-TEST Company One', current_date, 1000, 1000, 'QA-CID-9999') returning id into i1;
  insert into finance_invoices(invoice_no, client_group, invoice_date, total_incl_vat_sar, revenue_sar)
    values ('QA-TEST-E2', 'QA-TEST Company Two', current_date, 500, 500) returning id into i2;

  r := pg_temp.run(A, format($q$select counts::text from money_rows where id=%L$q$, i1));
  out := out || pg_temp.chk('paid_row_counts', r='ok rows=1 val=true', r);
  r := pg_temp.run(T, $q$insert into money_exclusion_rules(kind,value,reason) values ('client_id','QA-CID-9999','QA test')$q$);
  out := out || pg_temp.chk('team_member_cannot_add_rule', r ~ '^ERR', r);
  r := pg_temp.run(A, $q$insert into money_exclusion_rules(kind,value,reason) values ('client_id','QA-CID-9999','')$q$);
  out := out || pg_temp.chk('reason_required', r ~ '^ERR', r);
  r := pg_temp.run(A, $q$insert into money_exclusion_rules(kind,value,reason) values ('client_id',' QA-CID-9999 ','QA test') returning id::text||'|'||coalesce(created_by_name,'')$q$);
  out := out || pg_temp.chk('admin_adds_rule_who_stamped', r ~ '^ok rows=1 val=[0-9a-f-]+\|.+', r);
  rid := nullif(split_part(split_part(r,'val=',2),'|',1),'')::uuid;
  r := pg_temp.run(A, format($q$select (excluded and not counts)::text||'|'||coalesce(rule_kind,'') from money_rows where id=%L$q$, i1));
  out := out || pg_temp.chk('rule_leaves_row_out_at_once', r='ok rows=1 val=true|client_id', r);
  r := pg_temp.run(A, format($q$select count(*)::text from finance_lines where id=%L$q$, i1));
  out := out || pg_temp.chk('kpi_source_drops_it_too', r='ok rows=1 val=0', r);
  r := pg_temp.run(A, format($q$insert into money_exclusion_rules(kind,value,reason) values ('client_id','qa-cid-9999','dup')$q$));
  out := out || pg_temp.chk('one_live_rule_per_value', r ~ '^ERR', r);
  r := pg_temp.run(A, format($q$delete from money_exclusion_rules where id=%L$q$, rid));
  out := out || pg_temp.chk('rule_never_deleted', (r ~ '^ERR' or r='ok rows=0') and exists(select 1 from money_exclusion_rules where id=rid), r);
  r := pg_temp.run(A, format($q$update money_exclusion_rules set active=false where id=%L$q$, rid));
  out := out || pg_temp.chk('switch_off', r='ok rows=1', r);
  r := pg_temp.run(A, format($q$select counts::text from money_rows where id=%L$q$, i1));
  out := out || pg_temp.chk('switched_off_row_counts_again', r='ok rows=1 val=true', r);
  r := pg_temp.run(A, format($q$update money_exclusion_rules set removed_at=now() where id=%L$q$, rid));
  r := r || ' / ' || pg_temp.run(A, format($q$update money_exclusion_rules set removed_at=null, active=true where id=%L$q$, rid));
  out := out || pg_temp.chk('removed_stays_removed', r ~ '^ok rows=1 / ERR', r);
  r := pg_temp.run(A, $q$insert into money_exclusion_rules(kind,value,reason) values ('name','QA-TEST Company One','QA test')$q$);
  r := r || ' / ' || pg_temp.run(A, format($q$select counts::text from money_rows where id=%L$q$, i1));
  out := out || pg_temp.chk('name_rule_skips_row_with_client_id', r ~ '^ok rows=1 / ok rows=1 val=true$', r);
  r := pg_temp.run(A, format($q$insert into company_name_aliases(business_id,name) values (%L,'QA-TEST  company two')$q$, b));
  r := r || ' / ' || pg_temp.run(A, format($q$select merge_state||'|'||business_id::text from money_rows where id=%L$q$, i2));
  out := out || pg_temp.chk('typed_name_merges_row', r = format('ok rows=1 / ok rows=1 val=merged|%s', b), r);
  r := pg_temp.run(T, format($q$insert into company_name_aliases(business_id,name) values (%L,'QA-TEST other')$q$, b));
  out := out || pg_temp.chk('team_member_cannot_merge', r ~ '^ERR', r);
  r := pg_temp.run(A, $q$insert into money_exclusion_rules(kind,value,reason) values ('transaction','QA-TEST-E2','QA test')$q$);
  r := r || ' / ' || pg_temp.run(A, format($q$select (merge_state='merged' and not counts)::text from money_rows where id=%L$q$, i2));
  out := out || pg_temp.chk('exclusion_beats_merge', r ~ '^ok rows=1 / ok rows=1 val=true$', r);
  r := pg_temp.run(M, $q$select count(*)::text from money_rows where invoice_no like 'QA-TEST-E%'$q$);
  out := out || pg_temp.chk('manager_reads_same_rows', r='ok rows=1 val=2', r);
  raise exception 'VERDICT L5 %', array_to_string(out, ' · ');
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- L6 — D1, the money model and the invoice import (D21), first run at the switch-on of #53 (28 Sep): the commit lands a
--      duplicate invoice once with the newer status; a missing cost is empty and flagged, never profit; a top-up has zero
--      revenue and never counts; the KPI source sees the missing cost; an OLDER file only fills empty fields; the
--      item-name list — an admin adds, a team member cannot, never deleted, one entry per name; pass-through is shown,
--      never cost. Then the same team member made View-only on Finance INSIDE the block (rolled back): reads, cannot
--      import, cannot class items; with no Finance, reads nothing. (A team member with FULL Finance access may import —
--      that is the access setting working, so the refusal is tested at View level.) Test rows are QA-TEST-….
-- ---------------------------------------------------------------------------------------------------------------
do $$
declare T uuid; M uuid := '06bb5086-9c8c-4a1b-9452-eb0b14c24fa9';
        A uuid := '096eec1a-6d2c-4be4-a5f9-19e920062e7c'; r text; out text[] := '{}'; cid uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub',A,'role','authenticated')::text, true);
  select u.id into T from app_users u join team_members m on m.user_id=u.id and m.active where u.role='team_member' and u.active order by u.id limit 1;
  r := pg_temp.run(A, $q$select fn_commit_finance_import(p_insert := '[
      {"invoice_no":"QA-TEST-D1","client_group":"QA-TEST D1 Co","invoice_date":"2026-05-20","total_incl_vat_sar":700,"amount_received_sar":700,"amount_remaining_sar":0,"integrity_status":"verified_paid","payments_status":"Fully Paid","payments_status_at":"2026-05-20T09:00:00Z","paid_at":"2026-05-20"},
      {"invoice_no":"QA-TEST-D1","client_group":"QA-TEST D1 Co","invoice_date":"2026-05-14","total_incl_vat_sar":700,"integrity_status":"pending","payments_status":"Pending Payment","payments_status_at":"2026-05-14T09:00:00Z"},
      {"invoice_no":"QA-TEST-TOPUP","client_group":"QA-TEST D1 Co","invoice_date":"2026-05-21","total_incl_vat_sar":5000,"wallet_portion_sar":5000,"row_kind":"wallet_topup","integrity_status":"verified_paid","payments_status":"Fully Paid","payments_status_at":"2026-05-21T09:00:00Z"}]'::jsonb,
      p_item_lines := '[{"invoice_no":"QA-TEST-D1","line_no":1,"kind":"item","name":"Flight Booking - 3rd Party Fee","item_total_sar":600},
                        {"invoice_no":"QA-TEST-D1","line_no":1,"kind":"item","name":"Flight Booking - 3rd Party Fee","item_total_sar":600},
                        {"invoice_no":"QA-TEST-D1","line_no":2,"kind":"item","name":"Flight Booking - Service Fees","item_total_sar":100}]'::jsonb)::text$q$);
  out := out || pg_temp.chk('commit_dedupes_to_one_row_and_lines', r ~ '"inserted": 2' and r ~ '"item_lines": 2', r);
  r := pg_temp.run(A, $q$select count(*)||'|'||max(payments_status)||'|'||max(invoice_date::text) from finance_invoices where invoice_no='QA-TEST-D1'$q$);
  out := out || pg_temp.chk('newer_copy_won', r = 'ok rows=1 val=1|Fully Paid|2026-05-20', r);
  r := pg_temp.run(A, $q$select coalesce(cost_sar::text,'∅')||'|'||coalesce(profit_sar::text,'∅')||'|'||cost_missing||'|'||counts||'|'||revenue_sar from money_rows where invoice_no='QA-TEST-D1'$q$);
  out := out || pg_temp.chk('no_cost_is_empty_and_flagged_never_profit', r = 'ok rows=1 val=∅|∅|true|true|700.00', r);
  r := pg_temp.run(A, $q$select revenue_sar||'|'||counts||'|'||row_kind from money_rows where invoice_no='QA-TEST-TOPUP'$q$);
  out := out || pg_temp.chk('topup_stored_zero_revenue_never_counts', r = 'ok rows=1 val=0.00|false|wallet_topup', r);
  r := pg_temp.run(A, $q$select count(*)::text from finance_lines where invoice_no in ('QA-TEST-D1','QA-TEST-TOPUP') and cost_missing$q$);
  out := out || pg_temp.chk('kpi_source_sees_the_missing_cost', r = 'ok rows=1 val=1', r);
  r := pg_temp.run(A, $q$select fn_commit_finance_import(p_update := (select jsonb_build_array(jsonb_build_object('id',id,'invoice_date','2026-05-14','amount_received_sar',0,'amount_remaining_sar',700,'integrity_status','pending','payments_status','Pending Payment','payments_status_at','2026-05-14T09:00:00Z','branch','QA Branch')) from finance_invoices where invoice_no='QA-TEST-D1'))::text$q$);
  r := pg_temp.run(A, $q$select integrity_status||'|'||amount_received_sar::float||'|'||amount_remaining_sar::float||'|'||invoice_date||'|'||month||'|'||coalesce(branch,'∅') from finance_invoices where invoice_no='QA-TEST-D1'$q$);
  out := out || pg_temp.chk('older_file_only_fills_empty', r = 'ok rows=1 val=verified_paid|700|0|2026-05-20|May|QA Branch', r);
  r := pg_temp.run(T, $q$insert into money_item_classes(name,class) values ('3rd Party Fee','pass_through')$q$);
  out := out || pg_temp.chk('team_member_cannot_class_items', r ~ '^ERR', r);
  r := pg_temp.run(A, $q$insert into money_item_classes(name,class) values ('3rd Party Fee','pass_through') returning id::text$q$);
  out := out || pg_temp.chk('admin_classes_item', r ~ '^ok rows=1', r);
  cid := nullif(split_part(r,'val=',2),'')::uuid;
  r := pg_temp.run(A, $q$select pass_through_sar::float||'|'||coalesce(cost_sar::text,'∅')||'|'||coalesce(profit_sar::text,'∅') from money_rows where invoice_no='QA-TEST-D1'$q$);
  out := out || pg_temp.chk('pass_through_shown_never_cost', r = 'ok rows=1 val=600|∅|∅', r);
  r := pg_temp.run(A, $q$insert into money_item_classes(name,class) values (' 3RD party  fee','fee')$q$);
  out := out || pg_temp.chk('one_entry_per_name', r ~ '^ERR', r);
  r := pg_temp.run(A, format($q$delete from money_item_classes where id=%L$q$, cid));
  out := out || pg_temp.chk('item_name_never_deleted', (r ~ '^ERR' or r='ok rows=0') and exists(select 1 from money_item_classes where id=cid), r);
  r := pg_temp.run(M, $q$select count(*)::text from money_item_classes$q$);
  out := out || pg_temp.chk('manager_reads_list', r = 'ok rows=1 val=1', r);
  update app_users set page_access = jsonb_set(coalesce(page_access,'{}'::jsonb), '{finance}', '"view"') where id=T;
  r := pg_temp.run(T, $q$select fn_commit_finance_import(p_insert := '[{"invoice_no":"QA-TEST-TM","client_group":"x","invoice_date":"2026-05-01","total_incl_vat_sar":1}]'::jsonb)::text$q$);
  out := out || pg_temp.chk('view_only_finance_cannot_import', r ~ '^ERR' and not exists(select 1 from finance_invoices where invoice_no='QA-TEST-TM'), r);
  r := pg_temp.run(T, $q$select count(*)::text from money_rows$q$);
  out := out || pg_temp.chk('view_only_can_read', r ~ '^ok rows=1', r);
  update app_users set page_access = jsonb_set(coalesce(page_access,'{}'::jsonb), '{finance}', '"none"') where id=T;
  r := pg_temp.run(T, $q$select count(*)::text from money_item_classes$q$);
  out := out || pg_temp.chk('no_finance_reads_nothing', r = 'ok rows=1 val=0', r);
  raise exception 'VERDICT L6 %', array_to_string(out, ' · ');
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- fingerprint — run before and after; every number must be the same (nothing above may leave a trace)
-- ---------------------------------------------------------------------------------------------------------------
select (select count(*) from record_history) hist, (select count(*) from tasks) tasks, (select count(*) from client_profiles) cps,
       (select count(*) from company_documents) docs, (select count(*) from company_discount_codes) cdc,
       (select count(*) from report_entries) re, (select count(*) from evidence_files) ev, (select count(*) from kpi_targets) kt, (select count(*) from finance_invoices) fi, (select count(*) from money_exclusion_rules) mrules, (select count(*) from company_name_aliases) aliases,
       (select count(*) from money_item_classes) itemcls, (select count(*) from finance_invoice_lines) invlines,
       (select count(*) from storage.objects) objs, (select count(*) from periods where locked_at is not null) locked,
       (select coalesce(string_agg(family||year||':'||last_n, ',' order by family),'') from document_counters) counters,
       (select md5(string_agg(id::text||coalesce(page_access::text,''), ',' order by id)) from app_users) access_md5;
