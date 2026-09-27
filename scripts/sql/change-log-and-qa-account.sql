-- change-log-and-qa-account.sql (2026-09-27) — the owner's decisions of 27 Sep, (1) (2) (3), relayed by the oversight chat:
--   (1) managers MAY edit team records and employees — do not block it, log it;
--   (2) a change log on every record: who, when, field, before, after — visible to admins and managers only, for now;
--   (3) business@directksa.com is the QA test account (admin, on the team list); every import, bulk edit or seed run
--       from outside the app is attributed to it in the log, so old/backfilled data reads as QA-entered.
-- DECISIONS D13. Rollback: scripts/sql/change-log-and-qa-account.rollback.sql.

-- ---------------------------------------------------------------------------------------------------------------
-- 3. the QA account — found by its address, so nothing here holds an id
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.qa_user_id() returns uuid language sql stable security definer set search_path to 'public' as $$
  select id from public.app_users where lower(email) = 'business@directksa.com' limit 1
$$;
revoke all on function public.qa_user_id() from public, anon;
grant execute on function public.qa_user_id() to authenticated;

-- its names: it carried the owner's own names and nickname, the same as his admin account (aboelmagd@) — two accounts
-- answering to one name, which the ownership matching (js/43) cannot tell apart. test@ is already "QA Test Account".
update public.app_users set first_name_en = 'QA', last_name_en = 'Account', first_name_ar = 'حساب', last_name_ar = 'ضمان الجودة',
       full_name = 'QA Account', name_ar = 'حساب ضمان الجودة', nickname = null, nickname_ar = null
 where lower(email) = 'business@directksa.com';
-- on the team list, in the department itself (Commercial), reporting to its head like everyone else
insert into public.team_members(user_id, department_id, active, job_title_en, job_title_ar, reports_to)
  select u.id, d.id, true, 'QA test account', 'حساب الاختبار', d.head_member_id
    from public.app_users u, public.departments d
   where lower(u.email) = 'business@directksa.com' and d.code = 'commercial'
     and not exists (select 1 from public.team_members m where m.user_id = u.id);

-- ---------------------------------------------------------------------------------------------------------------
-- 2. the change log on every record
-- ---------------------------------------------------------------------------------------------------------------
-- a record's key as text: its `id` when it has one, else its primary key (a settings row's id is text; sixteen live
-- tables have no `id` column at all — the old trigger cast `id` to uuid and would have refused their saves)
alter table public.record_history add column if not exists record_key text;
update public.record_history set record_key = record_id::text where record_key is null and record_id is not null;
create index if not exists record_history_table_key_at on public.record_history (table_name, record_key, at desc);

create or replace function public.record_key_of(rel oid, j jsonb) returns text language sql stable set search_path to 'public' as $$
  select coalesce(nullif(j ->> 'id', ''),
    (select string_agg(j ->> a.attname, '|' order by array_position(i.indkey::int2[], a.attnum))
       from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
      where i.indrelid = rel and i.indisprimary))
$$;

-- who: the signed-in person; a change from a database session (SQL, a migration, an import or seed run from outside
-- the app) is the QA account's (decision 3); a service call with no person behind it (a sign-up, an edge function's
-- own write) is the system's, as before
create or replace function public.record_history_write() returns trigger language plpgsql security definer
set search_path to 'public' as $$
declare a uuid; n text; act text; b jsonb; f jsonb; k text; rid uuid; claims text;
begin
  a := auth.uid();
  if a is null then
    claims := nullif(current_setting('request.jwt.claims', true), '');
    if claims is null then a := public.qa_user_id(); end if;
  end if;
  select coalesce(nullif(full_name, ''), email) into n from app_users where id = a;
  if TG_OP = 'INSERT' then act := 'create'; b := null; f := to_jsonb(NEW);
  elsif TG_OP = 'DELETE' then act := 'delete'; b := to_jsonb(OLD); f := null;
  else
    b := to_jsonb(OLD); f := to_jsonb(NEW); act := 'edit';
    -- name the soft-delete/restore moves properly, so the log reads like what a person did
    if TG_TABLE_NAME = 'businesses' then
      if (b ->> 'archived_at') is null and (f ->> 'archived_at') is not null then act := 'archive';
      elsif (b ->> 'archived_at') is not null and (f ->> 'archived_at') is null then act := 'restore'; end if;
    else
      if (b ->> 'deleted_at') is null and (f ->> 'deleted_at') is not null then act := 'delete';
      elsif (b ->> 'deleted_at') is not null and (f ->> 'deleted_at') is null then act := 'restore'; end if;
    end if;
    if b = f then return NEW; end if;   -- nothing actually changed
  end if;
  k := public.record_key_of(TG_RELID, coalesce(f, b));
  if k ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then rid := k::uuid; end if;
  insert into record_history(actor, actor_name, table_name, record_id, record_key, action, before_row, after_row)
  values (a, coalesce(n, case when a is null and claims is not null then 'system' else 'unknown' end), TG_TABLE_NAME, rid, k, act, b, f);
  return coalesce(NEW, OLD);
end $$;

-- every live record table is logged. Not logged, on purpose: the logs themselves (record_history, task_status_log,
-- ksa_events_audit, app_state_history); the old whole-app blob (app_state — one row of megabytes, with its own history
-- table); the document number counter (issuing a number is logged on the document); share_links (it holds the secret
-- link token, and its last_used_at changes on every visit); the five retired app_* tables nothing writes; and every
-- backup / snapshot copy (*_prewipe_*, *_seedwipe_*, *_snapshot_*, *_archive_*, world30_*).
do $$
declare t text;
begin
  foreach t in array array['access_allowlist','activities','airlines','app_settings','app_users','blob_section_pages',
    'business_merges','businesses','client_profiles','client_service_fees','company_achievements','company_discount_codes',
    'company_documents','company_identity','company_profile_sections','contact_submissions_review','contacts',
    'contract_clauses','departments','evidence_files','external_refs','finance_client_links','finance_cogs_expenses',
    'finance_expense_gate_capture','finance_expense_lines_capture','finance_expenses','finance_invoices','finance_targets',
    'finance_transactions','funnels','generated_documents','initiatives','ksa_event_signups','ksa_events','kpi_definitions',
    'kpi_targets','master_db_companies','objectives','offers','owner_name_preference','payment_receipts','periods',
    'priorities','projects','promo_codes','proof_documents','providers','report_categories','report_entries','reports',
    'requests','service_fee_scenarios','service_types','slas','sops','tags','task_checklist','task_comments',
    'task_dependencies','task_files','task_people','task_statuses','task_tags','tasks','team_member_assists','team_members',
    'tender_template_sections','work_finance_links','work_settings','work_types']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_record_history on public.%I', t);
      execute format('create trigger trg_record_history after insert or update or delete on public.%I for each row execute function public.record_history_write()', t);
    end if;
  end loop;
end $$;

-- visible to admins and managers only (decision 2). The two "changes to your …" notices on Today (D7) keep working for
-- everyone: they read the log with their own rights and answer only about the caller's own tasks and companies.
drop policy if exists record_history_read on public.record_history;
create policy record_history_read on public.record_history for select to authenticated
  using (public.app_role() in ('admin', 'manager'));
do $$
declare f text;
begin
  foreach f in array array['public.changes_to_my_tasks(integer)', 'public.changes_to_my_companies(integer)'] loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s security definer', f);
      execute format('revoke all on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end $$;

-- the log field by field: one row per field that changed — who, when, field, before, after. A company's `raw` record is
-- opened one level, so a change inside it reads "raw.stage", not a whole blob. Reads through the log's own rule
-- (security_invoker): admins and managers see rows, everyone else sees none.
create or replace view public.record_changes with (security_invoker = on) as
select h.id as history_id, h.at, h.actor, h.actor_name, h.table_name,
       coalesce(h.record_key, h.record_id::text) as record_key, h.action, h.undone_at,
       d.field, d.before_value, d.after_value
  from public.record_history h
  cross join lateral (
    select k.field, h.before_row -> k.field as before_value, h.after_row -> k.field as after_value
      from (select distinct jsonb_object_keys(coalesce(h.before_row, '{}'::jsonb) || coalesce(h.after_row, '{}'::jsonb)) as field) k
     where k.field <> 'updated_at'
       and (h.before_row -> k.field) is distinct from (h.after_row -> k.field)
       and not (k.field = 'raw' and jsonb_typeof(h.before_row -> 'raw') = 'object' and jsonb_typeof(h.after_row -> 'raw') = 'object')
    union all
    select 'raw.' || r.k, h.before_row -> 'raw' -> r.k, h.after_row -> 'raw' -> r.k
      from (select distinct jsonb_object_keys((h.before_row -> 'raw') || (h.after_row -> 'raw')) as k
             where jsonb_typeof(h.before_row -> 'raw') = 'object' and jsonb_typeof(h.after_row -> 'raw') = 'object') r
     where (h.before_row -> 'raw' -> r.k) is distinct from (h.after_row -> 'raw' -> r.k)
  ) d;
revoke all on public.record_changes from anon;
grant select on public.record_changes to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 1. a manager may change anyone's details, an admin's included — logged, not refused. Names are now logged by the
--    login table's own trigger (above), so person_save no longer writes a history line by hand.
--    Unchanged on purpose: a person never changes their own page levels (set_page_levels), and only an admin makes
--    someone an admin (the admin-users function) — those two are about who holds power, not about editing records.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.person_save(p_user uuid, p jsonb) returns jsonb language plpgsql security definer
set search_path to 'public' as $$
declare me text := coalesce(public.app_role()::text, ''); u app_users%rowtype; mid uuid; home uuid; rep uuid;
        fe text; le text; fa text; la text; a uuid;
begin
  if me not in ('admin','manager') then
    raise exception 'Only an admin or a manager can change people' using errcode = '42501'; end if;
  select * into u from app_users where id = p_user;
  if not found then raise exception 'No such person' using errcode = 'P0002'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Nothing to save'; end if;

  if p ?| array['first_name_en','last_name_en','first_name_ar','last_name_ar'] then
    fe := nullif(trim(coalesce(p->>'first_name_en', u.first_name_en)), '');
    le := nullif(trim(coalesce(p->>'last_name_en',  u.last_name_en)), '');
    fa := nullif(trim(coalesce(p->>'first_name_ar', u.first_name_ar)), '');
    la := nullif(trim(coalesce(p->>'last_name_ar',  u.last_name_ar)), '');
    if fe is null or fa is null then raise exception 'A first name is needed in English and in Arabic'; end if;
    update app_users set first_name_en = fe, last_name_en = le, first_name_ar = fa, last_name_ar = la,
           full_name = trim(fe || ' ' || coalesce(le, '')), name_ar = trim(fa || ' ' || coalesce(la, ''))
     where id = p_user;
  end if;

  select id into mid from team_members where user_id = p_user;
  if p ? 'home_team' then
    home := nullif(p->>'home_team', '')::uuid;
    if home is null then raise exception 'Choose a home team'; end if;
    if mid is null then
      insert into team_members(user_id, department_id, active) values (p_user, home, true) returning id into mid;
    else
      update team_members set department_id = home where id = mid;
    end if;
  end if;
  if mid is null and (p ? 'reports_to' or p ? 'assists' or p ? 'job_title_en' or p ? 'job_title_ar') then
    raise exception 'Choose a home team first — that puts them on the team list'; end if;
  if p ? 'reports_to' then
    rep := nullif(p->>'reports_to', '')::uuid;
    update team_members set reports_to = rep where id = mid;
  end if;
  if p ? 'job_title_en' or p ? 'job_title_ar' then
    update team_members set job_title_en = coalesce(nullif(trim(p->>'job_title_en'), ''), case when p ? 'job_title_en' then null else job_title_en end),
                            job_title_ar = coalesce(nullif(trim(p->>'job_title_ar'), ''), case when p ? 'job_title_ar' then null else job_title_ar end)
     where id = mid;
  end if;
  if p ? 'assists' then
    if jsonb_typeof(p->'assists') <> 'array' then raise exception 'Assisted teams must be a list'; end if;
    delete from team_member_assists where member_id = mid
       and team_id not in (select (x #>> '{}')::uuid from jsonb_array_elements(p->'assists') x);
    for a in select distinct (x #>> '{}')::uuid from jsonb_array_elements(p->'assists') x loop
      if not exists (select 1 from team_member_assists where member_id = mid and team_id = a) then
        insert into team_member_assists(member_id, team_id) values (mid, a);
      end if;
    end loop;
  end if;
  return (select jsonb_build_object('user', p_user, 'member', mid, 'full_name', full_name, 'name_ar', name_ar) from app_users where id = p_user);
end $$;
revoke all on function public.person_save(uuid, jsonb) from public, anon;
grant execute on function public.person_save(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3 (backfill). every log line that named nobody came from a database session — seeds, imports, clean-ups, the resets —
-- and is the QA account's; lines already written as the QA account carry its new name
-- ---------------------------------------------------------------------------------------------------------------
update public.record_history h set actor = q.id, actor_name = q.full_name
  from (select id, full_name from public.app_users where lower(email) = 'business@directksa.com') q
 where h.actor is null and h.table_name <> 'access';
update public.record_history h set actor_name = q.full_name
  from (select id, full_name from public.app_users where lower(email) = 'business@directksa.com') q
 where h.actor = q.id and h.actor_name is distinct from q.full_name;
