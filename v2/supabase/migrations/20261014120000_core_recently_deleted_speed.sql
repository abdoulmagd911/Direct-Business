-- QA3-007: Recently deleted was the slowest first screen on a throttled phone. Two causes, both in the database.
--
-- 1. core.recently_deleted asked "may this person see it?" (authz.can_see_as, a heavy check) of EVERY row of every record
--    type, live ones included: the planner ran that call before the cheap "removed in the last 30 days" test, so a
--    person who is not an admin paid for every row in the system (6,000 contacts and 1,500 sides: 19 s locally). Now the
--    removed rows come first, newest first, and the visibility check runs one row at a time and stops at the limit.
-- 2. No record type had an index on when it was removed, so finding the few removed rows read every row. Each now has a
--    small one that holds only removed rows (a removed row is rare, so it costs a write nothing).
-- The answer's shape, order and rules are unchanged (DEL-01, DEL-02); PERF-01 holds the speed and the indexes.

create index department_removed_at on core.department (deleted_at) where deleted_at is not null;
create index file_removed_at on core.file (deleted_at) where deleted_at is not null;
create index file_kind_removed_at on core.file_kind (deleted_at) where deleted_at is not null;
create index file_link_removed_at on core.file_link (deleted_at) where deleted_at is not null;
create index mention_removed_at on core.mention (deleted_at) where deleted_at is not null;
create index note_removed_at on core.note (deleted_at) where deleted_at is not null;
create index person_removed_at on core.person (deleted_at) where deleted_at is not null;
create index person_capability_removed_at on core.person_capability (deleted_at) where deleted_at is not null;
create index person_department_removed_at on core.person_department (deleted_at) where deleted_at is not null;
create index person_email_removed_at on core.person_email (deleted_at) where deleted_at is not null;
create index person_page_level_removed_at on core.person_page_level (deleted_at) where deleted_at is not null;
create index person_team_assist_removed_at on core.person_team_assist (deleted_at) where deleted_at is not null;
create index reminder_removed_at on core.reminder (deleted_at) where deleted_at is not null;
create index role_capability_removed_at on core.role_capability (deleted_at) where deleted_at is not null;
create index role_page_level_removed_at on core.role_page_level (deleted_at) where deleted_at is not null;
create index saved_view_removed_at on core.saved_view (deleted_at) where deleted_at is not null;
create index setting_removed_at on core.setting (deleted_at) where deleted_at is not null;
create index team_page_level_removed_at on core.team_page_level (deleted_at) where deleted_at is not null;
create index billing_link_removed_at on finance.billing_link (deleted_at) where deleted_at is not null;
create index billing_proposal_removed_at on finance.billing_proposal (deleted_at) where deleted_at is not null;
create index channel_removed_at on finance.channel (deleted_at) where deleted_at is not null;
create index commission_word_removed_at on finance.commission_word (deleted_at) where deleted_at is not null;
create index credit_split_removed_at on finance.credit_split (deleted_at) where deleted_at is not null;
create index exclusion_rule_removed_at on finance.exclusion_rule (deleted_at) where deleted_at is not null;
create index expense_line_removed_at on finance.expense_line (deleted_at) where deleted_at is not null;
create index expense_status_word_removed_at on finance.expense_status_word (deleted_at) where deleted_at is not null;
create index import_difference_removed_at on finance.import_difference (deleted_at) where deleted_at is not null;
create index import_map_removed_at on finance.import_map (deleted_at) where deleted_at is not null;
create index invoice_removed_at on finance.invoice (deleted_at) where deleted_at is not null;
create index invoice_line_removed_at on finance.invoice_line (deleted_at) where deleted_at is not null;
create index item_class_removed_at on finance.item_class (deleted_at) where deleted_at is not null;
create index item_service_removed_at on finance.item_service (deleted_at) where deleted_at is not null;
create index month_close_removed_at on finance.month_close (deleted_at) where deleted_at is not null;
create index product_removed_at on finance.product (deleted_at) where deleted_at is not null;
create index receipt_removed_at on finance.receipt (deleted_at) where deleted_at is not null;
create index service_removed_at on finance.service (deleted_at) where deleted_at is not null;
create index status_map_removed_at on finance.status_map (deleted_at) where deleted_at is not null;
create index tax_invoice_removed_at on finance.tax_invoice (deleted_at) where deleted_at is not null;
create index wallet_rule_removed_at on finance.wallet_rule (deleted_at) where deleted_at is not null;
create index carry_removed_at on my.carry (deleted_at) where deleted_at is not null;
create index note_removed_at on my.note (deleted_at) where deleted_at is not null;
create index note_link_removed_at on my.note_link (deleted_at) where deleted_at is not null;
create index note_mention_removed_at on my.note_mention (deleted_at) where deleted_at is not null;
create index activity_outcome_removed_at on partner.activity_outcome (deleted_at) where deleted_at is not null;
create index activity_type_removed_at on partner.activity_type (deleted_at) where deleted_at is not null;
create index campaign_code_removed_at on partner.campaign_code (deleted_at) where deleted_at is not null;
create index code_terms_removed_at on partner.code_terms (deleted_at) where deleted_at is not null;
create index contact_removed_at on partner.contact (deleted_at) where deleted_at is not null;
create index contact_role_removed_at on partner.contact_role (deleted_at) where deleted_at is not null;
create index contract_removed_at on partner.contract (deleted_at) where deleted_at is not null;
create index contract_term_removed_at on partner.contract_term (deleted_at) where deleted_at is not null;
create index credit_limit_removed_at on partner.credit_limit (deleted_at) where deleted_at is not null;
create index identifier_removed_at on partner.identifier (deleted_at) where deleted_at is not null;
create index identifier_block_removed_at on partner.identifier_block (deleted_at) where deleted_at is not null;
create index individual_name_removed_at on partner.individual_name (deleted_at) where deleted_at is not null;
create index match_pin_removed_at on partner.match_pin (deleted_at) where deleted_at is not null;
create index merge_removed_at on partner.merge (deleted_at) where deleted_at is not null;
create index partner_removed_at on partner.partner (deleted_at) where deleted_at is not null;
create index partner_side_removed_at on partner.partner_side (deleted_at) where deleted_at is not null;
create index reference_removed_at on partner.reference (deleted_at) where deleted_at is not null;
create index side_field_removed_at on partner.side_field (deleted_at) where deleted_at is not null;
create index side_owner_removed_at on partner.side_owner (deleted_at) where deleted_at is not null;
create index side_status_change_removed_at on partner.side_status_change (deleted_at) where deleted_at is not null;
create index side_status_reason_removed_at on partner.side_status_reason (deleted_at) where deleted_at is not null;
create index side_tier_removed_at on partner.side_tier (deleted_at) where deleted_at is not null;
create index side_type_removed_at on partner.side_type (deleted_at) where deleted_at is not null;
create index term_removed_at on partner.term (deleted_at) where deleted_at is not null;
create index achievement_removed_at on perf.achievement (deleted_at) where deleted_at is not null;
create index achievement_category_removed_at on perf.achievement_category (deleted_at) where deleted_at is not null;
create index achievement_participant_removed_at on perf.achievement_participant (deleted_at) where deleted_at is not null;
create index achievement_ref_removed_at on perf.achievement_ref (deleted_at) where deleted_at is not null;
create index plan_removed_at on perf.plan (deleted_at) where deleted_at is not null;
create index lost_reason_removed_at on pipeline.lost_reason (deleted_at) where deleted_at is not null;
create index opportunity_removed_at on pipeline.opportunity (deleted_at) where deleted_at is not null;
create index source_removed_at on pipeline.source (deleted_at) where deleted_at is not null;
create index stage_removed_at on pipeline.stage (deleted_at) where deleted_at is not null;
create index stage_change_removed_at on pipeline.stage_change (deleted_at) where deleted_at is not null;
create index tender_removed_at on pipeline.tender (deleted_at) where deleted_at is not null;
create index action_item_removed_at on work.action_item (deleted_at) where deleted_at is not null;
create index action_item_helper_removed_at on work.action_item_helper (deleted_at) where deleted_at is not null;
create index priority_removed_at on work.priority (deleted_at) where deleted_at is not null;
create index project_removed_at on work.project (deleted_at) where deleted_at is not null;
create index project_health_removed_at on work.project_health (deleted_at) where deleted_at is not null;
create index project_status_removed_at on work.project_status (deleted_at) where deleted_at is not null;
create index ref_system_removed_at on work.ref_system (deleted_at) where deleted_at is not null;
create index task_removed_at on work.task (deleted_at) where deleted_at is not null;
create index task_contact_removed_at on work.task_contact (deleted_at) where deleted_at is not null;
create index task_helper_removed_at on work.task_helper (deleted_at) where deleted_at is not null;
create index task_occurrence_removed_at on work.task_occurrence (deleted_at) where deleted_at is not null;
create index task_ref_removed_at on work.task_ref (deleted_at) where deleted_at is not null;
create index task_status_removed_at on work.task_status (deleted_at) where deleted_at is not null;
create index task_status_change_removed_at on work.task_status_change (deleted_at) where deleted_at is not null;
create index task_template_removed_at on work.task_template (deleted_at) where deleted_at is not null;
create index task_type_removed_at on work.task_type (deleted_at) where deleted_at is not null;

-- core.recently_deleted as P3-6e and W10 wrote it, with the removed rows found first and the visibility asked lazily.
create or replace function core.recently_deleted(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  days int := coalesce((core.setting_at('audit.recently_deleted_days', null, core.riyadh_today()) #>> '{}')::int, 30);
  cutoff timestamptz;
  lim int := greatest(1, least(coalesce(p_limit, 100), 500));
  e core.entity;
  label text;
  label_ar text;
  parts text[] := '{}';
  r record;
  acc jsonb := '[]';
  n int := 0;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'auth.no_active_person';
  end if;
  cutoff := core.clock() - pg_catalog.make_interval(days => days);
  for e in
    select x.* from core.entity x
    where x.active and exists (select 1 from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass(x.table_name)
                                 and a.attname = 'deleted_at' and not a.attisdropped)
    order by x.key
  loop
    select pg_catalog.format('t.%I::text', a.attname) into label
    from pg_catalog.unnest(array['trade_name_en', 'title', 'name_en', 'full_name_en', 'original_name', 'key', 'value_raw',
                                 'body', 'email', 'ref']) with ordinality w(col, o)
    join pg_catalog.pg_attribute a on a.attrelid = pg_catalog.to_regclass(e.table_name) and a.attname = w.col
      and not a.attisdropped
    order by w.o limit 1;
    select pg_catalog.format('t.%I::text', a.attname) into label_ar
    from pg_catalog.unnest(array['trade_name_ar', 'name_ar', 'full_name_ar']) with ordinality w(col, o)
    join pg_catalog.pg_attribute a on a.attrelid = pg_catalog.to_regclass(e.table_name) and a.attname = w.col
      and not a.attisdropped
    order by w.o limit 1;
    parts := parts || pg_catalog.format(
      'select %L::text as entity, %L::text as tbl, t.id, %s as label, coalesce(%s, %s) as label_ar, t.deleted_at,'
      || ' t.deleted_by, t.delete_reason as reason from %s t where t.deleted_at > $1',
      e.key, e.table_name, coalesce(label, 'null::text'), coalesce(label_ar, 'null::text'),
      coalesce(label, 'null::text'), pg_catalog.to_regclass(e.table_name));
  end loop;
  if pg_catalog.cardinality(parts) = 0 then
    return acc;
  end if;
  -- Newest first; the system's removals and what this person may not see are skipped one row at a time, so the work
  -- ends at the limit instead of at the end of every record type.
  for r in execute 'select * from (' || pg_catalog.array_to_string(parts, ' union all ')
                   || ') c order by c.deleted_at desc, c.id' using cutoff
  loop
    continue when core.removed_by_system(r.tbl, r.id) or not authz.can_see_as(me, r.tbl, r.id);
    acc := acc || pg_catalog.jsonb_build_object('entity', r.entity, 'id', r.id, 'label', r.label,
      'label_ar', r.label_ar, 'deleted_at', r.deleted_at, 'deleted_by', r.deleted_by, 'reason', r.reason);
    n := n + 1;
    exit when n >= lim;
  end loop;
  return acc;
end
$$;
