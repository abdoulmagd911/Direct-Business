-- P3-8c (part 3) · what the calls added to the lists and the fields (V476, V478, V480, V484). Forward-only (V103).
--  · Side-status reasons: product gap · payment method not supported · price vs competitor, for At risk and for Lost
--    (V476). Tender lost reasons come with tenders (P5-8).
--  · The activity type Decision: a decision taken with the organisation (V478; Quote sent stays out — V492).
--  · Contract terms from the calls, typed, never Finance money (V480): payment model, minimum monthly commitment,
--    cancellation / force-majeure refund term, minimum volume, commission %, target, IATA RHC limit, bank guarantee,
--    risk status. A word term keeps its words in `value_text`; a number term its numbers before → after.
--  · A reference says which department holds it and the mailbox its codes go to — never a password (V484, V409).
-- Each seed is added once and never over an admin's own entry of the same key.

-- ================================================================ the seeds (V476, V478, V480)
select audit.begin('system', 'partner.call_lists_seeded', null, 'V476, V478, V480: the lists the calls added');
insert into partner.side_status_reason (key, name_en, name_ar, status, sort) values
  ('product_gap', 'Product gap', 'فجوة في المنتج', 'at_risk', 50),
  ('payment_method_not_supported', 'Payment method not supported', 'طريقة الدفع غير مدعومة', 'at_risk', 60),
  ('price_vs_competitor', 'Price vs competitor', 'السعر مقارنة بالمنافس', 'at_risk', 70),
  ('lost_product_gap', 'Product gap', 'فجوة في المنتج', 'lost', 50),
  ('lost_payment_method_not_supported', 'Payment method not supported', 'طريقة الدفع غير مدعومة', 'lost', 60),
  ('lost_price_vs_competitor', 'Price vs competitor', 'السعر مقارنة بالمنافس', 'lost', 70)
on conflict (key) do nothing;
insert into partner.activity_type (key, name_en, name_ar, sort) values
  ('decision', 'Decision', 'قرار', 60)
on conflict (key) do nothing;
insert into partner.term (key, name_en, name_ar, unit, sort) values
  ('payment_model', 'Payment model', 'نموذج الدفع', 'text', 50),
  ('minimum_monthly_commitment', 'Minimum monthly commitment', 'الحد الأدنى للالتزام الشهري', 'sar', 60),
  ('cancellation_refund_term', 'Cancellation / force-majeure refund term', 'شرط الاسترداد عند الإلغاء أو القوة القاهرة',
   'text', 70),
  ('minimum_volume', 'Minimum volume', 'الحد الأدنى للحجم', 'count', 80),
  ('commission', 'Commission %', 'نسبة العمولة', 'percent', 90),
  ('target', 'Target', 'المستهدف', 'text', 100),
  ('iata_rhc_limit', 'IATA RHC limit', 'حد ضمان IATA (RHC)', 'sar', 110),
  ('bank_guarantee', 'Bank guarantee', 'الضمان البنكي', 'sar', 120),
  ('risk_status', 'Risk status', 'حالة المخاطر', 'text', 130)
on conflict (key) do nothing;
select audit.end();

-- ================================================================ a word term keeps its words (V480)
alter table partner.contract_term add column value_text text
  constraint contract_term_value_text check (value_text is null
                                             or (pg_catalog.btrim(value_text) <> '' and pg_catalog.length(value_text) <= 500));
comment on column partner.contract_term.value_text is 'A word term''s value (V480): payment model, refund term, risk status …';

-- A term of unit text holds words, any other unit numbers — whatever door writes it.
create function partner.contract_term_kind() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  u text := (select t.unit from partner.term t where t.id = new.term_id);
begin
  if new.deleted_at is not null then
    return new;
  end if;
  if u = 'text' and (new.value_before is not null or new.value_after is not null) then
    raise exception using errcode = 'P0001', message = 'contract.term_takes_words', detail = new.term_id::text;
  end if;
  if u <> 'text' and new.value_text is not null then
    raise exception using errcode = 'P0001', message = 'contract.term_takes_numbers', detail = new.term_id::text;
  end if;
  return new;
end
$$;
create trigger term_kind before insert or update on partner.contract_term
  for each row execute function partner.contract_term_kind();

-- partner.contract_save as P3-8b-2 wrote it, plus: a word term is written as {"term", "value"}, a number term as
-- {"term", "before", "after"}.
create or replace function partner.contract_save(p_partner uuid, p_id uuid, p_values jsonb, p_version int default null,
                                                 p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := authz.me();
  v jsonb := coalesce(p_values, '{}') - 'terms';
  c partner.contract;
  p partner.partner;
  k text;
  cid uuid;
  req uuid;
  t jsonb;
  tm partner.term;
  cur partner.contract_term;
  keep uuid[] := '{}';
  what text;
  words text;
begin
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('side', 'kind', 'title', 'start_on', 'end_on', 'reminders_on', 'reminder_days', 'notes') then
      raise exception using errcode = 'P0001', message = 'contract.unknown_field', detail = k;
    end if;
  end loop;
  if p_values ? 'terms' and pg_catalog.jsonb_typeof(p_values -> 'terms') <> 'array' then
    raise exception using errcode = 'P0001', message = 'contract.terms_list_expected';
  end if;
  if p_id is null then
    if v ->> 'side' is null then
      raise exception using errcode = 'P0001', message = 'contract.side_required';
    end if;
    p := partner.side_writable(p_partner, v ->> 'side');
  else
    select * into c from partner.contract x where x.id = p_id and x.partner_id = p_partner and x.deleted_at is null;
    if c.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if v ? 'side' and v ->> 'side' is distinct from c.side then
      raise exception using errcode = 'P0001', message = 'partner.side_fixed';
    end if;
    p := partner.side_writable(p_partner, c.side);
    v := v - 'side';
    perform core.check_version('partner.contract', p_id, p_version,
      (select pg_catalog.array_agg(x) from pg_catalog.jsonb_object_keys(v) x where (pg_catalog.to_jsonb(c) -> x) is distinct from (v -> x)));
  end if;
  req := audit.begin('ui', 'contract.saved', pg_catalog.jsonb_build_object('partner', p.number,
                                                                            'side', coalesce(c.side, v ->> 'side')), p_reason);
  begin
    if p_id is null then
      insert into partner.contract (partner_id, side, kind, title, start_on, end_on, reminders_on, reminder_days, notes)
      select p_partner, x.side, coalesce(x.kind, 'contract'), pg_catalog.btrim(x.title), x.start_on, x.end_on,
             coalesce(x.reminders_on, true), x.reminder_days, x.notes
      from pg_catalog.jsonb_populate_record(null::partner.contract, v) x
      returning id into cid;
    else
      perform audit.write_fields('partner.contract', p_id, v);
      cid := p_id;
    end if;
    if p_values ? 'terms' then
      for t in select * from pg_catalog.jsonb_array_elements(p_values -> 'terms') loop
        select * into tm from partner.term x where x.key = t ->> 'term' and x.active and x.deleted_at is null;
        if tm.id is null then
          raise exception using errcode = 'P0002', message = 'contract.unknown_term', detail = t ->> 'term';
        end if;
        keep := keep || tm.id;
        words := nullif(pg_catalog.btrim(t ->> 'value'), '');
        select * into cur from partner.contract_term x where x.contract_id = cid and x.term_id = tm.id and x.deleted_at is null;
        if cur.id is null then
          insert into partner.contract_term (contract_id, term_id, value_before, value_after, value_text)
          values (cid, tm.id, (t ->> 'before')::numeric, (t ->> 'after')::numeric, words);
        else
          perform audit.write_fields('partner.contract_term', cur.id,
            pg_catalog.jsonb_build_object('value_before', t -> 'before', 'value_after', t -> 'after',
                                          'value_text', words));
        end if;
      end loop;
      update partner.contract_term set deleted_at = core.clock(), deleted_by = me,
                                       delete_reason = coalesce(p_reason, 'term removed')
      where contract_id = cid and deleted_at is null and not (term_id = any (keep));
    end if;
  exception
    when not_null_violation then
      get stacked diagnostics what = column_name;
      raise exception using errcode = 'P0001', message = 'contract.invalid', detail = what;
    when check_violation then
      get stacked diagnostics what = constraint_name;
      raise exception using errcode = 'P0001', message = 'contract.invalid', detail = what;
    when data_exception then
      raise exception using errcode = 'P0001', message = 'contract.invalid', detail = sqlerrm;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', cid, 'version', (select x.version from partner.contract x where x.id = cid),
                                       'request_id', req);
end
$$;

-- partner.contracts as P3-8b-2 wrote it, each term with its words too.
create or replace function partner.contracts(p_partner uuid, p_side text default null) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := partner.require_level(p_partner, null, 'view');
  days jsonb := core.setting_at('partner.contract_reminder_days', null, core.riyadh_today());
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', c.id, 'side', c.side, 'kind', c.kind, 'title', c.title, 'start_on', c.start_on, 'end_on', c.end_on,
      'reminders_on', c.reminders_on, 'reminder_days', c.reminder_days,
      'reminder_days_in_force', case when c.reminders_on and c.end_on is not null
                                     then coalesce(pg_catalog.to_jsonb(c.reminder_days), days) else '[]'::jsonb end,
      'renewal_task_id', c.renewal_task_id, 'notes', c.notes, 'version', c.version,
      'terms', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', t.id, 'term', tm.key, 'name_en', tm.name_en, 'name_ar', tm.name_ar, 'unit', tm.unit,
          'before', t.value_before, 'after', t.value_after, 'value', t.value_text, 'achievement_id', t.achievement_id,
          'logged', t.achievement_id is not null, 'version', t.version) order by tm.sort, tm.key)
        from partner.contract_term t join partner.term tm on tm.id = t.term_id
        where t.contract_id = c.id and t.deleted_at is null), '[]'::jsonb),
      'files', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', f.id, 'purpose', l.purpose, 'display_name_en', core.file_display_name(f.id, 'en'),
          'display_name_ar', core.file_display_name(f.id, 'ar'), 'mime', f.mime, 'size_bytes', f.size_bytes,
          'sensitivity', f.sensitivity) order by f.created_at, f.id)
        from core.file_link l join core.file f on f.id = l.file_id
        where l.entity_table = 'partner.contract' and l.entity_id = c.id and l.deleted_at is null
          and f.deleted_at is null and authz.file_visible(f.id)), '[]'::jsonb))
      || partner.contract_state(c.start_on, c.end_on)
      order by c.start_on desc, c.id)
    from partner.contract c
    where c.partner_id = p_partner and c.deleted_at is null and (p_side is null or c.side = p_side)
      and partner.sees_side(me, p_partner, c.side)), '[]'::jsonb);
end
$$;

-- ================================================================ who holds a reference, where its codes go (V484)
alter table partner.reference
  add column held_by_department_id uuid references core.department (id),
  add column code_goes_to text constraint reference_code_mailbox
    check (code_goes_to is null or (code_goes_to ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                                    and pg_catalog.length(code_goes_to) <= 254));
create index reference_held_by on partner.reference (held_by_department_id);
comment on column partner.reference.held_by_department_id is 'The department that holds this access (V484).';
comment on column partner.reference.code_goes_to is 'The mailbox a portal''s codes go to (V484) — an address, never a password.';

-- partner.reference_save as P3-8b-2 wrote it, plus `held_by` (a department, by code or id; null clears it) and
-- `code_goes_to` (a mailbox; empty clears it).
create or replace function partner.reference_save(p_partner uuid, p_id uuid, p_values jsonb, p_version int default null,
                                                  p_reason text default null) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v jsonb := coalesce(p_values, '{}');
  r partner.reference;
  p partner.partner;
  k text;
  sys uuid;
  dep uuid;
  rid uuid;
  req uuid;
  what text;
begin
  for k in select pg_catalog.jsonb_object_keys(v) loop
    if k not in ('side', 'system', 'value', 'url', 'held_by', 'code_goes_to') then
      raise exception using errcode = 'P0001', message = 'reference.unknown_field', detail = k;
    end if;
  end loop;
  if v ? 'system' then
    select x.id into sys from work.ref_system x
    where (x.key = v ->> 'system' or x.id::text = v ->> 'system') and x.active and x.deleted_at is null;
    if sys is null then
      raise exception using errcode = 'P0002', message = 'reference.unknown_system', detail = v ->> 'system';
    end if;
    v := (v - 'system') || pg_catalog.jsonb_build_object('system_id', sys);
  end if;
  if v ? 'held_by' then
    if v ->> 'held_by' is not null then
      select x.id into dep from core.department x
      where (x.code = v ->> 'held_by' or x.id::text = v ->> 'held_by') and x.active and x.deleted_at is null;
      if dep is null then
        raise exception using errcode = 'P0002', message = 'reference.unknown_department', detail = v ->> 'held_by';
      end if;
    end if;
    v := (v - 'held_by') || pg_catalog.jsonb_build_object('held_by_department_id', dep);
  end if;
  if v ? 'value' then
    v := v || pg_catalog.jsonb_build_object('value', pg_catalog.btrim(v ->> 'value'));
  end if;
  if v ? 'url' then
    v := v || pg_catalog.jsonb_build_object('url', nullif(pg_catalog.btrim(v ->> 'url'), ''));
  end if;
  if v ? 'code_goes_to' then
    v := v || pg_catalog.jsonb_build_object('code_goes_to', nullif(pg_catalog.btrim(v ->> 'code_goes_to'), ''));
  end if;
  if p_id is null then
    p := partner.side_writable(p_partner, v ->> 'side');
  else
    select * into r from partner.reference x where x.id = p_id and x.partner_id = p_partner and x.deleted_at is null;
    if r.id is null then
      raise exception using errcode = 'P0002', message = 'common.not_found';
    end if;
    if v ? 'side' and v ->> 'side' is distinct from r.side then
      raise exception using errcode = 'P0001', message = 'partner.side_fixed';
    end if;
    p := partner.side_writable(p_partner, r.side);
    v := v - 'side';
    perform core.check_version('partner.reference', p_id, p_version,
      (select pg_catalog.array_agg(x) from pg_catalog.jsonb_object_keys(v) x where (pg_catalog.to_jsonb(r) -> x) is distinct from (v -> x)));
  end if;
  req := audit.begin('ui', 'reference.saved', pg_catalog.jsonb_build_object('partner', p.number), p_reason);
  begin
    if p_id is null then
      insert into partner.reference (partner_id, side, system_id, value, url, held_by_department_id, code_goes_to)
      select p_partner, x.side, x.system_id, x.value, x.url, x.held_by_department_id, x.code_goes_to
      from pg_catalog.jsonb_populate_record(null::partner.reference, v) x
      returning id into rid;
    else
      perform audit.write_fields('partner.reference', p_id, v);
      rid := p_id;
    end if;
  exception
    when check_violation then
      get stacked diagnostics what = constraint_name;
      if what = 'reference_no_secrets' then
        raise exception using errcode = 'P0001', message = 'partner.no_secrets',
          detail = 'Cards hold references to Direct''s systems, never passwords.';
      end if;
      if what = 'reference_code_mailbox' then
        raise exception using errcode = 'P0001', message = 'reference.mailbox_invalid';
      end if;
      raise exception using errcode = 'P0001', message = 'reference.invalid', detail = what;
    when not_null_violation then
      get stacked diagnostics what = column_name;
      raise exception using errcode = 'P0001', message = 'reference.invalid', detail = what;
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'version', (select x.version from partner.reference x where x.id = rid),
                                       'request_id', req);
end
$$;

-- partner.references as P3-8b-2 wrote it, each with the department that holds it and where its codes go.
create or replace function partner.references(p_partner uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := partner.require_level(p_partner, null, 'view');
begin
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', r.id, 'side', r.side, 'system', s.key, 'system_en', s.name_en, 'system_ar', s.name_ar, 'value', r.value,
      'url', r.url, 'link', coalesce(r.url, pg_catalog.replace(s.url_template, '{value}', r.value)),
      'held_by', case when d.id is null then null else pg_catalog.jsonb_build_object(
        'id', d.id, 'code', d.code, 'name_en', d.name_en, 'name_ar', d.name_ar) end,
      'code_goes_to', r.code_goes_to,
      'version', r.version) order by s.sort, s.key, r.value)
    from partner.reference r join work.ref_system s on s.id = r.system_id
    left join core.department d on d.id = r.held_by_department_id
    where r.partner_id = p_partner and r.deleted_at is null and partner.sees_side(me, p_partner, r.side)), '[]'::jsonb);
end
$$;

revoke all on function partner.contract_term_kind() from public;
