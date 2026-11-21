-- Landing 35 — the money rows are worked out once per read, and each row costs a fraction of what it did
-- (owner's live sweep, 21 Nov 2026: the partner Finance tab and the Finance page cut at 8 s on ~150 invoices).
--
-- What was slow, measured on a profiling database of live-like size (150 invoices, 168 lines):
--   1. finance.money_row was worked out again for EVERY mention of it in a read — twice in the ledger, three
--      times in the organisation summary, twelve in a code's detail, and once per code in the codes list (58
--      times for 22 codes) — and each mention was also planned again, a deep stack of views (124 ms of planning
--      alone on live).
--   2. Each invoice in it cost about 0.8 ms: the helper functions it calls per row — finance.partner_match
--      (three times per invoice), finance.exclusion_of, finance.is_wallet_line, measure.client_segment — were
--      SQL-language functions with a pinned search_path, which Postgres plans again on every call, and the
--      wallet and commission wording was folded (norm.fold, a regular-expression pass) again for every line
--      against every word.
--
-- What changes — the ANSWERS do not: every figure, flag and row is what it was.
--   a. The per-row helpers are the same queries in plpgsql, which keeps a statement's plan for the connection.
--   b. The wallet and commission words are folded once per read (finance.wallet_words(), commission_words(),
--      wallet_product_ids()), and a line's name once per line. finance.is_wallet_line() reads the same lists, so
--      there is still one definition of "a wallet line".
--   c. The line flags of an invoice (wallet part, commission, no supplier cost) are their own light view,
--      finance.invoice_flags. finance.invoice_fact and finance.invoice_cost both read it, so the cost view no
--      longer drags the whole fact view — and its partner match — along a second time.
--   d. finance.money_row keeps its name and columns, but is now `select * from finance.money_rows()`: a
--      function that reads the full definition (kept as finance.money_row_calc: the same text, the live units
--      taken once for both of its halves) with ONE kept plan per connection, worked out once per mention in a
--      read however the read joins to it. A change to the money rows from here on is made in
--      finance.money_row_calc. The organisation's client type is looked up once per unit; it was looked up
--      once per client TYPE per unit, inside the filter that names the type.
-- Checked on the profiling databases (150 and 1,500 invoices): every one of these views returns the same rows
-- before and after, and 519 reads of the whole api (three roles) answer the same JSON.
-- No grant changes: the new views and functions are internal, like the views they sit beside (no request role
-- holds anything on them). No api signature changes, so database.types.ts is unchanged.

-- ---------------------------------------------------------------- a. the per-row helpers keep their plans

create or replace function finance.partner_match(p_invoice uuid)
  returns table (partner_id uuid, state text, level text)
language plpgsql stable security definer set search_path = '' as $$
begin
  return query
  select coalesce(p.partner_id, u.partner_id), case when p.id is not null then 'matched' else u.state end,
         case when p.id is not null then 'pin' else u.level end
  from finance.partner_match_unpinned(p_invoice) u
  left join partner.match_pin p on p.source_table = 'finance.invoice' and p.source_id = p_invoice and p.deleted_at is null;
end
$$;

create or replace function measure.client_segment(p_partner uuid) returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  return (select s.type_id from partner.partner_side s
          where s.partner_id = p_partner and s.side = 'client' and s.deleted_at is null
          order by s.created_at desc limit 1);
end
$$;

-- The rule that takes this invoice out, if any: the same rules in the same order. The organisation the invoice
-- matches is read once — it was read once per rule — and only when a rule that needs it is reached.
create or replace function finance.exclusion_of(p_invoice uuid) returns finance.exclusion_rule
language plpgsql stable security definer set search_path = '' as $$
declare
  x finance.exclusion_rule;
begin
  with m as materialized (select pm.partner_id from finance.partner_match(p_invoice) pm)
  select r.* into x from finance.exclusion_rule r
  join finance.invoice i on i.id = p_invoice
  where r.deleted_at is null
    and (r.partner_id is null or r.partner_id = (select m.partner_id from m))
    and case r.kind
          when 'client_id' then i.client_id_key = r.value_key
          when 'tax_no' then i.tax_key = r.value_key
                             or exists (select 1 from partner.identifier d where d.deleted_at is null and d.kind in ('vat', 'cr')
                                        and d.value_key = r.value_key and d.partner_id = (select m.partner_id from m))
          when 'discount_code' then i.code_key = r.value_key
          when 'invoice' then norm.fold(i.ref) = r.value_key
          when 'product' then norm.fold(i.product_raw) = r.value_key
                              or exists (select 1 from finance.invoice_line l where l.invoice_id = i.id and l.deleted_at is null
                                         and norm.fold(l.product_raw) = r.value_key)
          when 'name' then i.client_id_key is null and (i.name_key = r.value_key or i.name2_key = r.value_key)
          when 'partner' then (select m.partner_id from m) is not null
                              and r.value_key = norm.fold((select p.number from partner.partner p
                                                           where p.id = (select m.partner_id from m)))
          else false end
  order by case r.mode when 'hide' then 0 else 1 end, r.created_at
  limit 1;
  if not found then
    return null;
  end if;
  return x;
end
$$;

-- ---------------------------------------------------------------- b. the wallet and commission words, folded once

create function finance.wallet_product_ids() returns uuid[]
language sql stable set search_path = '' as $$
  select coalesce(pg_catalog.array_agg(w.product_id), '{}'::uuid[])
  from finance.wallet_rule w
  where w.deleted_at is null and w.active and w.kind = 'product' and w.product_id is not null
$$;
comment on function finance.wallet_product_ids() is
  'The products a live wallet rule names (V617). Read once per query: write it as (select finance.wallet_product_ids()).';

create function finance.wallet_words() returns text[]
language sql stable set search_path = '' as $$
  select coalesce(pg_catalog.array_agg(k.word), '{}'::text[])
  from finance.wallet_rule w
  cross join lateral (values (norm.fold(w.name_en)), (norm.fold(w.name_ar))) k(word)
  where w.deleted_at is null and w.active and w.kind = 'name_contains' and k.word is not null
$$;
comment on function finance.wallet_words() is
  'The folded words of the live "name contains" wallet rules, both languages (V617). Read once per query.';

create function finance.commission_words() returns text[]
language sql stable set search_path = '' as $$
  select coalesce(pg_catalog.array_agg(k.word), '{}'::text[])
  from finance.commission_word w
  cross join lateral (values (norm.fold(w.name_en)), (norm.fold(w.name_ar))) k(word)
  where w.deleted_at is null and w.active and k.word is not null
$$;
comment on function finance.commission_words() is
  'The folded live commission words, both languages. Read once per query.';

create or replace function finance.is_wallet_line(p_product uuid, p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  line_key text;
begin
  if coalesce(p_product = any (finance.wallet_product_ids()), false) then
    return true;
  end if;
  line_key := norm.fold(p_name);
  if line_key is null then
    return false;
  end if;
  return exists (select 1 from pg_catalog.unnest(finance.wallet_words()) k where pg_catalog.strpos(line_key, k) > 0);
end
$$;

-- ---------------------------------------------------------------- c. an invoice's line flags, one light view

create view finance.invoice_flags with (security_invoker = true) as
select i.id,
       i.kind,
       coalesce(ln.line_total, 0::numeric) as line_total,
       coalesce(ln.wallet_sar, 0::numeric) as wallet_sar,
       coalesce(pr.commission, false) or coalesce(ln.commission, false) as commission,
       coalesce(ln.all_no_supplier_cost, pr.no_supplier_cost, false) as no_supplier_cost
from finance.invoice i
left join finance.product pr on pr.id = i.product_id
left join lateral (
  select sum(l.total_sar) as line_total,
         sum(l.total_sar) filter (where
           coalesce(l.product_id = any ((select finance.wallet_product_ids())::uuid[]), false)
           or exists (select 1 from unnest((select finance.wallet_words())::text[]) k where strpos(lk.key, k) > 0)) as wallet_sar,
         bool_or(coalesce(lp.commission, false)
                 or exists (select 1 from unnest((select finance.commission_words())::text[]) k
                            where strpos(lk.key, k) > 0)) as commission,
         bool_and(coalesce(lp.no_supplier_cost, false)) as all_no_supplier_cost
  from finance.invoice_line l
  left join finance.product lp on lp.id = l.product_id
  cross join lateral (select norm.fold(l.name) as key offset 0) lk
  where l.invoice_id = i.id and l.deleted_at is null) ln on true
where i.deleted_at is null;
comment on view finance.invoice_flags is
  'What an invoice''s lines say about it: their total, the wallet part (V617), commission, no supplier cost. Read by finance.invoice_fact and finance.invoice_cost.';

create or replace view finance.invoice_fact with (security_invoker = true) as
 SELECT i.id,
    i.ref,
    i.kind,
    i.created_on,
    i.month_on,
    i.paid_on,
    i.total_sar,
    i.source,
    i.payments_as_of,
    i.figure_state,
    i.code_key,
    s.maps_to AS pay_state,
    COALESCE(s.audit_required, false) AS audit_required,
    ch.key AS channel,
    COALESCE(ch.credits_owner, false) AS channel_credits_owner,
    fl.line_total,
    fl.wallet_sar,
    fl.commission,
    fl.no_supplier_cost,
    bl.billing_invoice_id,
    ti.dpin,
    ti.total_sar AS dpin_total,
    m.partner_id,
    m.state AS match_state,
    m.level AS match_level
   FROM finance.invoice i
     JOIN finance.invoice_flags fl ON fl.id = i.id
     LEFT JOIN finance.status_map s ON s.id = i.status_id
     LEFT JOIN finance.channel ch ON ch.id = i.channel_id
     LEFT JOIN finance.billing_link bl ON bl.transaction_invoice_id = i.id AND bl.deleted_at IS NULL
     LEFT JOIN finance.tax_invoice ti ON ti.parent_invoice_id = i.id AND ti.deleted_at IS NULL
     LEFT JOIN LATERAL finance.partner_match(i.id) m(partner_id, state, level) ON true
  WHERE i.deleted_at IS NULL;

-- the cost of a unit: the same rules, read off the line flags; the estimate setting is looked up once per read
create or replace view finance.invoice_cost with (security_invoker = true) as
 SELECT f.id,
        CASE
            WHEN f.no_supplier_cost THEN 0::numeric
            ELSE COALESCE(e.approved_sar, 0::numeric)
        END AS cost_sar,
    COALESCE(e.approved_count, 0::bigint) AS approved_count,
    COALESCE(e.pending_count, 0::bigint) AS pending_count,
        CASE
            WHEN f.no_supplier_cost THEN 'no_supplier_cost'::text
            WHEN COALESCE(e.approved_count, 0::bigint) > 0 THEN 'approved'::text
            WHEN f.commission THEN 'commission'::text
            WHEN est.sar IS NOT NULL THEN 'line_estimate'::text
            ELSE 'none'::text
        END AS cost_basis,
        CASE
            WHEN f.no_supplier_cost THEN 'ready'::text
            WHEN COALESCE(e.pending_count, 0::bigint) > 0 OR (i.expense_status = ANY (ARRAY['pending'::text, 'under_review'::text])) THEN 'provisional'::text
            WHEN COALESCE(e.approved_count, 0::bigint) > 0 OR (i.expense_status = ANY (ARRAY['approved'::text, 'issued'::text])) THEN 'ready'::text
            ELSE 'provisional'::text
        END AS cost_status,
    est.sar AS estimate_sar
   FROM finance.invoice_flags f
     JOIN finance.invoice i ON i.id = f.id
     LEFT JOIN LATERAL ( SELECT sum(x.amount_sar) FILTER (WHERE x.status = ANY (ARRAY['approved'::text, 'issued'::text])) AS approved_sar,
            count(*) FILTER (WHERE x.status = ANY (ARRAY['approved'::text, 'issued'::text])) AS approved_count,
            count(*) FILTER (WHERE x.status = ANY (ARRAY['pending'::text, 'under_review'::text])) AS pending_count
           FROM finance.expense_line x
          WHERE x.invoice_id = f.id AND x.deleted_at IS NULL) e ON true
     LEFT JOIN LATERAL ( SELECT sum(l.total_sar) AS sar
           FROM finance.invoice_line l
             JOIN finance.item_class k ON k.item_key = finance.item_tail(l.name) AND k.class = 'pass_through'::text AND k.active AND k.deleted_at IS NULL
          WHERE l.invoice_id = f.id AND l.deleted_at IS NULL AND NOT f.no_supplier_cost AND NOT f.commission AND COALESCE(e.approved_count, 0::bigint) = 0 AND (SELECT COALESCE((core.setting_at('finance.cost_estimate'::text, NULL::uuid, core.riyadh_today()) #>> '{}'::text[])::boolean, true))) est ON true
  WHERE f.kind = ANY (ARRAY['transaction'::text, 'standalone'::text]);

-- a line's service: the wallet test reads the same word lists, folded once per read
create or replace view finance.line_service with (security_invoker = true) as
 SELECT l.id AS line_id,
    l.invoice_id,
    l.line_no,
    l.name,
    l.total_sar,
    COALESCE(l.product_id = ANY ((SELECT finance.wallet_product_ids())::uuid[]), false) OR (EXISTS ( SELECT 1
           FROM unnest((SELECT finance.wallet_words())::text[]) k(k)
          WHERE strpos(norm.fold(l.name), k.k) > 0)) AS wallet,
    s.id AS service_id,
    COALESCE(s.counts_as_income, true) AS counts_as_income,
        CASE
            WHEN ls.id IS NOT NULL THEN 'line'::text
            WHEN its.id IS NOT NULL THEN 'item'::text
            WHEN ps.id IS NOT NULL THEN 'product'::text
            ELSE NULL::text
        END AS mapped_by
   FROM finance.invoice_line l
     JOIN finance.invoice i ON i.id = l.invoice_id AND i.deleted_at IS NULL
     LEFT JOIN finance.service ls ON ls.id = l.service_id AND ls.deleted_at IS NULL AND (i.source = 'manual'::text OR (l.src ->> '_row'::text) = 'person'::text OR (l.src ->> 'service_id'::text) = 'person'::text OR (l.src ->> 'product_id'::text) = 'person'::text)
     LEFT JOIN finance.item_service it ON it.item_key = finance.item_head(l.name) AND it.active AND it.deleted_at IS NULL
     LEFT JOIN finance.service its ON its.id = it.service_id AND its.deleted_at IS NULL
     LEFT JOIN finance.product p ON p.id = l.product_id AND p.deleted_at IS NULL
     LEFT JOIN finance.service ps ON ps.id = p.service_id AND ps.deleted_at IS NULL
     LEFT JOIN finance.service s ON s.id = COALESCE(ls.id, its.id, ps.id)
  WHERE l.deleted_at IS NULL;

-- the live units: as they stood (20261113120000), with the organisation's client type looked up once per unit —
-- it was looked up once per client TYPE per unit (twelve times a row), inside the filter that names the type
create or replace view finance.money_row_live with (security_invoker = true) as
 WITH units AS (
         SELECT f.id AS invoice_id,
            f.kind AS unit_kind,
            f.ref,
            f.dpin,
            f.partner_id,
            f.match_state,
            f.month_on,
            f.created_on,
            f.paid_on,
            f.channel,
            f.channel_credits_owner,
            f.pay_state,
            f.audit_required,
            f.commission,
            f.total_sar - f.wallet_sar AS revenue,
            c.cost_sar AS cost,
            c.cost_status,
            f.code_key,
            c.estimate_sar AS estimate
           FROM finance.invoice_fact f
             JOIN finance.invoice_cost c ON c.id = f.id
        UNION ALL
         SELECT b.id,
            'monthly_fee'::text,
            b.ref,
            b.dpin,
            b.partner_id,
            b.match_state,
            b.month_on,
            b.created_on,
            b.paid_on,
            b.channel,
            b.channel_credits_owner,
            b.pay_state,
            b.audit_required,
            false,
            b.total_sar - t.linked_sar,
            0::numeric AS "numeric",
            'ready'::text,
            b.code_key,
            NULL::numeric AS "numeric"
           FROM finance.invoice_fact b
             JOIN LATERAL ( SELECT sum(x_1.total_sar) AS linked_sar
                   FROM finance.billing_link l
                     JOIN finance.invoice x_1 ON x_1.id = l.transaction_invoice_id
                  WHERE l.billing_invoice_id = b.id AND l.deleted_at IS NULL AND x_1.deleted_at IS NULL) t ON true
          WHERE b.kind = 'billing'::text AND t.linked_sar IS NOT NULL AND b.total_sar > t.linked_sar AND NOT (EXISTS ( SELECT 1
                   FROM finance.billing_proposal p
                  WHERE p.billing_invoice_id = b.id AND p.deleted_at IS NULL AND p.state = 'open'::text))
        )
 SELECT u.invoice_id,
    u.unit_kind,
    u.ref,
    u.dpin,
    u.partner_id,
    u.match_state,
    u.month_on,
    date_trunc('quarter'::text, u.month_on::timestamp without time zone)::date AS quarter_on,
    u.created_on,
    u.paid_on,
    u.channel,
    u.channel_credits_owner,
    u.pay_state,
    u.pay_state = 'paid'::text AS paid,
    u.audit_required,
    u.commission,
    COALESCE(((norm.fold(inv.status_raw) = ANY (ARRAY['invoice fully paid'::text, 'fully paid'::text, 'fully paid receivables'::text, 'fully paid audit required'::text, 'paid'::text])) OR u.pay_state = 'paid'::text OR (bil.billing_word = ANY (ARRAY['invoice fully paid'::text, 'fully paid'::text, 'fully paid receivables'::text, 'fully paid audit required'::text, 'paid'::text])) OR bil.billing_maps_to = 'paid'::text OR (bl.billing_invoice_id IS NOT NULL AND bil.billing_total IS NOT NULL AND br.received >= bil.billing_total OR bl.billing_invoice_id IS NULL AND inv.total_sar IS NOT NULL AND ur.received >= inv.total_sar) AND (COALESCE(norm.fold(inv.status_raw), ''::text) <> ALL (ARRAY['draft'::text, 'cancelled'::text, 'void'::text, 'partially paid'::text, 'waiting'::text, 'unpaid'::text, 'overdue'::text, 'issued waiting for settlement'::text])) AND (COALESCE(bil.billing_word, ''::text) <> ALL (ARRAY['draft'::text, 'cancelled'::text, 'void'::text, 'partially paid'::text, 'waiting'::text, 'unpaid'::text, 'overdue'::text, 'issued waiting for settlement'::text])) OR (bl.billing_invoice_id IS NOT NULL AND bil.billing_total IS NOT NULL AND (bil.billing_total - br.received) = 0::numeric OR bl.billing_invoice_id IS NULL AND inv.total_sar IS NOT NULL AND (inv.total_sar - ur.received) = 0::numeric) AND (COALESCE(norm.fold(inv.status_raw), ''::text) <> ALL (ARRAY['draft'::text, 'cancelled'::text, 'void'::text, 'partially paid'::text, 'waiting'::text, 'unpaid'::text, 'overdue'::text, 'issued waiting for settlement'::text])) AND (COALESCE(bil.billing_word, ''::text) <> ALL (ARRAY['draft'::text, 'cancelled'::text, 'void'::text, 'partially paid'::text, 'waiting'::text, 'unpaid'::text, 'overdue'::text, 'issued waiting for settlement'::text]))) AND x.id IS NULL, false) AS counted,
    x.kind AS excluded_by,
    x.reason AS excluded_reason,
    u.revenue,
    u.cost,
    u.cost_status,
    u.cost_status = 'provisional'::text AS provisional,
    u.revenue - u.cost AS profit,
    (u.revenue - u.cost) < 0::numeric AS loss,
    u.unit_kind = 'monthly_fee'::text AS fee_on_monthly_invoice,
    COALESCE(pt.subkind,
        CASE
            WHEN u.code_key IS NOT NULL THEN 'code'::text
            ELSE NULL::text
        END) AS payment_type,
    u.estimate,
    ( SELECT t.key
           FROM partner.side_type t
          WHERE t.id = sg.segment_id) AS segment,
    sg.segment_id
   FROM units u
     CROSS JOIN LATERAL ( SELECT measure.client_segment(u.partner_id) AS segment_id
         OFFSET 0) sg
     LEFT JOIN LATERAL finance.exclusion_of(u.invoice_id) x(id, kind, value_raw, value_key, mode, reason, created_at, created_by, updated_at, updated_by, version, deleted_at, deleted_by, delete_reason) ON x.id IS NOT NULL
     LEFT JOIN LATERAL ( SELECT d.subkind
           FROM finance.invoice i
             JOIN partner.identifier d ON d.deleted_at IS NULL AND d.kind = 'payments_client_id'::text AND d.value_key = i.client_id_key
          WHERE i.id = u.invoice_id
         LIMIT 1) pt ON true
     LEFT JOIN LATERAL ( SELECT i.status_raw,
            i.total_sar
           FROM finance.invoice i
          WHERE i.id = u.invoice_id) inv ON true
     LEFT JOIN LATERAL ( SELECT bl_1.billing_invoice_id
           FROM finance.billing_link bl_1
          WHERE bl_1.transaction_invoice_id = u.invoice_id AND bl_1.deleted_at IS NULL
         LIMIT 1) bl ON true
     LEFT JOIN LATERAL ( SELECT bi.total_sar AS billing_total,
            norm.fold(bi.status_raw) AS billing_word,
            bsm.maps_to AS billing_maps_to
           FROM finance.invoice bi
             LEFT JOIN finance.status_map bsm ON bsm.id = bi.status_id
          WHERE bi.id = bl.billing_invoice_id) bil ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(r.amount_sar), 0::numeric) AS received
           FROM finance.receipt r
          WHERE r.deleted_at IS NULL AND r.invoice_id = u.invoice_id) ur ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(r.amount_sar), 0::numeric) AS received
           FROM finance.receipt r
          WHERE r.deleted_at IS NULL AND r.invoice_id = bl.billing_invoice_id) br ON true
  WHERE x.mode IS DISTINCT FROM 'hide'::text;

-- ---------------------------------------------------------------- d. the money rows, worked out once per mention

-- The full definition of the money rows, as it stood (20261012095000), with the live units read once for both of
-- its halves (the rows as they are, and the closed months' rows that no longer exist).
create view finance.money_row_calc with (security_invoker = true) as
 WITH live AS MATERIALIZED (
         SELECT l.*
           FROM finance.money_row_live l
        ), closed AS (
         SELECT c.month
           FROM finance.month_close c
          WHERE c.deleted_at IS NULL
        ), snap AS (
         SELECT c.month,
            (e.value ->> 'invoice_id'::text)::uuid AS invoice_id,
            e.value ->> 'unit_kind'::text AS unit_kind,
            e.value ->> 'ref'::text AS ref,
            (e.value ->> 'revenue'::text)::numeric AS revenue,
            (e.value ->> 'cost'::text)::numeric AS cost,
            e.value ->> 'cost_status'::text AS cost_status,
            e.value ? 'partner_id'::text AS kept_who,
            (e.value ->> 'partner_id'::text)::uuid AS partner_id,
            (e.value ->> 'channel_credits_owner'::text)::boolean AS channel_credits_owner,
            e.value ? 'segment_id'::text AS kept_segment,
            (e.value ->> 'segment_id'::text)::uuid AS segment_id
           FROM finance.month_close c
             CROSS JOIN LATERAL jsonb_array_elements(c.snapshot) e(value)
          WHERE c.deleted_at IS NULL
        )
 SELECT r.invoice_id,
    r.unit_kind,
    r.ref,
    r.dpin,
        CASE
            WHEN s.kept_who THEN s.partner_id
            ELSE r.partner_id
        END AS partner_id,
    r.match_state,
    r.month_on,
    r.quarter_on,
    r.created_on,
    r.paid_on,
    r.channel,
        CASE
            WHEN s.kept_who THEN s.channel_credits_owner
            ELSE r.channel_credits_owner
        END AS channel_credits_owner,
    r.pay_state,
    r.paid,
    r.audit_required,
    r.commission,
        CASE
            WHEN cl.month IS NULL THEN r.counted
            ELSE s.invoice_id IS NOT NULL
        END AS counted,
    r.excluded_by,
    r.excluded_reason,
        CASE
            WHEN s.invoice_id IS NULL THEN r.revenue
            ELSE s.revenue
        END AS revenue,
        CASE
            WHEN s.invoice_id IS NULL THEN r.cost
            ELSE s.cost
        END AS cost,
        CASE
            WHEN s.invoice_id IS NULL THEN r.cost_status
            ELSE s.cost_status
        END AS cost_status,
        CASE
            WHEN s.invoice_id IS NULL THEN r.provisional
            ELSE s.cost_status = 'provisional'::text
        END AS provisional,
        CASE
            WHEN s.invoice_id IS NULL THEN r.profit
            ELSE s.revenue - s.cost
        END AS profit,
        CASE
            WHEN s.invoice_id IS NULL THEN r.loss
            ELSE (s.revenue - s.cost) < 0::numeric
        END AS loss,
    r.fee_on_monthly_invoice,
    r.payment_type,
    r.estimate,
    ( SELECT t.key
           FROM partner.side_type t
          WHERE t.id = g.segment_id) AS segment,
    g.segment_id
   FROM live r
     LEFT JOIN closed cl ON cl.month = r.month_on
     LEFT JOIN snap s ON s.month = r.month_on AND s.invoice_id = r.invoice_id AND s.unit_kind = r.unit_kind
     CROSS JOIN LATERAL ( SELECT
                CASE
                    WHEN s.kept_segment THEN s.segment_id
                    WHEN s.kept_who THEN measure.client_segment(s.partner_id)
                    ELSE r.segment_id
                END AS segment_id
        OFFSET 0) g
UNION ALL
 SELECT s.invoice_id,
    s.unit_kind,
    s.ref,
    NULL::text AS dpin,
    s.partner_id,
    NULL::text AS match_state,
    s.month AS month_on,
    date_trunc('quarter'::text, s.month::timestamp without time zone)::date AS quarter_on,
    NULL::date AS created_on,
    NULL::date AS paid_on,
    NULL::text AS channel,
    s.channel_credits_owner,
    NULL::text AS pay_state,
    true AS paid,
    NULL::boolean AS audit_required,
    NULL::boolean AS commission,
    true AS counted,
    NULL::text AS excluded_by,
    NULL::text AS excluded_reason,
    s.revenue,
    s.cost,
    s.cost_status,
    s.cost_status = 'provisional'::text AS provisional,
    s.revenue - s.cost AS profit,
    (s.revenue - s.cost) < 0::numeric AS loss,
    s.unit_kind = 'monthly_fee'::text AS fee_on_monthly_invoice,
    NULL::text AS payment_type,
    NULL::numeric AS estimate,
    ( SELECT t.key
           FROM partner.side_type t
          WHERE t.id =
                CASE
                    WHEN s.kept_segment THEN s.segment_id
                    ELSE measure.client_segment(s.partner_id)
                END) AS segment,
        CASE
            WHEN s.kept_segment THEN s.segment_id
            ELSE measure.client_segment(s.partner_id)
        END AS segment_id
   FROM snap s
  WHERE NOT (EXISTS ( SELECT 1
           FROM live r
          WHERE r.month_on = s.month AND r.invoice_id = s.invoice_id AND r.unit_kind = s.unit_kind));
comment on view finance.money_row_calc is
  'The definition of the money rows (V610-V620). Read it through finance.money_row; change the money rows here.';

create function finance.money_rows() returns setof finance.money_row_calc
language plpgsql stable set search_path = '' set jit = off as $$
begin
  return query select c.* from finance.money_row_calc c;
end
$$;
comment on function finance.money_rows() is
  'finance.money_row_calc with one kept plan per connection, worked out once per mention in a query (Landing 35).';

create or replace view finance.money_row with (security_invoker = true) as
select r.* from finance.money_rows() r;
