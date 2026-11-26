-- Landing 56 — "Own clients only" on Finance (approved by the owner, 26 Nov 2026; the per-member design of
-- 22 Nov: "Member: sees Finance, adds and edits Finance for their OWN clients").
-- Until now anyone with Finance at Full changed every entry (Landing 34b), and a team member held Full.
--   1. The Team member role's level on Finance, and on an organisation's Finance tab, goes from Full to Own (the
--      role's own rows only, and only where they still read Full; a level an admin set for one person or one team
--      is their choice and is left alone). Own still READS all of Finance — no figure, list or card is hidden.
--   2. At Own a person adds and changes a Finance entry only for a client whose Client side they own: a new
--      invoice and its lines, expenses and receipts; an edit; a removal; an invoice's channel and commission; a
--      row's deal type; a tender's client ID. An entry that matches no organisation is nobody's own: it stays with
--      Full.
--   3. "Edit someone else's work — Allowed" (Landing 40) opens a colleague's client's entries to that one person.
-- Not changed: importing (its own extra, finance.import), credit limits (finance.credit_control), the exclusion and
-- merge lists (admins), the month close, the Finance word lists and the follow-ups of the older import (all Full).
-- A manager, a head and an admin keep Full; a Viewer keeps View. No figure can move: nothing that counts is touched.
-- Each function below that existed is the statement the database held, word for word, with only the marked lines
-- changed.

-- ---------------------------------------------------------------- the one rule
create function finance.may_write_partner(p_partner uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.me();
  lv core.level;
begin
  if me is null then
    return false;
  end if;
  if authz.is_admin() then
    return true;
  end if;
  lv := authz.level_of(me, 'finance');
  if lv = 'full' then
    return true;
  end if;
  -- Own: the Client side's owner, or a person with the extra "Edit someone else's work"
  return lv >= 'own' and p_partner is not null
     and (me in (select partner.side_owners(p_partner, 'client')) or core.extra_access(me, 'records.edit_others'));
end
$$;
comment on function finance.may_write_partner(uuid) is 'Landing 56: whether the caller may add or change a Finance entry of this organisation — Full on Finance, or Own and the owner of its Client side, or the extra records.edit_others.';
revoke all on function finance.may_write_partner(uuid) from public;

create function finance.require_own_partner(p_partner uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not finance.may_write_partner(p_partner) then
    raise exception using errcode = '42501', message = 'finance.own_clients_only',
      detail = coalesce((select p.number from partner.partner p where p.id = p_partner), '');
  end if;
end
$$;
comment on function finance.require_own_partner(uuid) is 'Landing 56: refuses a caller at Own on Finance for an organisation that is not their own client.';
revoke all on function finance.require_own_partner(uuid) from public;

-- An entry is its invoice's; an invoice is its matched organisation's (finance.partner_match). An entry that is not
-- there is left to the door, which says "not found".
create function finance.require_own(p_table text, p_ids uuid[]) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  i uuid;
  inv uuid;
begin
  if authz.is_admin() or authz.level_of(authz.me(), 'finance') = 'full' then
    return;
  end if;
  if p_table not in ('invoice', 'invoice_line', 'expense_line', 'receipt') then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'table';
  end if;
  foreach i in array coalesce(p_ids, '{}'::uuid[]) loop
    if p_table = 'invoice' then
      inv := i;
    else
      execute pg_catalog.format('select x.invoice_id from %s x where x.id = $1',
                                pg_catalog.to_regclass('finance.' || p_table))
        into inv using i;
    end if;
    if inv is null or not exists (select 1 from finance.invoice x where x.id = inv) then
      continue;
    end if;
    if not finance.may_write_partner((select m.partner_id from finance.partner_match(inv) m limit 1)) then
      raise exception using errcode = '42501', message = 'finance.own_clients_only',
        detail = coalesce((select x.ref from finance.invoice x where x.id = inv), '');
    end if;
  end loop;
end
$$;
comment on function finance.require_own(text, uuid[]) is 'Landing 56: refuses a caller at Own on Finance for an entry whose invoice is not their own client''s.';
revoke all on function finance.require_own(text, uuid[]) from public;

-- What the screen asks once: the organisations whose Finance entries the caller may change. null is "every one".
create function finance.my_clients() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.require('finance', 'view');
  lv core.level := authz.level_of(me, 'finance');
begin
  if authz.is_admin() or lv = 'full' or (lv >= 'own' and core.extra_access(me, 'records.edit_others')) then
    return pg_catalog.jsonb_build_object('all', true, 'partners', '[]'::jsonb);
  end if;
  if lv < 'own' then
    return pg_catalog.jsonb_build_object('all', false, 'partners', '[]'::jsonb);
  end if;
  return pg_catalog.jsonb_build_object('all', false, 'partners', coalesce((
    select pg_catalog.jsonb_agg(distinct m.partner_id)
    from partner.side_owner m join partner.partner p on p.id = m.partner_id and p.deleted_at is null
    where m.person_id = me and m.side = 'client' and m.deleted_at is null
      and m.effective_from <= core.riyadh_today() and (m.effective_to is null or m.effective_to > core.riyadh_today())),
    '[]'::jsonb));
end
$$;
comment on function finance.my_clients() is 'Landing 56: the organisations whose Finance entries the caller may change — all of them (Full, or Own with the extra), or the ones whose Client side they own.';
revoke all on function finance.my_clients() from public;

create function api.finance_my_clients() returns jsonb
language sql stable security invoker set search_path = '' as $$ select finance.my_clients() $$;
comment on function api.finance_my_clients() is 'Landing 56: the organisations whose Finance entries the caller may change (all, or their own clients).';
revoke all on function api.finance_my_clients() from public;
grant execute on function finance.my_clients() to authenticated;
grant execute on function api.finance_my_clients() to authenticated;

-- ---------------------------------------------------------------- the doors
CREATE OR REPLACE FUNCTION finance.row_add(p_table text, p_fields jsonb, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
  t text := 'finance.' || p_table;
  vals jsonb := finance.row_values(p_table, p_fields, true);
  cols text;
  rid uuid;
  req uuid;
begin
  if p_table in ('invoice_line', 'expense_line', 'receipt')
     and not exists (select 1 from finance.invoice i where i.id = (vals ->> 'invoice_id')::uuid and i.deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found', detail = 'invoice_id';
  end if;
  -- Landing 56: a line, an expense or a receipt goes on an invoice of the writer's own client (or the writer holds Full).
  if p_table in ('invoice_line', 'expense_line', 'receipt') then
    perform finance.require_own('invoice', array[(vals ->> 'invoice_id')::uuid]);
  end if;
  if p_table = 'invoice_line' and not (vals ? 'line_no') then
    vals := vals || pg_catalog.jsonb_build_object('line_no',
              (select coalesce(max(l.line_no), 0) + 1 from finance.invoice_line l where l.invoice_id = (vals ->> 'invoice_id')::uuid));
  end if;
  if p_table = 'receipt' then
    -- a receipt typed by hand has a key of its own, so no file ever finds it as one of its rows
    vals := vals || pg_catalog.jsonb_build_object('receipt_key', 'person|' || gen_random_uuid()::text);
  end if;
  vals := vals || pg_catalog.jsonb_build_object('created_by', me, 'src', pg_catalog.jsonb_build_object('_row', 'person'))
               || case when p_table in ('invoice', 'expense_line', 'receipt') then '{"source": "manual"}'::jsonb
                       else '{}'::jsonb end;
  select pg_catalog.string_agg(pg_catalog.quote_ident(k), ', ' order by k) into cols from pg_catalog.jsonb_object_keys(vals) k;
  req := audit.begin('ui', 'finance.row_added', pg_catalog.jsonb_build_object('table', p_table), p_reason);
  execute pg_catalog.format('insert into %1$s (%2$s) select %2$s from pg_catalog.jsonb_populate_record(null::%1$s, $1) returning id',
                            pg_catalog.to_regclass(t), cols)
    into rid using vals;
  -- Landing 56: a new invoice is the writer's own client's (or the writer holds Full) — else nothing of it is kept.
  if p_table = 'invoice' then
    perform finance.require_own('invoice', array[rid]);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', rid, 'request_id', req);
end
$function$;

CREATE OR REPLACE FUNCTION finance.row_edit(p_table text, p_id uuid, p_fields jsonb, p_version integer, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  answer jsonb;
begin
  perform authz.require('finance', 'own');
  if p_table = 'invoice' and exists (select 1 from finance.invoice i where i.id = p_id and i.kind = 'billing') then
    raise exception using errcode = 'P0001', message = 'finance.edit_at_transaction_level',
      detail = (select i.ref from finance.invoice i where i.id = p_id);
  end if;
  -- Landing 56: the entry is the writer's own client's before the change, and still after it.
  perform finance.require_own(p_table, array[p_id]);
  answer := finance.row_edit_core(p_table, p_id, p_fields, p_version, p_reason);
  perform finance.require_own(p_table, array[p_id]);
  return answer;
end
$function$;

CREATE OR REPLACE FUNCTION finance.row_edit_core(p_table text, p_id uuid, p_fields jsonb, p_version integer, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
  t text := 'finance.' || p_table;
  vals jsonb := finance.row_values(p_table, p_fields, false);
  cols text;
  marks jsonb;
  req uuid;
  ref text;
begin
  execute pg_catalog.format('select true from %s x where x.id = $1 and x.deleted_at is null for update', pg_catalog.to_regclass(t))
    into ref using p_id;
  if ref is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  perform core.check_version(t, p_id, p_version, array(select pg_catalog.jsonb_object_keys(vals)));
  select pg_catalog.string_agg(pg_catalog.quote_ident(k), ', ' order by k),
         pg_catalog.jsonb_object_agg(k, 'person')
  into cols, marks
  from pg_catalog.jsonb_object_keys(vals) k;
  req := audit.begin('ui', 'finance.row_edited', pg_catalog.jsonb_build_object('table', p_table), p_reason);
  execute pg_catalog.format(
    'update %1$s x set (%2$s) = (select %2$s from pg_catalog.jsonb_populate_record(x, $1)), '
    'src = coalesce(x.src, ''{}''::jsonb) || $2, updated_at = pg_catalog.now(), updated_by = $3, version = x.version + 1 '
    'where x.id = $4', pg_catalog.to_regclass(t), cols)
    using vals, marks, me, p_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', p_id, 'request_id', req);
end
$function$;

CREATE OR REPLACE FUNCTION finance.rows_remove(p_table text, p_ids uuid[], p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform authz.require('finance', 'own');
  if p_table = 'invoice' and exists (select 1 from finance.invoice i where i.id = any (p_ids) and i.kind = 'billing') then
    raise exception using errcode = 'P0001', message = 'finance.edit_at_transaction_level',
      detail = (select i.ref from finance.invoice i where i.id = any (p_ids) and i.kind = 'billing' limit 1);
  end if;
  -- Landing 56: every entry removed is the writer's own client's (or the writer holds Full).
  perform finance.require_own(p_table, p_ids);
  return finance.rows_remove_core(p_table, p_ids, p_reason);
end
$function$;

CREATE OR REPLACE FUNCTION finance.rows_remove_core(p_table text, p_ids uuid[], p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
  n int;
  req uuid;
begin
  if p_table not in ('invoice', 'invoice_line', 'expense_line', 'receipt') then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'table';
  end if;
  if pg_catalog.btrim(coalesce(p_reason, '')) = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  req := audit.begin('ui', 'finance.rows_removed', pg_catalog.jsonb_build_object('table', p_table,
                                                                              'count', pg_catalog.cardinality(p_ids)), p_reason);
  execute pg_catalog.format('update %s x set deleted_at = pg_catalog.now(), deleted_by = $1, delete_reason = $2 '
                            'where x.id = any ($3) and x.deleted_at is null', pg_catalog.to_regclass('finance.' || p_table))
    using me, p_reason, p_ids;
  get diagnostics n = row_count;
  perform audit.end();
  return pg_catalog.jsonb_build_object('removed', n, 'request_id', req);
end
$function$;

CREATE OR REPLACE FUNCTION finance.channel_set(p_invoice uuid, p_channel text, p_person uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
  inv finance.invoice;
  ch finance.channel;
  org uuid;
begin
  -- Landing 56: the invoice is the writer's own client's (or the writer holds Full).
  perform finance.require_own('invoice', array[p_invoice]);
  select * into inv from finance.invoice i where i.id = p_invoice and i.deleted_at is null for update;
  if inv.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if inv.kind not in ('transaction', 'standalone') then
    raise exception using errcode = 'P0001', message = 'finance.channel_on_units_only', detail = inv.kind;
  end if;
  if p_channel is not null then
    select * into ch from finance.channel c where c.key = p_channel and c.deleted_at is null and c.active;
    if ch.id is null then
      raise exception using errcode = 'P0002', message = 'finance.unknown_entry', detail = p_channel;
    end if;
  end if;
  select m.partner_id into org from finance.partner_match(inv.id) m;
  if coalesce(ch.credits_owner, false) and org is null and p_person is null then
    raise exception using errcode = 'P0001', message = 'finance.commercial_names_the_person';
  end if;
  if p_person is not null
     and not exists (select 1 from core.person x where x.id = p_person and x.active and x.kind = 'staff') then
    raise exception using errcode = 'P0001', message = 'person.not_active';
  end if;
  perform audit.begin('ui', 'finance.channel_set', pg_catalog.jsonb_build_object('ref', inv.ref, 'channel', p_channel), p_reason);
  update finance.invoice i set channel_id = ch.id, updated_at = pg_catalog.now(), updated_by = me, version = i.version + 1
  where i.id = inv.id;
  update finance.credit_split s set deleted_at = pg_catalog.now(), deleted_by = me, delete_reason = 'the channel changed'
  where s.invoice_id = inv.id and s.deleted_at is null and s.note = 'channel: commercial';
  if coalesce(ch.credits_owner, false) and org is null then
    insert into finance.credit_split (invoice_id, person_id, share, note, created_by)
    values (inv.id, p_person, 1, 'channel: commercial', me);
  end if;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', inv.id, 'channel', p_channel);
end
$function$;

CREATE OR REPLACE FUNCTION finance.commission_set(p_invoice uuid, p_type text, p_proof text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
  why text := pg_catalog.btrim(coalesce(p_reason, ''));
  proof text := nullif(pg_catalog.btrim(coalesce(p_proof, '')), '');
  inv finance.invoice;
  req uuid;
begin
  -- Landing 56: the invoice is the writer's own client's (or the writer holds Full).
  perform finance.require_own('invoice', array[p_invoice]);
  select * into inv from finance.invoice where id = p_invoice and deleted_at is null;
  if inv.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if why = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  -- commissions never come from the payment system's files: a hand-typed row only
  if inv.source <> 'manual' or inv.kind not in ('transaction', 'standalone') then
    raise exception using errcode = 'P0001', message = 'finance.commission_is_typed_by_hand', detail = inv.ref;
  end if;
  if p_type is null or p_type not in ('airlines', 'provider', 'cashback', 'study_abroad', 'other') then
    raise exception using errcode = 'P0001', message = 'finance.commission_needs_type';
  end if;
  if proof is null then
    raise exception using errcode = 'P0001', message = 'finance.commission_needs_proof';
  end if;
  if pg_catalog.length(proof) > 500 then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'proof';
  end if;
  req := audit.begin('ui', 'finance.commission_set', pg_catalog.jsonb_build_object('number', inv.ref, 'type', p_type), why);
  update finance.invoice set commission_type = p_type, commission_proof = proof,
    updated_at = now(), updated_by = me, version = version + 1 where id = inv.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('invoice_id', inv.id, 'commission_type', p_type, 'request_id', req);
end
$function$;

CREATE OR REPLACE FUNCTION finance.deal_type_set(p_partner uuid, p_number text, p_type text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
  why text := pg_catalog.btrim(coalesce(p_reason, ''));
  num text := pg_catalog.btrim(coalesce(p_number, ''));
  key text := norm.fold(pg_catalog.btrim(coalesce(p_number, '')));
  req uuid;
  n_manual int := 0;
  n_import int := 0;
begin
  -- Landing 56: the row's organisation is the writer's own client (or the writer holds Full).
  perform finance.require_own_partner(p_partner);
  if why = '' then
    raise exception using errcode = 'P0001', message = 'common.reason_required';
  end if;
  if num = '' or (p_type is not null and p_type not in ('prepaid', 'postpaid', 'tender', 'promo')) then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'deal_type';
  end if;
  req := audit.begin('ui', 'finance.deal_type_set', pg_catalog.jsonb_build_object('number', num, 'type', p_type), why);
  -- the row recorded here with that number, at that organisation (or at none, when none is given)
  update finance.invoice i set deal_type = p_type, updated_at = now(), updated_by = me, version = i.version + 1
    where i.deleted_at is null and norm.fold(i.ref) = key and i.kind in ('transaction', 'standalone', 'billing')
      and (select m.partner_id from finance.partner_match(i.id) m limit 1) is not distinct from p_partner
      and i.deal_type is distinct from p_type;
  get diagnostics n_manual = row_count;
  -- the imported row with that number at that organisation
  if p_partner is not null then
    update work.import_record x set deal_type = p_type, updated_at = now(), updated_by = me, version = x.version + 1
      where x.deleted_at is null and x.partner_id = p_partner and x.kind in ('transaction', 'invoice')
        and norm.fold(coalesce(x.transaction_ref, x.invoice_ref)) = key
        and x.deal_type is distinct from p_type;
    get diagnostics n_import = row_count;
  end if;
  perform audit.end();
  if n_manual + n_import = 0 and not exists (
       select 1 from finance.invoice i where i.deleted_at is null and norm.fold(i.ref) = key
         and (select m.partner_id from finance.partner_match(i.id) m limit 1) is not distinct from p_partner)
     and not exists (
       select 1 from work.import_record x where x.deleted_at is null and x.partner_id = p_partner
         and x.kind in ('transaction', 'invoice') and norm.fold(coalesce(x.transaction_ref, x.invoice_ref)) = key) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return pg_catalog.jsonb_build_object('number', num, 'deal_type', p_type, 'changed', n_manual + n_import, 'request_id', req);
end
$function$;

CREATE OR REPLACE FUNCTION finance.tender_client_id_set(p_tender uuid, p_identifier uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
  t pipeline.tender;
  d partner.identifier;
  req uuid;
begin
  select * into t from pipeline.tender x where x.id = p_tender and x.deleted_at is null for update;
  if t.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  -- Landing 56: the tender's organisation is the writer's own client (or the writer holds Full).
  perform finance.require_own_partner(t.partner_id);
  if p_identifier is not null then
    select * into d from partner.identifier x where x.id = p_identifier and x.deleted_at is null;
    if d.id is null or d.kind <> 'payments_client_id' or d.subkind is distinct from 'tender'
       or d.partner_id <> t.partner_id then
      raise exception using errcode = 'P0001', message = 'finance.tender_client_id_invalid';
    end if;
  end if;
  if t.client_identifier_id is not distinct from p_identifier then
    return pg_catalog.jsonb_build_object('id', t.id, 'request_id', null);
  end if;
  req := audit.begin('ui', 'finance.tender_client_id_set',
                     pg_catalog.jsonb_build_object('tender', t.number, 'client_id', d.value_raw), p_reason);
  begin
    perform audit.write_fields('pipeline.tender', t.id, pg_catalog.jsonb_build_object('client_identifier_id', p_identifier));
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'finance.tender_client_id_taken';
  end;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', t.id, 'request_id', req);
end
$function$;

-- the last-saved record on New invoice: read by everyone who may type one
CREATE OR REPLACE FUNCTION finance.last_saved()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
begin
  return (
    select pg_catalog.jsonb_build_object(
             'invoice_id', i.id, 'ref', i.ref, 'kind', i.kind, 'status', i.status_raw, 'pay_state', sm.maps_to,
             'created_on', i.created_on, 'paid_on', i.paid_on, 'total_sar', i.total_sar, 'saved_at', i.created_at)
    from finance.invoice i
    left join finance.status_map sm on sm.id = i.status_id
    where i.deleted_at is null and i.source = 'manual' and i.created_by = me
    -- two saves in one moment are told apart by the change log's own order
    order by i.created_at desc,
             (select pg_catalog.max(c.id) from audit.change c
              where c.table_name = 'finance.invoice' and c.row_id = i.id and c.action = 'insert') desc nulls last,
             i.id desc
    limit 1);
end
$function$;

-- ---------------------------------------------------------------- importing keeps its own extra
-- The import doors asked for Finance at Full beside the extra finance.import. With a team member at Own that would
-- have taken importing from a member whose record says "Allowed". The extra decides who imports (an admin and a head
-- by role, or a person set to Allowed; never a Viewer); the level they ask for is now Own or above.
CREATE OR REPLACE FUNCTION work.import_require()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require_capability('finance.import');
begin
  if not core.extra_access(me, 'finance.import') then
    raise exception using errcode = '42501', message = 'access.needs_capability',
      detail = pg_catalog.jsonb_build_object('capability', 'finance.import')::text;
  end if;
  -- Landing 51, 56: importing writes Finance, so it needs Finance at Own or above at every door — who imports is
  -- decided by the extra above, not by the level.
  perform authz.require('finance', 'own');
end
$function$;

comment on function work.import_require() is 'Landing 40, 51, 56: importing needs the extra finance.import (Admin and Head by role, or a person set to Allowed; never a Viewer) and Finance at Own or above.';
CREATE OR REPLACE FUNCTION work.import_batch_start(p_partner uuid, p_signature text, p_file_name text, p_source_promo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
  partner_row partner.partner;
  batch_id uuid;
  req uuid;
begin
  if p_partner is null or p_signature is null or nullif(pg_catalog.btrim(coalesce(p_file_name, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  if p_signature not in ('invoice_export', 'transaction_expense_export', 'promo_code_invoice_export',
    'corporate_transaction_list', 'corporate_clients_export', 'revenue_report_export') then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'signature';
  end if;
  select * into partner_row from partner.partner where id = p_partner and deleted_at is null;
  if partner_row.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if partner_row.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'partner_archived';
  end if;
  req := audit.begin('ui', 'import.started', pg_catalog.jsonb_build_object('file', p_file_name));
  insert into work.import_batch (partner_id, signature, file_name, source_promo, created_by)
    values (p_partner, p_signature, p_file_name, p_source_promo, me) returning id into batch_id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('id', batch_id, 'partner_id', p_partner, 'signature', p_signature,
    'file_name', p_file_name, 'status', 'draft');
end
$function$;

CREATE OR REPLACE FUNCTION work.import_apply(p_batch uuid, p_rows jsonb, p_held jsonb DEFAULT '[]'::jsonb, p_decisions jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
  batch work.import_batch;
  r jsonb;
  s jsonb;
  settled jsonb;
  out_rows jsonb := '[]'::jsonb;
  held jsonb := coalesce(p_held, '[]'::jsonb);
  answer jsonb;
  added int := 0;
  repeated int := 0;
  kept jsonb := '[]'::jsonb;
begin
  if p_batch is not null and p_rows is not null and pg_catalog.jsonb_typeof(p_rows) = 'array' then
    select * into batch from work.import_batch where id = p_batch and deleted_at is null;
  end if;
  -- anything the old statement refuses, it refuses in its own words
  if batch.id is null or batch.status <> 'draft' then
    return work.import_apply_core(p_batch, p_rows, p_held, p_decisions);
  end if;
  settled := work.expense_settle(batch.partner_id,
    coalesce((select pg_catalog.jsonb_agg(x) from pg_catalog.jsonb_array_elements(p_rows) x where x ->> 'kind' = 'expense'), '[]'::jsonb));
  for r in select value from pg_catalog.jsonb_array_elements(p_rows) loop
    if r ->> 'kind' = 'expense' then
      select x into s from pg_catalog.jsonb_array_elements(settled) x
        where x -> 'row_no' = r -> 'row_no'
          and x ->> 'transaction_ref' = pg_catalog.btrim(coalesce(r ->> 'transaction_ref', ''))
        limit 1;
      if s is not null and (s ->> 'held')::boolean then
        held := held || pg_catalog.jsonb_build_object('row_no', (r ->> 'row_no')::int,
          'reason', 'An expense is keyed to a transaction number, never to a tax invoice number: held for a person');
        continue;
      end if;
      if s is not null and s ? 'keys' and (s ->> 'cost') is not null then
        r := pg_catalog.jsonb_set(r, '{cost}', s -> 'cost');
        kept := kept || s;
        added := added + (s ->> 'added')::int;
        repeated := repeated + (s ->> 'repeated')::int;
      end if;
    end if;
    out_rows := out_rows || r;
  end loop;
  answer := work.import_apply_core(p_batch, out_rows, held, p_decisions);
  if pg_catalog.jsonb_array_length(kept) > 0 then
    perform audit.begin('ui', 'import.expense_keys', pg_catalog.jsonb_build_object('count', added));
    update work.import_record x
      set expense_keys = array(select pg_catalog.jsonb_array_elements_text(k.s -> 'keys')),
          updated_at = now(), updated_by = me, version = x.version + 1
      from (select value as s from pg_catalog.jsonb_array_elements(kept)) k
      where x.partner_id = batch.partner_id and x.deleted_at is null and x.transaction_ref = k.s ->> 'transaction_ref'
        and x.expense_keys is distinct from array(select pg_catalog.jsonb_array_elements_text(k.s -> 'keys'));
    perform audit.end();
  end if;
  return answer || pg_catalog.jsonb_build_object('expense_lines',
    pg_catalog.jsonb_build_object('added', added, 'repeated', repeated));
end
$function$;

CREATE OR REPLACE FUNCTION work.import_apply_core(p_batch uuid, p_rows jsonb, p_held jsonb DEFAULT '[]'::jsonb, p_decisions jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := authz.require('finance', 'own');
  batch work.import_batch;
  r jsonb;
  held_row jsonb;
  row_no int;
  row_kind text;
  txn text;
  inv text;
  old work.import_record;
  group_row work.import_record;
  group_count int;
  changed boolean;
  outcome text;
  counts_new int := 0;
  counts_updated int := 0;
  counts_unchanged int := 0;
  counts_excluded int := 0;
  counts_needs int := 0;
  apply_problems jsonb := '[]'::jsonb;
  merged_amount numeric(19, 2);
  merged_wallet numeric(19, 2);
  merged_cost numeric(19, 2);
  merged_tax text;
  merged_date date;
  merged_status text;
  merged_fully boolean;
  merged_prov boolean;
  merged_txn text;
  merged_inv text;
  merged_promo text;
  merged_product text;
  merged_gate text;
  merged_url text;
  merged_ref text;
  merged_kind text;
  merged_revenue numeric(19, 2);
  merged_profit numeric(19, 2);
  any_changed boolean;
  req uuid;
begin
  if p_batch is null or p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  select * into batch from work.import_batch where id = p_batch and deleted_at is null;
  if batch.id is null then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if batch.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'batch_confirmed';
  end if;
  if batch.signature = 'promo_code_invoice_export' and batch.source_promo is null then
    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'source_promo_required';
  end if;

  req := audit.begin('ui', 'import.confirmed', pg_catalog.jsonb_build_object('batch', p_batch));
  for r in select value from pg_catalog.jsonb_array_elements(p_rows) loop
    row_no := nullif((r ->> 'row_no'), '')::int;
    row_kind := r ->> 'kind';
    txn := nullif(pg_catalog.btrim(coalesce(r ->> 'transaction_ref', '')), '');
    inv := nullif(pg_catalog.btrim(coalesce(r ->> 'invoice_ref', '')), '');

    -- The normaliser holds key-less rows; one arriving here is a caller bug, not a row.
    if ((row_kind = 'invoice' or row_kind = 'promo') and inv is null)
      or ((row_kind = 'transaction' or row_kind = 'expense') and txn is null) then
      raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'missing_key';
    end if;

    -- A duplicate inside the file is skipped unless the person chose to keep it.
    if coalesce((r ->> 'duplicate')::boolean, false)
      and coalesce(p_decisions ->> coalesce(row_no::text, ''), 'skip') <> 'keep' then
      counts_unchanged := counts_unchanged + 1;
      continue;
    end if;

    if row_kind = 'invoice' then
      -- Its own invoice-only row first.
      select * into old from work.import_record
        where partner_id = batch.partner_id and deleted_at is null and work.import_record.kind <> 'promo'
          and transaction_ref is null and invoice_ref = inv;
      if old.id is not null then
        merged_amount := coalesce((r ->> 'amount')::numeric, old.amount_sar);
        merged_wallet := coalesce((r ->> 'wallet_topup')::numeric, old.wallet_topup_sar);
        merged_tax := coalesce(nullif(r ->> 'tax_no', ''), old.tax_no);
        merged_date := coalesce((r ->> 'record_date')::date, old.record_date);
        merged_status := coalesce(nullif(r ->> 'status_text', ''), old.status_text);
        merged_fully := coalesce((r ->> 'fully_paid')::boolean, old.fully_paid);
        merged_prov := coalesce((r ->> 'provisional')::boolean, old.provisional);
        merged_revenue := case when merged_amount is null then null else merged_amount - merged_wallet end;
        merged_profit := case when merged_revenue is null or old.cost_sar is null then null
          else merged_revenue - old.cost_sar end;
        changed := old.amount_sar is distinct from merged_amount or old.wallet_topup_sar is distinct from merged_wallet
          or old.tax_no is distinct from merged_tax or old.record_date is distinct from merged_date
          or old.status_text is distinct from merged_status or old.fully_paid is distinct from merged_fully
          or old.provisional is distinct from merged_prov;
        update work.import_record set amount_sar = merged_amount, wallet_topup_sar = merged_wallet,
          tax_no = merged_tax, record_date = merged_date, status_text = merged_status, fully_paid = merged_fully,
          provisional = merged_prov, revenue_sar = merged_revenue, profit_sar = merged_profit,
          missing_transaction = true, missing_invoice = false, cost_pending = old.cost_sar is null,
          needs_linking = true, updated_at = now(), updated_by = me, version = version + 1 where id = old.id;
        if not changed then counts_unchanged := counts_unchanged + 1;
        else counts_needs := counts_needs + 1; end if;
        continue;
      end if;
      -- Else transaction rows already carrying this invoice number (the group case):
      -- fill tax number and status, never overwrite their amounts.
      select pg_catalog.count(*) into group_count from work.import_record
        where partner_id = batch.partner_id and deleted_at is null and transaction_ref is not null and invoice_ref = inv;
      if group_count > 0 then
        any_changed := false;
        for group_row in select * from work.import_record
          where partner_id = batch.partner_id and deleted_at is null and transaction_ref is not null and invoice_ref = inv loop
          merged_tax := coalesce(nullif(r ->> 'tax_no', ''), group_row.tax_no);
          merged_date := coalesce(group_row.record_date, (r ->> 'record_date')::date);
          merged_status := coalesce(nullif(r ->> 'status_text', ''), group_row.status_text);
          merged_fully := coalesce((r ->> 'fully_paid')::boolean, group_row.fully_paid);
          merged_prov := coalesce((r ->> 'provisional')::boolean, group_row.provisional);
          merged_amount := coalesce(group_row.amount_sar, (r ->> 'amount')::numeric);
          merged_wallet := case when group_count = 1 and group_row.wallet_topup_sar = 0
            then coalesce((r ->> 'wallet_topup')::numeric, 0) else group_row.wallet_topup_sar end;
          if group_row.amount_sar is not null and (r ->> 'amount')::numeric is not null
            and group_row.amount_sar <> (r ->> 'amount')::numeric then
            apply_problems := apply_problems || pg_catalog.jsonb_build_object('row_no', row_no,
              'reason', 'Invoice total differs from the stored transaction amount: transaction amount kept, held for a person');
          end if;
          changed := group_row.tax_no is distinct from merged_tax or group_row.record_date is distinct from merged_date
            or group_row.status_text is distinct from merged_status or group_row.fully_paid is distinct from merged_fully
            or group_row.provisional is distinct from merged_prov or group_row.amount_sar is distinct from merged_amount
            or group_row.wallet_topup_sar is distinct from merged_wallet;
          if changed then any_changed := true; end if;
          merged_revenue := case when merged_amount is null then null else merged_amount - merged_wallet end;
          merged_profit := case when merged_revenue is null or group_row.cost_sar is null then null
            else merged_revenue - group_row.cost_sar end;
          update work.import_record set tax_no = merged_tax, record_date = merged_date, status_text = merged_status,
            fully_paid = merged_fully, provisional = merged_prov, amount_sar = merged_amount,
            wallet_topup_sar = merged_wallet, revenue_sar = merged_revenue, profit_sar = merged_profit,
            missing_transaction = false, missing_invoice = false, cost_pending = group_row.cost_sar is null,
            needs_linking = false, updated_at = now(), updated_by = me, version = version + 1 where id = group_row.id;
        end loop;
        if any_changed then counts_updated := counts_updated + 1; else counts_unchanged := counts_unchanged + 1; end if;
        continue;
      end if;
      -- Else a brand-new invoice-only row, flagged until its transaction arrives.
      merged_amount := (r ->> 'amount')::numeric;
      merged_wallet := coalesce((r ->> 'wallet_topup')::numeric, 0);
      merged_revenue := case when merged_amount is null then null else merged_amount - merged_wallet end;
      insert into work.import_record (partner_id, batch_id, kind, invoice_ref, tax_no, record_date, amount_sar,
        wallet_topup_sar, status_text, fully_paid, audit_required, provisional, direct_url, direct_ref,
        revenue_sar, profit_sar, missing_transaction, missing_invoice, cost_pending, needs_linking, created_by)
        values (batch.partner_id, batch.id, 'invoice', inv, nullif(r ->> 'tax_no', ''),
          (r ->> 'record_date')::date, merged_amount, merged_wallet, nullif(r ->> 'status_text', ''),
          coalesce((r ->> 'fully_paid')::boolean, false), coalesce((r ->> 'audit_required')::boolean, false),
          coalesce((r ->> 'provisional')::boolean, false), nullif(r ->> 'direct_url', ''),
          nullif(r ->> 'direct_ref', ''), merged_revenue, null, true, false, true, true, me);
      counts_needs := counts_needs + 1;
      continue;
    end if;

    if row_kind = 'transaction' then
      select * into old from work.import_record
        where partner_id = batch.partner_id and deleted_at is null and transaction_ref = txn;
      if old.id is null and inv is not null then
        -- Progressive fill: an invoice-only row waiting for this transaction.
        select * into old from work.import_record
          where partner_id = batch.partner_id and deleted_at is null and work.import_record.kind <> 'promo'
            and transaction_ref is null and invoice_ref = inv;
        if old.id is not null then
          merged_amount := coalesce((r ->> 'amount')::numeric, old.amount_sar);
          merged_wallet := old.wallet_topup_sar;
          merged_date := coalesce((r ->> 'record_date')::date, old.record_date);
          merged_product := coalesce(nullif(r ->> 'product', ''), old.product);
          merged_gate := coalesce(nullif(r ->> 'expense_gate', ''), old.expense_gate);
          merged_revenue := case when merged_amount is null then null else merged_amount - merged_wallet end;
          merged_profit := case when merged_revenue is null or old.cost_sar is null then null
            else merged_revenue - old.cost_sar end;
          update work.import_record set kind = 'transaction', transaction_ref = txn, amount_sar = merged_amount,
            record_date = merged_date, product = merged_product, expense_gate = merged_gate,
            direct_url = coalesce(nullif(r ->> 'direct_url', ''), old.direct_url),
            direct_ref = coalesce(nullif(r ->> 'direct_ref', ''), old.direct_ref),
            revenue_sar = merged_revenue, profit_sar = merged_profit, missing_transaction = false,
            missing_invoice = false, cost_pending = old.cost_sar is null, needs_linking = false,
            updated_at = now(), updated_by = me, version = version + 1 where id = old.id;
          counts_updated := counts_updated + 1;
          continue;
        end if;
      end if;
      if old.id is not null then
        merged_amount := coalesce((r ->> 'amount')::numeric, old.amount_sar);
        merged_inv := coalesce(inv, old.invoice_ref);
        merged_date := coalesce((r ->> 'record_date')::date, old.record_date);
        merged_product := coalesce(nullif(r ->> 'product', ''), old.product);
        merged_gate := coalesce(nullif(r ->> 'expense_gate', ''), old.expense_gate);
        merged_revenue := case when merged_amount is null then null else merged_amount - old.wallet_topup_sar end;
        merged_profit := case when merged_revenue is null or old.cost_sar is null then null
          else merged_revenue - old.cost_sar end;
        changed := old.amount_sar is distinct from merged_amount or old.invoice_ref is distinct from merged_inv
          or old.record_date is distinct from merged_date or old.product is distinct from merged_product
          or old.expense_gate is distinct from merged_gate;
        -- Filling an invoice number that an invoice-only row already holds is a clash:
        -- both rows stay, flagged, and nobody merges by guess.
        if old.invoice_ref is null and merged_inv is not null and exists (select 1 from work.import_record
          where partner_id = batch.partner_id and deleted_at is null and work.import_record.kind <> 'promo' and id <> old.id
            and transaction_ref is null and invoice_ref = merged_inv) then
          apply_problems := apply_problems || pg_catalog.jsonb_build_object('row_no', row_no,
            'reason', 'Invoice number is already on another row: held for a person, nothing merged by guess');
        end if;
        update work.import_record set kind = 'transaction', amount_sar = merged_amount, invoice_ref = merged_inv,
          record_date = merged_date, product = merged_product, expense_gate = merged_gate,
          revenue_sar = merged_revenue, profit_sar = merged_profit, missing_transaction = false,
          missing_invoice = merged_inv is null, cost_pending = old.cost_sar is null,
          needs_linking = merged_inv is null, updated_at = now(), updated_by = me, version = version + 1 where id = old.id;
        if not changed then counts_unchanged := counts_unchanged + 1;
        elsif merged_inv is null then counts_needs := counts_needs + 1;
        else counts_updated := counts_updated + 1; end if;
        continue;
      end if;
      merged_amount := (r ->> 'amount')::numeric;
      merged_revenue := merged_amount; -- wallet part is 0 on a list row
      insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date,
        amount_sar, wallet_topup_sar, product, expense_gate, direct_url, direct_ref, revenue_sar, profit_sar,
        missing_transaction, missing_invoice, cost_pending, needs_linking, created_by)
        values (batch.partner_id, batch.id, 'transaction', txn, inv, (r ->> 'record_date')::date,
          merged_amount, 0, nullif(r ->> 'product', ''), nullif(r ->> 'expense_gate', ''),
          nullif(r ->> 'direct_url', ''), nullif(r ->> 'direct_ref', ''), merged_revenue, null,
          false, inv is null, true, inv is null, me);
      if inv is null then counts_needs := counts_needs + 1; else counts_new := counts_new + 1; end if;
      continue;
    end if;

    if row_kind = 'expense' then
      select * into old from work.import_record
        where partner_id = batch.partner_id and deleted_at is null and transaction_ref = txn;
      if old.id is not null then
        merged_cost := (r ->> 'cost')::numeric;
        changed := old.cost_sar is distinct from merged_cost;
        merged_revenue := old.revenue_sar;
        merged_profit := case when merged_revenue is null or merged_cost is null then null
          else merged_revenue - merged_cost end;
        update work.import_record set cost_sar = merged_cost, profit_sar = merged_profit,
          cost_pending = merged_cost is null, updated_at = now(), updated_by = me, version = version + 1 where id = old.id;
        if not changed then counts_unchanged := counts_unchanged + 1;
        elsif old.invoice_ref is null then counts_needs := counts_needs + 1;
        else counts_updated := counts_updated + 1; end if;
        continue;
      end if;
      insert into work.import_record (partner_id, batch_id, kind, transaction_ref, record_date, cost_sar,
        direct_ref, missing_transaction, missing_invoice, cost_pending, needs_linking, created_by)
        values (batch.partner_id, batch.id, 'expense', txn, (r ->> 'record_date')::date, (r ->> 'cost')::numeric,
          txn, false, true, false, true, me);
      counts_needs := counts_needs + 1;
      continue;
    end if;

    if row_kind = 'promo' then
      -- Invoice-only row first, else one single transaction row. Several transaction
      -- rows sharing the invoice number own no single code link: a holding, plus a clash.
      select * into old from work.import_record
        where partner_id = batch.partner_id and deleted_at is null and work.import_record.kind <> 'promo'
          and transaction_ref is null and invoice_ref = inv;
      if old.id is null then
        select pg_catalog.count(*) into group_count from work.import_record
          where partner_id = batch.partner_id and deleted_at is null and transaction_ref is not null and invoice_ref = inv;
        if group_count = 1 then
          select * into old from work.import_record
            where partner_id = batch.partner_id and deleted_at is null and transaction_ref is not null and invoice_ref = inv;
        elsif group_count > 1 then
          apply_problems := apply_problems || pg_catalog.jsonb_build_object('row_no', row_no,
            'reason', 'Invoice number covers several transactions, so no single row owns this code link: held for a person');
        end if;
      end if;
      if old.id is not null then
        if old.source_promo is not null and old.source_promo <> batch.source_promo then
          apply_problems := apply_problems || pg_catalog.jsonb_build_object('row_no', row_no,
            'reason', 'Already linked to another discount code, kept as it was');
          counts_unchanged := counts_unchanged + 1;
          continue;
        end if;
        changed := old.source_promo is distinct from batch.source_promo
          or old.attribution_promo is distinct from true;
        update work.import_record set source_promo = batch.source_promo, attribution_promo = true,
          promo_before_sar = coalesce(old.promo_before_sar, (r ->> 'promo_before')::numeric),
          promo_discount_sar = coalesce(old.promo_discount_sar, (r ->> 'promo_discount')::numeric),
          promo_after_sar = coalesce(old.promo_after_sar, (r ->> 'promo_after')::numeric),
          updated_at = now(), updated_by = me, version = version + 1 where id = old.id;
        if changed then counts_updated := counts_updated + 1; else counts_unchanged := counts_unchanged + 1; end if;
        continue;
      end if;
      insert into work.import_record (partner_id, batch_id, kind, invoice_ref, source_promo, attribution_promo,
        promo_before_sar, promo_discount_sar, promo_after_sar, product, status_text, fully_paid, audit_required,
        direct_url, direct_ref, missing_transaction, missing_invoice, cost_pending, needs_linking, created_by)
        values (batch.partner_id, batch.id, 'promo', inv, batch.source_promo, true,
          (r ->> 'promo_before')::numeric, (r ->> 'promo_discount')::numeric, (r ->> 'promo_after')::numeric,
          nullif(r ->> 'product', ''), nullif(r ->> 'status_text', ''),
          coalesce((r ->> 'fully_paid')::boolean, false), coalesce((r ->> 'audit_required')::boolean, false),
          nullif(r ->> 'direct_url', ''), nullif(r ->> 'direct_ref', ''), true, false, true, true, me);
      counts_needs := counts_needs + 1;
      continue;
    end if;

    raise exception using errcode = 'P0001', message = 'common.invalid', detail = 'kind';
  end loop;

  for held_row in select value from pg_catalog.jsonb_array_elements(coalesce(p_held, '[]'::jsonb)) loop
    counts_excluded := counts_excluded + 1;
    apply_problems := apply_problems || pg_catalog.jsonb_build_object('row_no', (held_row ->> 'row_no')::int,
      'reason', held_row ->> 'reason');
  end loop;

  update work.import_batch set status = 'confirmed',
    counts = pg_catalog.jsonb_build_object('new', counts_new, 'updated', counts_updated,
      'unchanged', counts_unchanged, 'excluded', counts_excluded, 'needs_linking', counts_needs),
    problems = apply_problems, updated_at = now(), updated_by = me, version = version + 1 where id = batch.id;
  perform audit.end();
  return pg_catalog.jsonb_build_object('batch_id', batch.id,
    'counts', pg_catalog.jsonb_build_object('new', counts_new, 'updated', counts_updated,
      'unchanged', counts_unchanged, 'excluded', counts_excluded, 'needs_linking', counts_needs),
    'problems', apply_problems);
end
$function$;

CREATE OR REPLACE FUNCTION work.import_expense_preview(p_partner uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform authz.require('finance', 'own');
  if p_partner is null or not exists (select 1 from partner.partner where id = p_partner and deleted_at is null) then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  if p_rows is null or pg_catalog.jsonb_typeof(p_rows) <> 'array' then
    raise exception using errcode = 'P0001', message = 'common.invalid';
  end if;
  return work.expense_settle(p_partner, p_rows);
end
$function$;

-- ---------------------------------------------------------------- the role
update core.role_page_level set level = 'own'
where page_key in ('finance', 'partner_finance') and deleted_at is null and level = 'full'
  and role_id in (select id from core.role where key = 'member');
