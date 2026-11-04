-- Workstream A, 4 Nov 2026: the company page's Codes and Finance tabs and its Files section, plus the
-- All files archive. The file upload itself reuses the existing doors (core.file_begin / file_finish /
-- core.files) — no new file table. What is new here:
--   * three file kinds the company Files section offers (agreement already exists): the commercial
--     registration, the VAT certificate and the national address. Their sensitivity is normal, so a teammate
--     who may open the company may see them; agreements stay restricted, as seeded.
--   * partner.company_summary: one read for a company's Finance tab — its wallet roll-up, its counted
--     (Fully Paid) revenue / cost / profit with the two Provisional flags, its discount codes with their
--     counted totals, and its tenders with invoiced, remaining and actual profit. A reader without Finance
--     view gets nulls for the money parts, never zeros.
--   * partner.company_files: every file linked to a company, for the archive view, filtered by company
--     and by file kind. Only files the reader may see are listed.
-- Two gaps are left open on purpose, and the screen says so instead of filling them in:
--   * Held: no workspace table records a wallet hold, so held and available are null (never 0).
--   * Expected cost: a tender carries no expected-cost field, so expected profit is null (never guessed).
-- Forward-only.

-- ================================================================ the three company file kinds
insert into core.file_kind (key, name_en, name_ar, name_pattern_en, name_pattern_ar, sensitivity, review_required, sort)
values
  ('cr_certificate', 'Commercial registration', 'السجل التجاري',
   'Commercial registration · {partner} · {date}', 'السجل التجاري · {partner} · {date}', 'normal', false, 32),
  ('vat_certificate', 'VAT certificate', 'شهادة ضريبة القيمة المضافة',
   'VAT certificate · {partner} · {date}', 'شهادة ضريبة القيمة المضافة · {partner} · {date}', 'normal', false, 34),
  ('national_address', 'National address', 'العنوان الوطني',
   'National address · {partner} · {date}', 'العنوان الوطني · {partner} · {date}', 'normal', false, 36)
on conflict (key) do nothing;

-- ================================================================ one company's money, codes and tenders
create function partner.company_summary(p_partner uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := authz.require('partners', 'view');
  finance_visible boolean := authz.level_of(me, 'finance') >= 'view';
  found boolean;
begin
  select exists (select 1 from partner.partner p where p.id = p_partner and p.deleted_at is null) into found;
  if not found then
    raise exception using errcode = 'P0002', message = 'common.not_found';
  end if;
  return pg_catalog.jsonb_build_object(
    'partner_id', p_partner,
    'finance_visible', finance_visible,
    'wallet', case when finance_visible then (
      select pg_catalog.jsonb_build_object(
        'topped_up', coalesce(sum(f.total_sar) filter (where f.kind = 'wallet_topup'), 0),
        'wallet_spent', coalesce(sum(f.wallet_sar) filter (where f.kind <> 'wallet_topup'), 0),
        'invoiced_total', coalesce(sum(f.total_sar) filter (where f.kind <> 'wallet_topup'), 0),
        -- The wallet's own balance: paid top-ups less the wallet part of paid invoices (the existing
        -- finance.partner_wallet meaning). All invoice totals are shown apart, never mixed into it.
        'balance', coalesce(sum(f.total_sar) filter (where f.kind = 'wallet_topup'), 0)
                   - coalesce(sum(f.wallet_sar) filter (where f.kind <> 'wallet_topup'), 0),
        -- No workspace table records a hold, so held — and available, which needs it — stay empty.
        'held', null,
        'available', null)
      from finance.invoice_fact f where f.partner_id = p_partner and f.pay_state = 'paid') end,
    'finance', case when finance_visible then (
      select pg_catalog.jsonb_build_object(
        'units', pg_catalog.count(*) filter (where r.counted),
        'revenue', coalesce(sum(r.revenue) filter (where r.counted), 0),
        -- Missing cost stays empty, never 0: only approved (non-Provisional) cost is summed, and when
        -- every counted unit is still Provisional the sum is null. Profit needs cost, so it is empty too.
        'cost', sum(r.cost) filter (where r.counted and not r.provisional),
        'profit', case when sum(r.cost) filter (where r.counted and not r.provisional) is null then null
                        else coalesce(sum(r.revenue) filter (where r.counted), 0)
                             - sum(r.cost) filter (where r.counted and not r.provisional) end,
        'provisional_units', pg_catalog.count(*) filter (where r.counted and r.provisional),
        'provisional_revenue', coalesce(sum(r.revenue) filter (where r.counted and r.provisional), 0),
        -- Provisional, as two flags: cost still pending, and tax invoices still waiting to be issued
        -- (a counted unit whose invoice carries no DPIN yet). The row itself is kept either way.
        'cost_pending', exists (select 1 from finance.money_row x
                                where x.counted and x.partner_id = p_partner and x.provisional),
        'waiting_for_issuing', exists (select 1 from finance.money_row x
                                       join finance.invoice_fact f on f.id = x.invoice_id
                                       where x.counted and x.partner_id = p_partner and f.dpin is null),
        'waiting_count', (select pg_catalog.count(distinct x.invoice_id) from finance.money_row x
                          join finance.invoice_fact f on f.id = x.invoice_id
                          where x.counted and x.partner_id = p_partner and f.dpin is null))
      from finance.money_row r where r.partner_id = p_partner) end,
    'codes', case when finance_visible then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'code', s.code, 'units', sum(s.units), 'revenue', sum(s.revenue), 'profit', sum(s.profit))
               order by sum(s.revenue) desc)
      from finance.sales_by_code s where s.partner_id = p_partner), '[]'::jsonb) end,
    'tenders', case when finance_visible then coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', u.tender_id, 'number', u.number, 'title', u.title,
               'state', case when u.signed_on is null then 'applied' else 'signed' end,
               'signed_on', u.signed_on, 'client_id_named', u.client_identifier_id is not null,
               'tender_amount', u.signed_value,
               'invoiced', case when u.signed_on is not null then u.consumed end,
               'remaining', case when u.signed_on is not null then greatest(u.signed_value - u.consumed, 0) end,
               'units', case when u.signed_on is not null then u.units end,
               -- Approved cost on the tender's own client ID; empty while every unit is Provisional.
               'approved_cost', (select sum(r.cost) from finance.money_row r
                                 join finance.invoice i on i.id = r.invoice_id
                                 join partner.identifier d on d.id = u.client_identifier_id
                                   and d.deleted_at is null and d.value_key = i.client_id_key
                                 where r.counted and not r.provisional),
               'cost_pending', exists (select 1 from finance.money_row r
                                       join finance.invoice i on i.id = r.invoice_id
                                       join partner.identifier d on d.id = u.client_identifier_id
                                         and d.deleted_at is null and d.value_key = i.client_id_key
                                       where r.counted and r.provisional),
               'actual_profit', case when u.signed_on is null then null
                 when (select sum(r.cost) from finance.money_row r
                       join finance.invoice i on i.id = r.invoice_id
                       join partner.identifier d on d.id = u.client_identifier_id
                         and d.deleted_at is null and d.value_key = i.client_id_key
                       where r.counted and not r.provisional) is null then null
                 else u.consumed - (select sum(r.cost) from finance.money_row r
                                    join finance.invoice i on i.id = r.invoice_id
                                    join partner.identifier d on d.id = u.client_identifier_id
                                      and d.deleted_at is null and d.value_key = i.client_id_key
                                    where r.counted and not r.provisional) end,
               -- No expected-cost field exists on a tender, so expected profit is never guessed.
               'expected_cost', null,
               'expected_profit', null)
               order by u.signed_on desc nulls last, u.number)
      from finance.tender_use u where u.partner_id = p_partner), '[]'::jsonb) end);
end
$$;

-- ================================================================ every company file, for the archive
create function partner.company_files(p_partner uuid default null, p_kind text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform authz.require('partners', 'view');
  return coalesce((
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'id', f.id, 'link_id', l.id, 'partner_id', p.id, 'partner_name', p.trade_name_en,
             'partner_name_ar', p.trade_name_ar, 'kind', k.key, 'kind_en', k.name_en, 'kind_ar', k.name_ar,
             'purpose', l.purpose, 'side', l.side,
             'display_name_en', core.file_display_name(f.id, 'en'),
             'display_name_ar', core.file_display_name(f.id, 'ar'),
             'original_name', f.original_name, 'mime', f.mime, 'size_bytes', f.size_bytes,
             'sensitivity', f.sensitivity, 'status', f.status,
             'added_by', f.created_by, 'added_at', f.created_at)
             order by p.trade_name_en, f.created_at desc, f.id)
    from core.file_link l
    join core.file f on f.id = l.file_id
    join core.file_kind k on k.id = f.kind_id
    join partner.partner p on p.id = l.entity_id
    where l.entity_table = 'partner.partner' and l.deleted_at is null and f.deleted_at is null
      and p.deleted_at is null and authz.file_visible(f.id)
      and (p_partner is null or l.entity_id = p_partner)
      and (p_kind is null or k.key = p_kind)), '[]'::jsonb);
end
$$;

create function api.company_summary(p_partner uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$ select partner.company_summary(p_partner) $$;
create function api.company_files(p_partner uuid default null, p_kind text default null) returns jsonb
language sql stable security invoker set search_path = '' as $$ select partner.company_files(p_partner, p_kind) $$;

revoke all on function partner.company_summary(uuid), partner.company_files(uuid, text) from public;
grant execute on function partner.company_summary(uuid), partner.company_files(uuid, text) to authenticated;
revoke all on function api.company_summary(uuid), api.company_files(uuid, text) from public;
grant execute on function api.company_summary(uuid), api.company_files(uuid, text) to authenticated;
