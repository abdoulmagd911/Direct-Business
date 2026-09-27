-- change-log-and-qa-account.rollback.sql — undoes scripts/sql/change-log-and-qa-account.sql.
-- Brings back: the history trigger as it was (actor = the signed-in person only, `id` cast to uuid), on the 27 tables it
-- covered before; the log readable by everyone signed in (page rules per table); the two "changes to your …" functions
-- with the caller's rights; person_save refusing a manager on an admin (and writing its own name-change line).
-- NOT undone, on purpose: log lines already written stay as written (the log is never rewritten backwards — the
-- backfilled "QA Account" names included); the record_key column stays (harmless, the old trigger ignores it); the QA
-- account keeps its names and its place on the team list (retire it from the team list on the People page if wanted).
drop view if exists public.record_changes;

create or replace function public.record_history_write() returns trigger language plpgsql security definer
set search_path to 'public' as $$
declare a uuid; n text; act text; b jsonb; f jsonb;
begin
  a := auth.uid();
  select coalesce(full_name, email) into n from app_users where id = a;
  if TG_OP='INSERT' then act:='create'; b:=null; f:=to_jsonb(NEW);
  elsif TG_OP='DELETE' then act:='delete'; b:=to_jsonb(OLD); f:=null;
  else
    b:=to_jsonb(OLD); f:=to_jsonb(NEW); act:='edit';
    if TG_TABLE_NAME='businesses' then
      if OLD.archived_at is null and NEW.archived_at is not null then act:='archive';
      elsif OLD.archived_at is not null and NEW.archived_at is null then act:='restore'; end if;
    else
      if (b->>'deleted_at') is null and (f->>'deleted_at') is not null then act:='delete';
      elsif (b->>'deleted_at') is not null and (f->>'deleted_at') is null then act:='restore'; end if;
    end if;
    if b = f then return NEW; end if;
  end if;
  insert into record_history(actor, actor_name, table_name, record_id, action, before_row, after_row)
  values (a, coalesce(n,'unknown'), TG_TABLE_NAME,
          coalesce((f->>'id')::uuid, (b->>'id')::uuid), act, b, f);
  return coalesce(NEW, OLD);
end$$;

do $$
declare t text;
begin
  foreach t in array array['access_allowlist','activities','airlines','app_settings','app_users','blob_section_pages',
    'business_merges','client_service_fees','company_achievements','company_identity','company_profile_sections',
    'contact_submissions_review','contract_clauses','external_refs','finance_client_links','finance_cogs_expenses',
    'finance_expense_gate_capture','finance_expense_lines_capture','finance_expenses','finance_targets','funnels',
    'generated_documents','ksa_event_signups','ksa_events','master_db_companies','offers','owner_name_preference',
    'payment_receipts','periods','priorities','promo_codes','proof_documents','providers','report_categories','requests',
    'service_fee_scenarios','service_types','slas','sops','tags','task_statuses','tender_template_sections','work_types']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_record_history on public.%I', t);
    end if;
  end loop;
end $$;

drop policy if exists record_history_read on public.record_history;
create policy record_history_read on public.record_history for select to authenticated using (
  case
    when table_name = any (array['finance_invoices','finance_transactions','finance_client_links']) then can_see_page('finance')
    when table_name = 'tasks' then can_see_page('tasks') and can_see_task_id(record_id)
    when table_name = any (array['task_people','task_checklist','task_comments','task_files','task_dependencies','task_tags'])
      then can_see_page('tasks') and can_see_task_id(coalesce(nullif(after_row->>'task_id','')::uuid, nullif(before_row->>'task_id','')::uuid))
    when table_name = 'projects' then can_see_page('tasks')
    when table_name = any (array['report_entries','reports','evidence_files','kpi_targets']) then can_see_page('reports')
    else true
  end);
do $$
declare f text;
begin
  foreach f in array array['public.changes_to_my_tasks(integer)', 'public.changes_to_my_companies(integer)'] loop
    if to_regprocedure(f) is not null then execute format('alter function %s security invoker', f); end if;
  end loop;
end $$;
drop function if exists public.record_key_of(oid, jsonb);
drop function if exists public.qa_user_id();

create or replace function public.person_save(p_user uuid, p jsonb) returns jsonb language plpgsql security definer
set search_path to 'public' as $$
declare me text := coalesce(public.app_role()::text, ''); u app_users%rowtype; mid uuid; home uuid; rep uuid;
        fe text; le text; fa text; la text; a uuid; before jsonb; after jsonb;
begin
  if me not in ('admin','manager') then
    raise exception 'Only an admin or a manager can change people' using errcode = '42501'; end if;
  select * into u from app_users where id = p_user;
  if not found then raise exception 'No such person' using errcode = 'P0002'; end if;
  if u.role = 'admin' and me <> 'admin' then
    raise exception 'Only an admin can change an admin''s details' using errcode = '42501'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Nothing to save'; end if;
  before := jsonb_build_object('first_name_en', u.first_name_en, 'last_name_en', u.last_name_en,
                               'first_name_ar', u.first_name_ar, 'last_name_ar', u.last_name_ar);
  if p ?| array['first_name_en','last_name_en','first_name_ar','last_name_ar'] then
    fe := nullif(trim(coalesce(p->>'first_name_en', u.first_name_en)), '');
    le := nullif(trim(coalesce(p->>'last_name_en',  u.last_name_en)), '');
    fa := nullif(trim(coalesce(p->>'first_name_ar', u.first_name_ar)), '');
    la := nullif(trim(coalesce(p->>'last_name_ar',  u.last_name_ar)), '');
    if fe is null or fa is null then raise exception 'A first name is needed in English and in Arabic'; end if;
    update app_users set first_name_en = fe, last_name_en = le, first_name_ar = fa, last_name_ar = la,
           full_name = trim(fe || ' ' || coalesce(le, '')), name_ar = trim(fa || ' ' || coalesce(la, ''))
     where id = p_user;
    after := jsonb_build_object('first_name_en', fe, 'last_name_en', le, 'first_name_ar', fa, 'last_name_ar', la);
    if after is distinct from before then
      insert into record_history(actor, actor_name, table_name, record_id, action, before_row, after_row)
      values (auth.uid(), (select coalesce(nullif(full_name, ''), email) from app_users where id = auth.uid()),
              'app_users', p_user, 'edit', before || jsonb_build_object('email', u.email), after || jsonb_build_object('email', u.email));
    end if;
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
