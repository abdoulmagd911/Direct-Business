-- ================================================================
-- TEST SEED — Commercial Workspace, two full years of TEST data
-- File: seed-test-dataset-2026-11-19.sql
-- Date: 19 Nov 2026. Run ONLY after the test round reports (it checks
-- Finance against the current live values) and only on the LIVE
-- Supabase project (project ref kimadjvaxgiqzjaukuqg), as the postgres
-- owner. NEVER on a local/dev database that holds real data.
--
--   psql "$V2_DB_URL" -v ON_ERROR_STOP=1 \
--     -f ~/workspace/commercial-workspace-review/egm-test/seed-test-dataset-2026-11-19.sql
--
-- WHAT IT MAKES (all TEST-labelled, every name starts with "TEST"):
--   30 partners ("TEST Seed Company 01".."30"), 70 client IDs
--     (1 prepaid + 1 postpaid each, + 1 tender for partners 1-10),
--     VAT for partners 1-10, CR for partners 11-20, 45 contacts,
--     15 contracts (10 with terms), 10 credit limits
--   20 discount codes (TEST-FLIGHTS/HOTELS/VISA/JOURNEY-01..05),
--     20 code terms, 20 code attributions
--   140 invoices: 80 transactions (the "bookings" — there is NO
--     booking table in the schema; a transaction IS a booking, a
--     travel sale with a 10-digit Payments ref) + 60 standalone
--     invoices; the 45 costed ones each carry a DPIN
--     (finance.tax_invoice) of total minus cost, the 15 cost-less
--     or unpaid ones carry none
--   160 invoice lines, 135 expense lines, 125 receipts,
--     60 code uses (one per costed transaction — every code is
--     USED, 3 times each)
--   40 tasks (30 client + 10 internal), 10 helpers, 20 action
--     items, 8 comments, 30 status changes, 10 booking task refs
--   30 achievements, 10 participants, 10 achievement refs
--   69 targets (plans 2025 + 2026 x CONTRACT/MOU/COST x months)
-- Dates spread Jan 2025 – Nov 2026, clamped to today (19 Nov 2026)
-- so no future-date guard fires. Money is deterministic and round:
-- cost = 60% of each costed invoice. See the verification block at
-- the end for the expected totals.
--
-- EXPECTED FINANCE TOTALS AFTER SEEDING (Finance Overview,
-- period_figures — Revenue counts everything Fully Paid;
-- Cost and Profit count only costed rows; Provisional is the
-- cost-less Fully Paid revenue, shown apart):
--   2025 full year: Revenue 148,600 / Cost 74,880 / Profit 49,920
--     / Provisional 23,800
--   2026 year to date: Revenue 343,400 / Cost 176,400
--     / Profit 117,600 / Provisional 49,400
--   Seed all-time: Revenue 492,000 / Cost 251,280 / Profit 167,520
--     / Provisional 73,200
--   With the live figures that were there before the seed
--     (YTD 2026: 8,550 / 870 / 3,480 / 4,200):
--     YTD 2026 becomes 351,950 / 177,270 / 121,080 / 53,600
--     All-time becomes 500,550 / 252,150 / 171,000 / 77,400
--   Discount recorded across the 60 code uses: 7,500 SAR. It does
--   NOT reduce revenue: the SQL has no NET = Total Sales - Total
--   Discount subtraction; total_sar is the net amount the customer
--   paid and the discount is recorded on finance.code_use and on
--   the invoice line.
--
-- IDEMPOTENCY: the script fails closed if any partner named
-- "TEST Seed Company%" or any invoice with ref 9000000% already
-- exists. Run the companion wipe script first to re-seed:
--   wipe-test-dataset-2026-11-19.sql
-- It also fails if any month in Jan 2025 – Nov 2026 is closed
-- (a closed month is frozen: seeded rows in it would not show in
-- the totals, so the expected figures above would not hold).
--
-- HOW IT WRITES: direct SQL as the postgres owner, one
-- transaction — failure rolls everything back. It uses the
-- schema's own helpers (norm.key, core.next_number,
-- core.format_number, perf.number_for, finance.receipt_key,
-- partner.names_sync) and lets the triggers do their work
-- (invoice_guard keys, identifier guards, achievement guard).
-- It deliberately bypasses the app's audit/history (no Activity
-- entries for the seed) — the owner's explicit seed order
-- overrides D17 ("only a person creates records") for TEST data.
--
-- OPEN QUESTIONS (not invented here):
--   * "QR codes": no QR table or concept exists in any of the 279
--     migrations — nothing was seeded for it.
--   * "Bookings": no booking table exists. The 80 transactions
--     ARE the bookings (kind='transaction', 10-digit ref), and 10
--     tasks carry a booking task_ref to one of them.
--   * partner.side_tier has no seeded values in any migration, so
--     side tiers are left null.
--   * perf.achievement.service_id / origin_report_id are plain
--     uuids with no FK in any migration — left null.
-- ================================================================
\set ON_ERROR_STOP on

BEGIN;

-- ================================================================
-- 0. Pre-checks — fail closed, before anything is inserted.
-- ================================================================
DO $pre$
DECLARE
  v_closed text;
  v_code_collision text;
  v_missing text;
BEGIN
  -- Already applied? (the wipe script removes these markers first)
  IF EXISTS (SELECT 1 FROM partner.partner p
             WHERE p.deleted_at IS NULL AND p.trade_name_en LIKE 'TEST Seed Company%') THEN
    RAISE EXCEPTION 'TEST seed already applied: partners named TEST Seed Company%% exist. Run wipe-test-dataset-2026-11-19.sql first.';
  END IF;
  IF EXISTS (SELECT 1 FROM finance.invoice i
             WHERE i.deleted_at IS NULL AND i.ref LIKE '9000000%') THEN
    RAISE EXCEPTION 'TEST seed already applied: invoices with ref 9000000%% exist. Run wipe-test-dataset-2026-11-19.sql first.';
  END IF;

  -- Closed months in the seed range would freeze the seeded rows out
  -- of the totals, so the expected figures would not hold.
  SELECT string_agg(c.month::text, ', ' ORDER BY c.month) INTO v_closed
  FROM finance.month_close c
  WHERE c.deleted_at IS NULL
    AND c.month >= DATE '2025-01-01' AND c.month <= DATE '2026-11-01';
  IF v_closed IS NOT NULL THEN
    RAISE EXCEPTION 'Closed month(s) in the seed range: %. Open them first, or the seed totals will not match the expected figures.', v_closed;
  END IF;

  -- TEST people and teams (seeded by core.test_users_seed()).
  IF NOT EXISTS (SELECT 1 FROM core.person p WHERE p.id = core.test_id('person', 1) AND p.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'TEST people are missing (core.test_id person 1 not found). The test-users seed has not run on this database.';
  END IF;
  FOR i IN 2..6 LOOP
    IF NOT EXISTS (SELECT 1 FROM core.person p WHERE p.id = core.test_id('person', i) AND p.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'TEST person % is missing.', i;
    END IF;
  END LOOP;
  FOR i IN 1..5 LOOP
    IF NOT EXISTS (SELECT 1 FROM core.team t WHERE t.id = core.test_id('team', i)) THEN
      RAISE EXCEPTION 'TEST team % is missing.', i;
    END IF;
  END LOOP;

  -- Department, statuses, channel, products, services, side types,
  -- status reasons, priorities, task statuses/types, ref systems.
  IF NOT EXISTS (SELECT 1 FROM core.department d WHERE d.code = 'commercial' AND d.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Department commercial is missing.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM finance.status_map s WHERE s.word = 'Fully Paid' AND s.maps_to = 'paid' AND s.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Status word "Fully Paid" (paid) is missing from finance.status_map.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM finance.status_map s WHERE s.word = 'Pending' AND s.maps_to = 'pending' AND s.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Status word "Pending" (pending) is missing from finance.status_map.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM finance.status_map s WHERE s.word = 'Draft' AND s.maps_to = 'draft' AND s.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Status word "Draft" (draft) is missing from finance.status_map.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM finance.channel c WHERE c.key = 'commercial' AND c.credits_owner AND c.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Channel commercial (credits_owner) is missing.';
  END IF;
  FOREACH v_missing IN ARRAY ARRAY['flights','hotels','visas','transport','packages','insurance'] LOOP
    IF NOT EXISTS (SELECT 1 FROM finance.product p WHERE p.key = v_missing AND p.active AND p.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Product % is missing.', v_missing;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM finance.service s WHERE s.key = v_missing AND s.active AND s.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Service % is missing.', v_missing;
    END IF;
  END LOOP;
  FOREACH v_missing IN ARRAY ARRAY['corporate','government','agencies','individuals'] LOOP
    IF NOT EXISTS (SELECT 1 FROM partner.side_type t WHERE t.side = 'client' AND t.key = v_missing AND t.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Client side type % is missing.', v_missing;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM partner.side_type t WHERE t.side = 'supplier_partner' AND t.key = 'supplier' AND t.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Supplier side type supplier is missing.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM partner.side_status_reason r WHERE r.key = 'price_vs_competitor' AND r.status = 'at_risk' AND r.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Status reason price_vs_competitor is missing.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM partner.side_status_reason r WHERE r.key = 'lost_price_vs_competitor' AND r.status = 'lost' AND r.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Status reason lost_price_vs_competitor is missing.';
  END IF;
  FOREACH v_missing IN ARRAY ARRAY['high','medium','low'] LOOP
    IF NOT EXISTS (SELECT 1 FROM work.priority p WHERE p.key = v_missing AND p.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Priority % is missing.', v_missing;
    END IF;
  END LOOP;
  FOREACH v_missing IN ARRAY ARRAY['not_started','in_progress','done','cancelled'] LOOP
    IF NOT EXISTS (SELECT 1 FROM work.task_status s WHERE s.key = v_missing AND s.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Task status % is missing.', v_missing;
    END IF;
  END LOOP;
  FOREACH v_missing IN ARRAY ARRAY['follow_up','meeting','request','report','other'] LOOP
    IF NOT EXISTS (SELECT 1 FROM work.task_type t WHERE t.key = v_missing AND t.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Task type % is missing.', v_missing;
    END IF;
  END LOOP;
  FOREACH v_missing IN ARRAY ARRAY['booking','ticket','invoice'] LOOP
    IF NOT EXISTS (SELECT 1 FROM work.ref_system r WHERE r.key = v_missing AND r.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Ref system % is missing.', v_missing;
    END IF;
  END LOOP;

  -- Plans for 2025 and 2026 (commercial department) with all seven
  -- achievement categories, active.
  FOR i IN 2025..2026 LOOP
    IF NOT EXISTS (SELECT 1 FROM perf.plan p
                   JOIN core.department d ON d.id = p.department_id
                   WHERE d.code = 'commercial' AND p.year = i AND p.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Plan % for the commercial department is missing.', i;
    END IF;
    IF (SELECT count(*) FROM perf.achievement_category c
        JOIN perf.plan p ON p.id = c.plan_id
        JOIN core.department d ON d.id = p.department_id
        WHERE d.code = 'commercial' AND p.year = i AND c.deleted_at IS NULL
          AND c.active AND c.code IN ('PROBLEM','COST','MOU','CONTRACT','INTEGRATION','CASHBACK','AWARD')) <> 7 THEN
      RAISE EXCEPTION 'Plan % is missing one of the seven achievement categories.', i;
    END IF;
  END LOOP;

  -- Contract terms.
  FOREACH v_missing IN ARRAY ARRAY['corporate_rate','payment_terms','commission'] LOOP
    IF NOT EXISTS (SELECT 1 FROM partner.term t WHERE t.key = v_missing AND t.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Contract term % is missing.', v_missing;
    END IF;
  END LOOP;

  -- No campaign code may hold one of the 20 TEST codes (the
  -- identifier code_guard would refuse the insert).
  SELECT string_agg(c.code_raw, ', ') INTO v_code_collision
  FROM partner.campaign_code c
  WHERE c.deleted_at IS NULL
    AND c.code_key IN (
      SELECT norm.code_key('TEST-' || g || '-' || lpad(kk.v::text, 2, '0'))
      FROM (VALUES ('FLIGHTS'), ('HOTELS'), ('VISA'), ('JOURNEY')) gs(g)
      CROSS JOIN generate_series(1, 5) AS kk(v));
  IF v_code_collision IS NOT NULL THEN
    RAISE EXCEPTION 'Campaign code(s) already hold a TEST code: %.', v_code_collision;
  END IF;

  RAISE NOTICE 'Pre-checks passed: no seed markers, no closed months in Jan 2025-Nov 2026, all lookups present.';
END
$pre$;

-- ================================================================
-- 1. Lookup context — every id resolved once, by key/word, never
--    hardcoded (except TEST person/team ids, which are fixed by
--    core.test_id()).
-- ================================================================
CREATE TEMP TABLE seed_ctx AS
SELECT
  (SELECT d.id FROM core.department d WHERE d.code = 'commercial' AND d.deleted_at IS NULL) AS dept_id,
  (SELECT s.id FROM finance.status_map s WHERE s.word = 'Fully Paid' AND s.deleted_at IS NULL) AS status_paid_id,
  (SELECT s.id FROM finance.status_map s WHERE s.word = 'Pending' AND s.deleted_at IS NULL) AS status_pending_id,
  (SELECT s.id FROM finance.status_map s WHERE s.word = 'Draft' AND s.deleted_at IS NULL) AS status_draft_id,
  (SELECT c.id FROM finance.channel c WHERE c.key = 'commercial' AND c.deleted_at IS NULL) AS channel_id,
  (SELECT p.id FROM finance.product p WHERE p.key = 'flights' AND p.deleted_at IS NULL) AS prod_flights,
  (SELECT p.id FROM finance.product p WHERE p.key = 'hotels' AND p.deleted_at IS NULL) AS prod_hotels,
  (SELECT p.id FROM finance.product p WHERE p.key = 'visas' AND p.deleted_at IS NULL) AS prod_visas,
  (SELECT p.id FROM finance.product p WHERE p.key = 'transport' AND p.deleted_at IS NULL) AS prod_transport,
  (SELECT p.id FROM finance.product p WHERE p.key = 'packages' AND p.deleted_at IS NULL) AS prod_packages,
  (SELECT p.id FROM finance.product p WHERE p.key = 'insurance' AND p.deleted_at IS NULL) AS prod_insurance,
  (SELECT s.id FROM finance.service s WHERE s.key = 'flights' AND s.deleted_at IS NULL) AS svc_flights,
  (SELECT s.id FROM finance.service s WHERE s.key = 'hotels' AND s.deleted_at IS NULL) AS svc_hotels,
  (SELECT s.id FROM finance.service s WHERE s.key = 'visas' AND s.deleted_at IS NULL) AS svc_visas,
  (SELECT s.id FROM finance.service s WHERE s.key = 'transport' AND s.deleted_at IS NULL) AS svc_transport,
  (SELECT s.id FROM finance.service s WHERE s.key = 'packages' AND s.deleted_at IS NULL) AS svc_packages,
  (SELECT s.id FROM finance.service s WHERE s.key = 'insurance' AND s.deleted_at IS NULL) AS svc_insurance,
  (SELECT t.id FROM partner.side_type t WHERE t.side = 'client' AND t.key = 'corporate' AND t.deleted_at IS NULL) AS st_client_corporate,
  (SELECT t.id FROM partner.side_type t WHERE t.side = 'client' AND t.key = 'government' AND t.deleted_at IS NULL) AS st_client_government,
  (SELECT t.id FROM partner.side_type t WHERE t.side = 'client' AND t.key = 'agencies' AND t.deleted_at IS NULL) AS st_client_agencies,
  (SELECT t.id FROM partner.side_type t WHERE t.side = 'client' AND t.key = 'individuals' AND t.deleted_at IS NULL) AS st_client_individuals,
  (SELECT t.id FROM partner.side_type t WHERE t.side = 'supplier_partner' AND t.key = 'supplier' AND t.deleted_at IS NULL) AS st_supplier,
  (SELECT r.id FROM partner.side_status_reason r WHERE r.key = 'price_vs_competitor' AND r.deleted_at IS NULL) AS reason_at_risk_id,
  (SELECT r.id FROM partner.side_status_reason r WHERE r.key = 'lost_price_vs_competitor' AND r.deleted_at IS NULL) AS reason_lost_id,
  (SELECT p.id FROM work.priority p WHERE p.key = 'high' AND p.deleted_at IS NULL) AS pri_high_id,
  (SELECT p.id FROM work.priority p WHERE p.key = 'medium' AND p.deleted_at IS NULL) AS pri_medium_id,
  (SELECT p.id FROM work.priority p WHERE p.key = 'low' AND p.deleted_at IS NULL) AS pri_low_id,
  (SELECT s.id FROM work.task_status s WHERE s.key = 'not_started' AND s.deleted_at IS NULL) AS ts_not_started_id,
  (SELECT s.id FROM work.task_status s WHERE s.key = 'in_progress' AND s.deleted_at IS NULL) AS ts_in_progress_id,
  (SELECT s.id FROM work.task_status s WHERE s.key = 'done' AND s.deleted_at IS NULL) AS ts_done_id,
  (SELECT s.id FROM work.task_status s WHERE s.key = 'cancelled' AND s.deleted_at IS NULL) AS ts_cancelled_id,
  (SELECT t.id FROM work.task_type t WHERE t.key = 'follow_up' AND t.deleted_at IS NULL) AS tt_follow_up_id,
  (SELECT t.id FROM work.task_type t WHERE t.key = 'meeting' AND t.deleted_at IS NULL) AS tt_meeting_id,
  (SELECT t.id FROM work.task_type t WHERE t.key = 'request' AND t.deleted_at IS NULL) AS tt_request_id,
  (SELECT t.id FROM work.task_type t WHERE t.key = 'report' AND t.deleted_at IS NULL) AS tt_report_id,
  (SELECT t.id FROM work.task_type t WHERE t.key = 'other' AND t.deleted_at IS NULL) AS tt_other_id,
  (SELECT r.id FROM work.ref_system r WHERE r.key = 'booking' AND r.deleted_at IS NULL) AS ref_booking_id,
  (SELECT r.id FROM work.ref_system r WHERE r.key = 'ticket' AND r.deleted_at IS NULL) AS ref_ticket_id,
  (SELECT r.id FROM work.ref_system r WHERE r.key = 'invoice' AND r.deleted_at IS NULL) AS ref_invoice_id,
  (SELECT p.id FROM perf.plan p JOIN core.department d ON d.id = p.department_id
    WHERE d.code = 'commercial' AND p.year = 2025 AND p.deleted_at IS NULL) AS plan_2025_id,
  (SELECT p.id FROM perf.plan p JOIN core.department d ON d.id = p.department_id
    WHERE d.code = 'commercial' AND p.year = 2026 AND p.deleted_at IS NULL) AS plan_2026_id,
  (SELECT t.id FROM partner.term t WHERE t.key = 'corporate_rate' AND t.deleted_at IS NULL) AS term_corp_rate_id,
  (SELECT t.id FROM partner.term t WHERE t.key = 'payment_terms' AND t.deleted_at IS NULL) AS term_pay_terms_id,
  (SELECT t.id FROM partner.term t WHERE t.key = 'commission' AND t.deleted_at IS NULL) AS term_commission_id,
  coalesce((core.setting_at('partner.id_format', NULL, core.riyadh_today()) ->> 'prefix'), 'DK-P') AS partner_prefix,
  coalesce((core.setting_at('partner.id_format', NULL, core.riyadh_today()) ->> 'width')::int, 4) AS partner_width;

-- The partners we make, so the later blocks can find them by number.
CREATE TEMP TABLE seed_partners (
  n int PRIMARY KEY,
  id uuid NOT NULL,
  trade_name_en text NOT NULL,
  prepaid text NOT NULL,
  postpaid text NOT NULL,
  side_type_id uuid NOT NULL,
  client_since date NOT NULL
);

-- ================================================================
-- 2. Partners (30) with their sides, statuses, owners, identifiers,
--    contacts, contracts and credit limits.
--    Statuses: 1-24 active, 25 lost, 26-27 at risk, 28-30 prospect.
--    Supplier side for partners 1-10. Tender IDs for partners 1-10,
--    VAT for 1-10, CR for 11-20, email identifiers for 1-10.
-- ================================================================
DO $partners$
DECLARE
  c seed_ctx%ROWTYPE;
  n int;
  pid uuid;
  pnum text;
  pname text;
  pname_ar text;
  pcity text;
  ptype uuid;
  ppri uuid;
  psince date;
  powner uuid;
  pstatus text;
  preason uuid;
  pprepaid text;
  ppostpaid text;
  cid uuid;
BEGIN
  SELECT * INTO c FROM seed_ctx;

  FOR n IN 1..30 LOOP
    pname := 'TEST Seed Company ' || lpad(n::text, 2, '0');
    pname_ar := 'شركة الاختبار ' || n::text;
    pcity := (ARRAY['Riyadh', 'Jeddah', 'Dammam', 'Makkah', 'Madinah'])[((n - 1) % 5) + 1];
    ptype := CASE ((n - 1) % 4)
               WHEN 0 THEN c.st_client_corporate
               WHEN 1 THEN c.st_client_government
               WHEN 2 THEN c.st_client_agencies
               ELSE c.st_client_individuals END;
    ppri := CASE ((n - 1) % 3)
              WHEN 0 THEN c.pri_high_id
              WHEN 1 THEN c.pri_medium_id
              ELSE c.pri_low_id END;
    psince := LEAST(
      CASE WHEN n <= 15
        THEN make_date(2025, ((n - 1) % 12) + 1, ((n * 7) % 28) + 1)
        ELSE make_date(2026, ((n - 16) % 11) + 1, ((n * 7) % 28) + 1) END,
      core.riyadh_today());
    powner := core.test_id('person', ((n - 1) % 6) + 1);
    pprepaid := '900' || lpad(n::text, 2, '0');   -- 9001..9030
    ppostpaid := '910' || lpad(n::text, 2, '0');  -- 9101..9130
    pstatus := CASE WHEN n >= 28 THEN 'prospect'
                    WHEN n IN (26, 27) THEN 'at_risk'
                    WHEN n = 25 THEN 'lost'
                    ELSE 'active' END;
    preason := CASE WHEN n IN (26, 27) THEN c.reason_at_risk_id
                    WHEN n = 25 THEN c.reason_lost_id
                    ELSE NULL END;

    pnum := c.partner_prefix || '-' || lpad(core.next_number('partner', 2000)::text, c.partner_width, '0');
    INSERT INTO partner.partner
      (number, trade_name_en, trade_name_ar, official_name_en, official_name_ar,
       priority_id, key_partner, website, city, country, client_since, created_by)
    VALUES
      (pnum, pname, pname_ar, pname || ' Ltd.', pname_ar,
       ppri, (n % 5 = 0),
       'https://test-seed-' || lpad(n::text, 2, '0') || '.example.test',
       pcity, 'Saudi Arabia', psince, core.test_id('person', 1))
    RETURNING id INTO pid;

    INSERT INTO seed_partners (n, id, trade_name_en, prepaid, postpaid, side_type_id, client_since)
    VALUES (n, pid, pname, pprepaid, ppostpaid, ptype, psince);

    -- Client side (every partner) + Supplier side (partners 1-10).
    INSERT INTO partner.partner_side (partner_id, side, type_id, since, created_by)
    VALUES (pid, 'client', ptype, psince, core.test_id('person', 1));
    IF n <= 10 THEN
      INSERT INTO partner.partner_side (partner_id, side, type_id, since, created_by)
      VALUES (pid, 'supplier_partner', c.st_supplier, psince, core.test_id('person', 1));
    END IF;

    -- Status on the Client side (reason is required for at_risk/lost).
    INSERT INTO partner.side_status_change (partner_id, side, status, reason_id, effective_on, created_by)
    VALUES (pid, 'client', pstatus, preason, psince, core.test_id('person', 1));

    -- Owner on each side the partner has.
    INSERT INTO partner.side_owner (partner_id, side, person_id, effective_from, created_by)
    VALUES (pid, 'client', powner, psince, core.test_id('person', 1));
    IF n <= 10 THEN
      INSERT INTO partner.side_owner (partner_id, side, person_id, effective_from, created_by)
      VALUES (pid, 'supplier_partner', powner, psince, core.test_id('person', 1));
    END IF;

    -- Identifiers. value_key / norm_version use the schema's own
    -- key function with the stop words, exactly as identifier_insert does.
    INSERT INTO partner.identifier
      (partner_id, kind, subkind, value_raw, value_key, norm_version, reason, source, created_by)
    VALUES
      (pid, 'payments_client_id', 'prepaid', pprepaid,
       norm.key('payments_client_id', pprepaid, partner.stop_words()), norm.version(),
       'TEST seed prepaid client ID', 'person', core.test_id('person', 1)),
      (pid, 'payments_client_id', 'postpaid', ppostpaid,
       norm.key('payments_client_id', ppostpaid, partner.stop_words()), norm.version(),
       'TEST seed postpaid client ID', 'person', core.test_id('person', 1));
    IF n <= 10 THEN
      INSERT INTO partner.identifier
        (partner_id, kind, subkind, value_raw, value_key, norm_version, reason, source, created_by)
      VALUES
        (pid, 'payments_client_id', 'tender', '920' || lpad(n::text, 2, '0'),
         norm.key('payments_client_id', '920' || lpad(n::text, 2, '0'), partner.stop_words()), norm.version(),
         'TEST seed tender client ID', 'person', core.test_id('person', 1)),
        (pid, 'vat', NULL, '3000000000000' || lpad(n::text, 2, '0'),
         norm.key('vat', '3000000000000' || lpad(n::text, 2, '0'), partner.stop_words()), norm.version(),
         'TEST seed VAT number', 'person', core.test_id('person', 1)),
        (pid, 'email', NULL, 'contact-' || lpad(n::text, 2, '0') || '@test-seed-' || lpad(n::text, 2, '0') || '.example.test',
         norm.key('email', 'contact-' || lpad(n::text, 2, '0') || '@test-seed-' || lpad(n::text, 2, '0') || '.example.test', partner.stop_words()), norm.version(),
         'TEST seed contact email', 'person', core.test_id('person', 1));
    END IF;
    IF n BETWEEN 11 AND 20 THEN
      INSERT INTO partner.identifier
        (partner_id, kind, subkind, value_raw, value_key, norm_version, reason, source, created_by)
      VALUES
        (pid, 'cr', NULL, '10100000' || lpad(n::text, 2, '0'),
         norm.key('cr', '10100000' || lpad(n::text, 2, '0'), partner.stop_words()), norm.version(),
         'TEST seed CR number', 'person', core.test_id('person', 1));
    END IF;

    -- The name identifiers (trade/official EN/AR), as the app writes them.
    PERFORM partner.names_sync(pid, 'TEST seed');

    -- Contacts: one primary each, a second for partners 1-15.
    INSERT INTO partner.contact
      (partner_id, name_en, name_ar, job_title, email, phone, is_primary, created_by)
    VALUES
      (pid, 'TEST Contact ' || lpad(n::text, 2, '0') || ' A', 'جهة اتصال تجريبية ' || n,
       'Decision Maker',
       'contact-' || lpad(n::text, 2, '0') || '@test-seed-' || lpad(n::text, 2, '0') || '.example.test',
       '+9665000000' || lpad(n::text, 2, '0'), true, core.test_id('person', 1));
    IF n <= 15 THEN
      INSERT INTO partner.contact
        (partner_id, name_en, name_ar, job_title, email, phone, is_primary, created_by)
      VALUES
        (pid, 'TEST Contact ' || lpad(n::text, 2, '0') || ' B', 'جهة اتصال تجريبية ' || n || ' ب',
         'Travel Manager',
         'travel-' || lpad(n::text, 2, '0') || '@test-seed-' || lpad(n::text, 2, '0') || '.example.test',
         '+9665500000' || lpad(n::text, 2, '0'), false, core.test_id('person', 1));
    END IF;

    -- Contracts for partners 1-15; terms for partners 1-5.
    IF n <= 15 THEN
      INSERT INTO partner.contract
        (partner_id, side, kind, title, start_on, end_on, reminders_on, reminder_days, notes, created_by)
      VALUES
        (pid, 'client', 'contract', 'TEST Contract ' || lpad(n::text, 2, '0'),
         psince, psince + INTERVAL '1 year', true, ARRAY[30],
         'TEST seed contract.', core.test_id('person', 1))
      RETURNING id INTO cid;
      IF n <= 5 THEN
        INSERT INTO partner.contract_term (contract_id, term_id, value_before, value_after, created_by)
        VALUES
          (cid, c.term_corp_rate_id, 10, 12, core.test_id('person', 1)),
          (cid, c.term_pay_terms_id, 30, 15, core.test_id('person', 1));
        IF n <= 2 THEN
          INSERT INTO partner.contract_term (contract_id, term_id, value_before, value_after, created_by)
          VALUES (cid, c.term_commission_id, 5, 7, core.test_id('person', 1));
        END IF;
      END IF;
    END IF;

    -- Credit limits for partners 1-10 (Client side only).
    IF n <= 10 THEN
      INSERT INTO partner.credit_limit
        (partner_id, amount_sar, effective_from, approved_by, reason, created_by)
      VALUES
        (pid, 50000 + n * 10000, psince, core.test_id('person', 1),
         'TEST seed credit limit', core.test_id('person', 1));
    END IF;
  END LOOP;

  RAISE NOTICE 'Partners: 30 seeded.';
END
$partners$;

-- The discount codes we make, so the invoice block can use them.
CREATE TEMP TABLE seed_codes (
  idx int PRIMARY KEY,
  id uuid NOT NULL,
  code text NOT NULL,
  grp text NOT NULL,
  discount numeric(14,2) NOT NULL,
  partner_n int NOT NULL,
  service_id uuid NOT NULL
);

-- ================================================================
-- 3. Discount codes (20): one per partner 1-20, valid the whole
--    seed window. FLIGHTS 100 / HOTELS 150 / VISA 50 / JOURNEY 200
--    SAR off when used. Each code gets terms (5% fee) and a promo
--    attribution to its owning partner.
-- ================================================================
DO $codes$
DECLARE
  c seed_ctx%ROWTYPE;
  k int;
  grp text;
  code text;
  disc numeric(14,2);
  pn int;
  svc uuid;
  pid uuid;
  iid uuid;
BEGIN
  SELECT * INTO c FROM seed_ctx;

  FOR k IN 1..20 LOOP
    grp := CASE WHEN k <= 5 THEN 'FLIGHTS'
                WHEN k <= 10 THEN 'HOTELS'
                WHEN k <= 15 THEN 'VISA'
                ELSE 'JOURNEY' END;
    disc := CASE grp WHEN 'FLIGHTS' THEN 100 WHEN 'HOTELS' THEN 150
                     WHEN 'VISA' THEN 50 ELSE 200 END;
    pn := k;  -- code k belongs to partner k (partners 1-20)
    svc := CASE grp WHEN 'FLIGHTS' THEN c.svc_flights
                    WHEN 'HOTELS' THEN c.svc_hotels
                    WHEN 'VISA' THEN c.svc_visas
                    ELSE c.svc_packages END;
    code := 'TEST-' || grp || '-' || lpad(((k - 1) % 5 + 1)::text, 2, '0');
    SELECT id INTO pid FROM seed_partners WHERE n = pn;

    INSERT INTO partner.identifier
      (partner_id, kind, subkind, value_raw, value_key, norm_version,
       reason, source, valid_from, valid_to, created_by)
    VALUES
      (pid, 'discount_code', NULL, code,
       norm.key('discount_code', code, partner.stop_words()), norm.version(),
       'TEST seed discount code', 'person',
       DATE '2025-01-01', DATE '2026-12-31', core.test_id('person', 1))
    RETURNING id INTO iid;

    INSERT INTO seed_codes (idx, id, code, grp, discount, partner_n, service_id)
    VALUES (k, iid, code, grp, disc, pn, svc);

    INSERT INTO partner.code_terms
      (identifier_id, campaign_code_id, fee_percent, services, countries, tiers,
       review_on, approved_by, approved_on, effective_from, created_by)
    VALUES
      (iid, NULL, 5.00, ARRAY[svc], ARRAY['SA'], '[]'::jsonb,
       DATE '2026-12-31', core.test_id('person', 1),
       DATE '2025-01-01', DATE '2025-01-01', core.test_id('person', 1));

    INSERT INTO finance.code_attribution
      (code_id, partner_id, is_promo, reason, created_by)
    VALUES
      (iid, pid, true, 'TEST seed promo attribution', core.test_id('person', 1));
  END LOOP;

  RAISE NOTICE 'Discount codes: 20 seeded (each used 3 times later).';
END
$codes$;

-- The invoices we make, so the task/achievement blocks can point at them.
CREATE TEMP TABLE seed_invoices (
  seq int PRIMARY KEY,
  kind text NOT NULL,
  id uuid NOT NULL,
  ref text NOT NULL,
  total numeric(14,2) NOT NULL,
  created_on date NOT NULL,
  status text NOT NULL,
  partner_n int NOT NULL,
  is_costed boolean NOT NULL,
  code_idx int,
  discount numeric(14,2) NOT NULL DEFAULT 0
);

-- ================================================================
-- 4. Invoices.
--    Transactions (80) are the bookings: a travel sale with a
--    10-digit Payments ref (9000000001..9000000080). Standalone
--    invoices (60) are issued invoices (9000000101..9000000160);
--    the 45 costed ones carry a DPIN = total minus approved cost,
--    the other 15 carry none (no DPIN before the cost is Ready).
--    Status: Fully Paid except Pending (tx 5,25,45,65,75; sa
--    5,20,35,50) and Draft (tx 10,30,50,70; sa 10,40). Only Fully
--    Paid counts in Finance. Provisional (cost not known yet, no
--    expense line): tx 3,8,13,18,23,28,43,48,53,63,68; sa
--    3,8,13,18,23,33,38,48,53. Costed = Fully Paid and not
--    provisional: 60 transactions + 45 standalone. Every costed
--    transaction carries one code use (60 uses, each code 3 times).
--    Cost = 60% of the total; the first 15 costed of each kind
--    split it 40% + 20% across two expense lines. The first 20
--    transactions split their lines into (total-200) + a 200
--    service fee. Receipts cover every Fully Paid invoice in full.
-- ================================================================
DO $invoices$
DECLARE
  c seed_ctx%ROWTYPE;
  today date := core.riyadh_today();
  i int;
  j int;
  pn int;
  prow seed_partners%ROWTYPE;
  created date;
  total numeric(14,2);
  st text;
  stid uuid;
  fig text;
  is_prov boolean;
  is_costed boolean;
  pidx int;
  prod uuid;
  svc uuid;
  lname text;
  ref text;
  inv_id uuid;
  code_idx int;
  code_rec seed_codes%ROWTYPE;
  disc numeric(14,2);
  costed_tx int := 0;
  costed_sa int := 0;
  line1_total numeric(14,2);
  exp_status text;
  exp_type text;
  rct_seq int := 0;
  method text;
  rct_paid date;
  rct_ref text;
  rct_key text;
BEGIN
  SELECT * INTO c FROM seed_ctx;

  -- ---------- 80 transactions (the bookings) ----------
  FOR i IN 1..80 LOOP
    pn := ((i - 1) % 30) + 1;
    SELECT * INTO prow FROM seed_partners WHERE n = pn;
    created := LEAST(
      CASE WHEN i <= 40 THEN make_date(2025, ((i - 1) % 12) + 1, ((i * 7) % 28) + 1)
           ELSE make_date(2026, ((i - 41) % 11) + 1, ((i * 7) % 28) + 1) END,
      today);
    total := CASE WHEN i <= 20 THEN 1200 WHEN i <= 40 THEN 2500
                  WHEN i <= 60 THEN 3800 ELSE 5000 END;
    st := CASE WHEN i IN (5, 25, 45, 65, 75) THEN 'Pending'
               WHEN i IN (10, 30, 50, 70) THEN 'Draft'
               ELSE 'Fully Paid' END;
    stid := CASE st WHEN 'Fully Paid' THEN c.status_paid_id
                    WHEN 'Pending' THEN c.status_pending_id
                    ELSE c.status_draft_id END;
    fig := CASE WHEN st = 'Fully Paid' THEN 'final' ELSE 'provisional' END;
    is_prov := i IN (3, 8, 13, 18, 23, 28, 43, 48, 53, 63, 68);
    is_costed := (st = 'Fully Paid') AND NOT is_prov;
    pidx := ((i - 1) % 6) + 1;
    prod := (ARRAY[c.prod_flights, c.prod_hotels, c.prod_visas, c.prod_transport, c.prod_packages, c.prod_insurance])[pidx];
    svc := (ARRAY[c.svc_flights, c.svc_hotels, c.svc_visas, c.svc_transport, c.svc_packages, c.svc_insurance])[pidx];
    lname := (ARRAY['Flights booking', 'Hotels booking', 'Visa booking', 'Transport booking', 'Package booking', 'Insurance booking'])[pidx];
    ref := '90000000' || lpad(i::text, 2, '0');

    -- A costed transaction uses a code (round-robin through the 20).
    code_idx := NULL;
    disc := 0;
    IF is_costed THEN
      costed_tx := costed_tx + 1;
      code_idx := ((costed_tx - 1) % 20) + 1;
      SELECT * INTO code_rec FROM seed_codes WHERE idx = code_idx;
      disc := code_rec.discount;
    END IF;

    INSERT INTO finance.invoice
      (ref, kind, customer_name, customer_email, client_id_raw, tax_no_raw, discount_code_raw,
       status_raw, status_id, created_on, generated_on, paid_on, due_on,
       total_sar, product_id, segment_id, channel_id, source, figure_state, created_by)
    VALUES
      (ref, 'transaction', prow.trade_name_en,
       'contact-' || lpad(pn::text, 2, '0') || '@test-seed-' || lpad(pn::text, 2, '0') || '.example.test',
       prow.prepaid, NULL,
       CASE WHEN code_idx IS NULL THEN NULL ELSE code_rec.code END,
       st, stid, created, created,
       CASE WHEN st = 'Fully Paid' THEN LEAST(created + 3, today) ELSE NULL END,
       created + 30,
       total, prod, prow.side_type_id, c.channel_id, 'manual', fig,
       core.test_id('person', ((i - 1) % 6) + 1))
    RETURNING id INTO inv_id;

    -- Lines: the first 20 transactions split (total-200) + 200 fee.
    line1_total := CASE WHEN i <= 20 THEN total - 200 ELSE total END;
    INSERT INTO finance.invoice_line
      (invoice_id, line_no, product_id, name, qty, unit_price, discount_sar, total_sar, service_id, created_by)
    VALUES
      (inv_id, 1, prod, lname, 1, line1_total + disc, disc, line1_total, svc,
       core.test_id('person', ((i - 1) % 6) + 1));
    IF i <= 20 THEN
      INSERT INTO finance.invoice_line
        (invoice_id, line_no, product_id, name, qty, unit_price, discount_sar, total_sar, service_id, created_by)
      VALUES
        (inv_id, 2, prod, 'Service fee', 1, 200, 0, 200, svc,
         core.test_id('person', ((i - 1) % 6) + 1));
    END IF;

    -- Expenses: costed only, 60% of the total; the first 15 costed
    -- split 40% + 20%.
    IF is_costed THEN
      exp_status := CASE WHEN i % 10 = 0 THEN 'issued' ELSE 'approved' END;
      exp_type := (ARRAY['Supplier cost', 'Airline cost', 'Hotel cost'])[((i - 1) % 3) + 1];
      IF costed_tx <= 15 THEN
        INSERT INTO finance.expense_line
          (invoice_id, expense_type, status, status_raw, amount_sar, merchant, source, created_by)
        VALUES
          (inv_id, exp_type, exp_status, initcap(exp_status), total * 0.40,
           'TEST Supplier ' || ((i % 5) + 1), 'manual', core.test_id('person', ((i - 1) % 6) + 1)),
          (inv_id, exp_type, exp_status, initcap(exp_status), total * 0.20,
           'TEST Supplier ' || ((i % 5) + 1), 'manual', core.test_id('person', ((i - 1) % 6) + 1));
      ELSE
        INSERT INTO finance.expense_line
          (invoice_id, expense_type, status, status_raw, amount_sar, merchant, source, created_by)
        VALUES
          (inv_id, exp_type, exp_status, initcap(exp_status), total * 0.60,
           'TEST Supplier ' || ((i % 5) + 1), 'manual', core.test_id('person', ((i - 1) % 6) + 1));
      END IF;
    END IF;

    -- Receipts cover every Fully Paid invoice in full.
    IF st = 'Fully Paid' THEN
      rct_seq := rct_seq + 1;
      method := (ARRAY['bank_transfer', 'mada', 'visa'])[((rct_seq - 1) % 3) + 1];
      rct_paid := LEAST(created + 3, today);
      rct_ref := 'TEST-RCT-' || lpad(rct_seq::text, 4, '0');
      rct_key := finance.receipt_key(jsonb_build_object(
        'ref', ref, 'ref_at_method', rct_ref, 'method', method, 'paid_on', rct_paid::text));
      INSERT INTO finance.receipt
        (invoice_id, receipt_key, method, amount_sar, paid_on, ref_at_method, paid_by, source, created_by)
      VALUES
        (inv_id, rct_key, method, total, rct_paid, rct_ref, 'TEST Seed', 'manual',
         core.test_id('person', ((i - 1) % 6) + 1));
    END IF;

    -- The code use: the code is USED, not just defined.
    IF is_costed THEN
      INSERT INTO finance.code_use
        (code_id, invoice_id, invoice_ref, discount_sar, source, reason, created_by)
      VALUES
        (code_rec.id, inv_id, ref, disc, 'manual', 'TEST seed code use',
         core.test_id('person', ((i - 1) % 6) + 1));
    END IF;

    INSERT INTO seed_invoices (seq, kind, id, ref, total, created_on, status, partner_n, is_costed, code_idx, discount)
    VALUES (i, 'transaction', inv_id, ref, total, created, st, pn, is_costed, code_idx, disc);
  END LOOP;

  -- ---------- 60 standalone invoices (a DPIN on the 45 costed) ----------
  FOR j IN 1..60 LOOP
    pn := ((j * 7 - 1) % 30) + 1;
    SELECT * INTO prow FROM seed_partners WHERE n = pn;
    created := LEAST(
      CASE WHEN j <= 30 THEN make_date(2025, ((j - 1) % 12) + 1, ((j * 11) % 28) + 1)
           ELSE make_date(2026, ((j - 31) % 11) + 1, ((j * 11) % 28) + 1) END,
      today);
    total := CASE WHEN j <= 15 THEN 2000 WHEN j <= 30 THEN 4000
                  WHEN j <= 45 THEN 6000 ELSE 8000 END;
    st := CASE WHEN j IN (5, 20, 35, 50) THEN 'Pending'
               WHEN j IN (10, 40) THEN 'Draft'
               ELSE 'Fully Paid' END;
    stid := CASE st WHEN 'Fully Paid' THEN c.status_paid_id
                    WHEN 'Pending' THEN c.status_pending_id
                    ELSE c.status_draft_id END;
    fig := CASE WHEN st = 'Fully Paid' THEN 'final' ELSE 'provisional' END;
    is_prov := j IN (3, 8, 13, 18, 23, 33, 38, 48, 53);
    is_costed := (st = 'Fully Paid') AND NOT is_prov;
    pidx := ((j - 1) % 6) + 1;
    prod := (ARRAY[c.prod_flights, c.prod_hotels, c.prod_visas, c.prod_transport, c.prod_packages, c.prod_insurance])[pidx];
    svc := (ARRAY[c.svc_flights, c.svc_hotels, c.svc_visas, c.svc_transport, c.svc_packages, c.svc_insurance])[pidx];
    lname := (ARRAY['Flights booking', 'Hotels booking', 'Visa booking', 'Transport booking', 'Package booking', 'Insurance booking'])[pidx];
    ref := '90000001' || lpad(j::text, 2, '0');

    INSERT INTO finance.invoice
      (ref, kind, customer_name, customer_email, client_id_raw, tax_no_raw, discount_code_raw,
       status_raw, status_id, created_on, generated_on, paid_on, due_on,
       total_sar, product_id, segment_id, channel_id, source, figure_state, created_by)
    VALUES
      (ref, 'standalone', prow.trade_name_en,
       'contact-' || lpad(pn::text, 2, '0') || '@test-seed-' || lpad(pn::text, 2, '0') || '.example.test',
       prow.postpaid, ref, NULL,
       st, stid, created, created,
       CASE WHEN st = 'Fully Paid' THEN LEAST(created + 3, today) ELSE NULL END,
       created + 30,
       total, prod, prow.side_type_id, c.channel_id, 'manual', fig,
       core.test_id('person', ((j - 1) % 6) + 1))
    RETURNING id INTO inv_id;

    -- One line, the whole total (no discount on standalone invoices).
    INSERT INTO finance.invoice_line
      (invoice_id, line_no, product_id, name, qty, unit_price, discount_sar, total_sar, service_id, created_by)
    VALUES
      (inv_id, 1, prod, lname, 1, total, 0, total, svc,
       core.test_id('person', ((j - 1) % 6) + 1));

    -- Its DPIN (a tax invoice is only allowed on billing/standalone).
    -- Corrected 25 Nov 2026: the DPIN is Direct's own part of the
    -- invoice — the total minus the approved expenses (60% below) —
    -- and it is issued only once the cost is Ready. A cost-less or
    -- unpaid invoice gets NO DPIN. (The first version wrote the whole
    -- total on all 60, which failed the Finance checks dpin_differs,
    -- expenses_missing and dpin_before_ready on every one of them.)
    IF (st = 'Fully Paid') AND NOT is_prov THEN
      INSERT INTO finance.tax_invoice
        (dpin, parent_invoice_id, total_sar, issued_on, source, created_by)
      VALUES
        (ref, inv_id, total - total * 0.60, created, 'manual', core.test_id('person', ((j - 1) % 6) + 1));
    END IF;

    -- Expenses: costed only, 60%; the first 15 costed split 40% + 20%.
    IF is_costed THEN
      costed_sa := costed_sa + 1;
      exp_status := CASE WHEN j % 10 = 0 THEN 'issued' ELSE 'approved' END;
      exp_type := (ARRAY['Supplier cost', 'Airline cost', 'Hotel cost'])[((j - 1) % 3) + 1];
      IF costed_sa <= 15 THEN
        INSERT INTO finance.expense_line
          (invoice_id, expense_type, status, status_raw, amount_sar, merchant, source, created_by)
        VALUES
          (inv_id, exp_type, exp_status, initcap(exp_status), total * 0.40,
           'TEST Supplier ' || ((j % 5) + 1), 'manual', core.test_id('person', ((j - 1) % 6) + 1)),
          (inv_id, exp_type, exp_status, initcap(exp_status), total * 0.20,
           'TEST Supplier ' || ((j % 5) + 1), 'manual', core.test_id('person', ((j - 1) % 6) + 1));
      ELSE
        INSERT INTO finance.expense_line
          (invoice_id, expense_type, status, status_raw, amount_sar, merchant, source, created_by)
        VALUES
          (inv_id, exp_type, exp_status, initcap(exp_status), total * 0.60,
           'TEST Supplier ' || ((j % 5) + 1), 'manual', core.test_id('person', ((j - 1) % 6) + 1));
      END IF;
    END IF;

    -- Receipts cover every Fully Paid invoice in full.
    IF st = 'Fully Paid' THEN
      rct_seq := rct_seq + 1;
      method := (ARRAY['bank_transfer', 'mada', 'visa'])[((rct_seq - 1) % 3) + 1];
      rct_paid := LEAST(created + 3, today);
      rct_ref := 'TEST-RCT-' || lpad(rct_seq::text, 4, '0');
      rct_key := finance.receipt_key(jsonb_build_object(
        'ref', ref, 'ref_at_method', rct_ref, 'method', method, 'paid_on', rct_paid::text));
      INSERT INTO finance.receipt
        (invoice_id, receipt_key, method, amount_sar, paid_on, ref_at_method, paid_by, source, created_by)
      VALUES
        (inv_id, rct_key, method, total, rct_paid, rct_ref, 'TEST Seed', 'manual',
         core.test_id('person', ((j - 1) % 6) + 1));
    END IF;

    INSERT INTO seed_invoices (seq, kind, id, ref, total, created_on, status, partner_n, is_costed, code_idx, discount)
    VALUES (80 + j, 'standalone', inv_id, ref, total, created, st, pn, is_costed, NULL, 0);
  END LOOP;

  IF costed_tx <> 60 THEN
    RAISE EXCEPTION 'Seed bug: expected 60 costed transactions, got %.', costed_tx;
  END IF;
  IF costed_sa <> 45 THEN
    RAISE EXCEPTION 'Seed bug: expected 45 costed standalone invoices, got %.', costed_sa;
  END IF;
  IF rct_seq <> 125 THEN
    RAISE EXCEPTION 'Seed bug: expected 125 receipts, got %.', rct_seq;
  END IF;
  RAISE NOTICE 'Invoices: 80 transactions + 60 standalone seeded (60 costed tx, 45 costed sa, 125 receipts, 60 code uses).';
END
$invoices$;

-- The tasks we make, so the achievement block can link to them.
CREATE TEMP TABLE seed_tasks (
  t int PRIMARY KEY,
  id uuid NOT NULL,
  owner_id uuid NOT NULL,
  happened_on date NOT NULL,
  partner_n int
);

-- ================================================================
-- 5. Tasks (40): 30 client + 10 internal. Status: 1-10 not
--    started, 11-25 in progress, 26-37 done, 38-40 cancelled.
--    Tasks 12, 22, 32 are blocked. Tasks 1-10 get a helper, two
--    action items and a booking ref; tasks 1-8 get a comment.
-- ================================================================
DO $tasks$
DECLARE
  c seed_ctx%ROWTYPE;
  today date := core.riyadh_today();
  t int;
  yr int;
  happened date;
  owner uuid;
  team uuid;
  pn int;
  prow seed_partners%ROWTYPE;
  st text;
  stid uuid;
  typ text;
  typid uuid;
  pri uuid;
  wtype text;
  title text;
  tid uuid;
  tnum text;
  helper uuid;
BEGIN
  SELECT * INTO c FROM seed_ctx;

  FOR t IN 1..40 LOOP
    yr := CASE WHEN t <= 20 THEN 2025 ELSE 2026 END;
    happened := LEAST(
      CASE WHEN t <= 20 THEN make_date(2025, ((t - 1) % 12) + 1, ((t * 5) % 28) + 1)
           ELSE make_date(2026, ((t - 21) % 11) + 1, ((t * 5) % 28) + 1) END,
      today);
    owner := core.test_id('person', ((t - 1) % 6) + 1);
    team := core.test_id('team', ((t - 1) % 5) + 1);
    wtype := CASE WHEN t <= 30 THEN 'client' ELSE 'internal' END;
    pn := CASE WHEN t <= 30 THEN ((t - 1) % 30) + 1 ELSE NULL END;
    IF pn IS NOT NULL THEN
      SELECT * INTO prow FROM seed_partners WHERE n = pn;
    END IF;
    st := CASE WHEN t <= 10 THEN 'not_started'
               WHEN t <= 25 THEN 'in_progress'
               WHEN t <= 37 THEN 'done'
               ELSE 'cancelled' END;
    stid := CASE st WHEN 'not_started' THEN c.ts_not_started_id
                    WHEN 'in_progress' THEN c.ts_in_progress_id
                    WHEN 'done' THEN c.ts_done_id
                    ELSE c.ts_cancelled_id END;
    typ := (ARRAY['follow_up', 'meeting', 'request', 'report', 'other'])[((t - 1) % 5) + 1];
    typid := CASE typ WHEN 'follow_up' THEN c.tt_follow_up_id
                      WHEN 'meeting' THEN c.tt_meeting_id
                      WHEN 'request' THEN c.tt_request_id
                      WHEN 'report' THEN c.tt_report_id
                      ELSE c.tt_other_id END;
    pri := CASE ((t - 1) % 3) WHEN 0 THEN c.pri_high_id
                               WHEN 1 THEN c.pri_medium_id
                               ELSE c.pri_low_id END;
    title := CASE WHEN wtype = 'internal' THEN 'TEST internal task ' || lpad(t::text, 2, '0') || ' — prepare the monthly commercial report'
                  WHEN typ = 'follow_up' THEN 'TEST follow-up call with ' || prow.trade_name_en
                  WHEN typ = 'meeting' THEN 'TEST meeting with ' || prow.trade_name_en
                  WHEN typ = 'request' THEN 'TEST send proposal to ' || prow.trade_name_en
                  WHEN typ = 'report' THEN 'TEST monthly report for ' || prow.trade_name_en
                  ELSE 'TEST check onboarding for ' || prow.trade_name_en END;
    tnum := core.format_number('TSK', yr, core.next_number('task', yr));

    INSERT INTO work.task
      (number, title, notes, owner_id, team_id, department_id, priority_id,
       status_id, type_id, work_type, start_on, due_on, partner_id,
       origin, assigned_by, happened_on, created_by,
       closed_at, closed_by, cancelled_reason, blocked_reason, blocked_on)
    VALUES
      (tnum, title, 'TEST seed task ' || lpad(t::text, 2, '0') || '.',
       owner, team, c.dept_id, pri, stid, typid, wtype,
       happened, happened + 7,
       CASE WHEN wtype = 'client' THEN prow.id ELSE NULL END,
       'manual', core.test_id('person', 1), happened,
       core.test_id('person', ((t - 1) % 6) + 1),
       CASE WHEN st = 'done' THEN (happened + 2)::timestamptz ELSE NULL END,
       CASE WHEN st = 'done' THEN owner ELSE NULL END,
       CASE WHEN st = 'cancelled' THEN 'TEST cancelled — no longer needed' ELSE NULL END,
       CASE WHEN t IN (12, 22, 32) THEN 'TEST blocked — waiting on the customer' ELSE NULL END,
       CASE WHEN t IN (12, 22, 32) THEN happened + 1 ELSE NULL END)
    RETURNING id INTO tid;

    INSERT INTO seed_tasks (t, id, owner_id, happened_on, partner_n)
    VALUES (t, tid, owner, happened, pn);

    -- One status-change row for every task that moved off not_started.
    IF st <> 'not_started' THEN
      INSERT INTO work.task_status_change
        (task_id, from_status_id, to_status_id, blocked, reason, happened_on, created_by)
      VALUES
        (tid, c.ts_not_started_id, stid, (t IN (12, 22, 32)),
         CASE WHEN t IN (12, 22, 32) THEN 'TEST blocked — waiting on the customer' ELSE NULL END,
         LEAST(happened + 1, today), owner);
    END IF;

    -- Tasks 1-10: a helper, two action items, a booking ref.
    IF t <= 10 THEN
      helper := core.test_id('person', (t % 6) + 1);
      INSERT INTO work.task_helper (task_id, person_id, created_by)
      VALUES (tid, helper, owner);
      INSERT INTO work.action_item
        (task_id, text, owner_id, due_on, done_on, done_by, sort, happened_on, created_by)
      VALUES
        (tid, 'TEST call the travel manager', owner, happened + 3,
         CASE WHEN st = 'done' THEN happened + 2 ELSE NULL END,
         CASE WHEN st = 'done' THEN owner ELSE NULL END,
         1, happened, owner),
        (tid, 'TEST send the proposal by email', owner, happened + 5,
         CASE WHEN st = 'done' THEN happened + 4 ELSE NULL END,
         CASE WHEN st = 'done' THEN owner ELSE NULL END,
         2, happened, owner);
      INSERT INTO work.task_ref (task_id, system_id, value, created_by)
      VALUES (tid, c.ref_booking_id, '90000000' || lpad(t::text, 2, '0'), owner);
    END IF;

    -- Tasks 1-8: a comment.
    IF t <= 8 THEN
      INSERT INTO work.task_comment (task_id, body, created_by)
      VALUES (tid, 'TEST note on this task — called the travel manager, waiting for the agreement.', owner);
    END IF;
  END LOOP;

  RAISE NOTICE 'Tasks: 40 seeded (10 helpers, 20 action items, 8 comments, 30 status changes, 10 booking refs).';
END
$tasks$;

-- ================================================================
-- 6. Achievements (30): one per partner, categories rotating
--    PROBLEM / COST / MOU / CONTRACT / INTEGRATION / CASHBACK /
--    AWARD. Deal value only on MOU / CONTRACT (the guard refuses
--    it elsewhere). Achievements 1-10 link to tasks 1-10 (the
--    logger is the task's owner), carry a participant and a ref
--    (INTEGRATION gets a ticket ref, as its category requires).
-- ================================================================
DO $achievements$
#variable_conflict use_variable
DECLARE
  c seed_ctx%ROWTYPE;
  today date := core.riyadh_today();
  a int;
  yr int;
  happened date;
  owner uuid;
  pn int;
  prow seed_partners%ROWTYPE;
  code text;
  catid uuid;
  planid uuid;
  title text;
  deal numeric(14,2);
  before_v numeric(14,2);
  after_v numeric(14,2);
  aid uuid;
  anum text;
  trow seed_tasks%ROWTYPE;
BEGIN
  SELECT * INTO c FROM seed_ctx;

  FOR a IN 1..30 LOOP
    yr := CASE WHEN a <= 15 THEN 2025 ELSE 2026 END;
    happened := LEAST(
      CASE WHEN a <= 15 THEN make_date(2025, ((a - 1) % 12) + 1, ((a * 9) % 28) + 1)
           ELSE make_date(2026, ((a - 16) % 11) + 1, ((a * 9) % 28) + 1) END,
      today);
    owner := core.test_id('person', ((a - 1) % 6) + 1);
    pn := ((a - 1) % 30) + 1;
    SELECT * INTO prow FROM seed_partners WHERE n = pn;
    code := (ARRAY['PROBLEM', 'COST', 'MOU', 'CONTRACT', 'INTEGRATION', 'CASHBACK', 'AWARD'])[((a - 1) % 7) + 1];
    planid := CASE WHEN yr = 2025 THEN c.plan_2025_id ELSE c.plan_2026_id END;
    SELECT cat.id INTO catid FROM perf.achievement_category cat
    WHERE cat.plan_id = planid AND cat.code = code AND cat.deleted_at IS NULL;
    IF catid IS NULL THEN
      RAISE EXCEPTION 'Seed bug: category % missing from plan %.', code, yr;
    END IF;
    title := CASE code
               WHEN 'PROBLEM' THEN 'TEST solved a delivery problem for ' || prow.trade_name_en
               WHEN 'COST' THEN 'TEST cut the cost of bookings for ' || prow.trade_name_en
               WHEN 'MOU' THEN 'TEST signed an MoU with ' || prow.trade_name_en
               WHEN 'CONTRACT' THEN 'TEST signed a contract with ' || prow.trade_name_en
               WHEN 'INTEGRATION' THEN 'TEST handed the integration with ' || prow.trade_name_en || ' to Product'
               WHEN 'CASHBACK' THEN 'TEST cashback received from ' || prow.trade_name_en
               ELSE 'TEST award — best commercial partner ' || prow.trade_name_en END;
    deal := CASE code WHEN 'MOU' THEN 50000 + a * 1000
                      WHEN 'CONTRACT' THEN 100000 + a * 2000
                      ELSE NULL END;
    before_v := CASE WHEN code = 'COST' THEN 10000 + a * 100 ELSE NULL END;
    after_v := CASE WHEN code = 'COST' THEN 8000 + a * 100 ELSE NULL END;
    anum := perf.number_for(yr);

    INSERT INTO perf.achievement
      (number, plan_id, department_id, category_id, partner_id, source_task_id,
       title, notes, count, before_value, after_value, deal_value,
       value_report_kind, value_report_period,
       happened_on, owner_id, origin, mou_side, created_by)
    VALUES
      (anum, planid, c.dept_id, catid, prow.id,
       CASE WHEN a <= 10 THEN (SELECT id FROM seed_tasks WHERE t = a) ELSE NULL END,
       title, 'TEST seed achievement ' || lpad(a::text, 2, '0') || '.',
       1, before_v, after_v, deal,
       CASE WHEN code IN ('MOU', 'CONTRACT') THEN 'bd_monthly' ELSE NULL END,
       CASE WHEN code IN ('MOU', 'CONTRACT') THEN to_char(happened, 'YYYY-MM') ELSE NULL END,
       happened, owner, 'backfill',
       CASE WHEN code = 'MOU' THEN 'client' ELSE NULL END,
       owner)
    RETURNING id INTO aid;

    -- Achievements 1-10: a participant and a Direct ref.
    IF a <= 10 THEN
      INSERT INTO perf.achievement_participant (achievement_id, person_id, role, created_by)
      VALUES (aid, core.test_id('person', (a % 6) + 1), 'support', owner);
      IF code = 'INTEGRATION' THEN
        INSERT INTO perf.achievement_ref (achievement_id, system_id, value, created_by)
        VALUES (aid, c.ref_ticket_id, 'TEST-TKT-' || lpad(a::text, 2, '0'), owner);
      ELSIF code IN ('MOU', 'CONTRACT') THEN
        INSERT INTO perf.achievement_ref (achievement_id, system_id, value, created_by)
        VALUES (aid, c.ref_invoice_id, '90000001' || lpad(a::text, 2, '0'), owner);
      ELSE
        INSERT INTO perf.achievement_ref (achievement_id, system_id, value, created_by)
        VALUES (aid, c.ref_booking_id, '90000000' || lpad(a::text, 2, '0'), owner);
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Achievements: 30 seeded (10 linked to tasks, 10 with a participant, 10 with a ref).';
END
$achievements$;

-- ================================================================
-- 7. Targets (69): plans 2025 + 2026 x CONTRACT / MOU / COST x
--    months (2025: 12 months, 2026: Jan-Nov).
-- ================================================================
INSERT INTO perf.target (plan_id, category_id, month, target_count, target_value, created_by)
SELECT p.id, cat.id, make_date(p.year, mm.m, 1),
       CASE cat.code WHEN 'CONTRACT' THEN 2 WHEN 'MOU' THEN 1 ELSE 3 END,
       CASE cat.code WHEN 'CONTRACT' THEN 200000 WHEN 'MOU' THEN 100000 ELSE NULL END,
       core.test_id('person', 1)
FROM perf.plan p
JOIN core.department d ON d.id = p.department_id
JOIN perf.achievement_category cat ON cat.plan_id = p.id
CROSS JOIN generate_series(1, 12) AS mm(m)
WHERE d.code = 'commercial' AND p.year IN (2025, 2026) AND p.deleted_at IS NULL
  AND cat.code IN ('CONTRACT', 'MOU', 'COST') AND cat.deleted_at IS NULL AND cat.active
  AND (p.year = 2025 OR mm.m <= 11);

-- ================================================================
-- 8. Verification — counts, then the Finance totals read the same
--    way period_figures reads them (finance.money_row, counted,
--    created_on in the period; Cost and Profit only over
--    non-provisional rows; Provisional is the cost-less revenue).
--    The seed-only figures are ASSERTED: if they do not match the
--    expected values, the whole transaction rolls back.
-- ================================================================
SELECT 'partners' AS what, count(*) AS n FROM partner.partner p WHERE p.deleted_at IS NULL AND p.trade_name_en LIKE 'TEST Seed Company%'
UNION ALL SELECT 'client_ids', count(*) FROM partner.identifier i JOIN partner.partner p ON p.id = i.partner_id WHERE i.deleted_at IS NULL AND i.kind = 'payments_client_id' AND p.trade_name_en LIKE 'TEST Seed Company%'
UNION ALL SELECT 'discount_codes', count(*) FROM partner.identifier i JOIN partner.partner p ON p.id = i.partner_id WHERE i.deleted_at IS NULL AND i.kind = 'discount_code' AND p.trade_name_en LIKE 'TEST Seed Company%'
UNION ALL SELECT 'contacts', count(*) FROM partner.contact ct JOIN partner.partner p ON p.id = ct.partner_id WHERE ct.deleted_at IS NULL AND p.trade_name_en LIKE 'TEST Seed Company%'
UNION ALL SELECT 'contracts', count(*) FROM partner.contract ct JOIN partner.partner p ON p.id = ct.partner_id WHERE ct.deleted_at IS NULL AND p.trade_name_en LIKE 'TEST Seed Company%'
UNION ALL SELECT 'credit_limits', count(*) FROM partner.credit_limit cl JOIN partner.partner p ON p.id = cl.partner_id WHERE cl.deleted_at IS NULL AND p.trade_name_en LIKE 'TEST Seed Company%'
UNION ALL SELECT 'code_terms', count(*) FROM partner.code_terms t JOIN partner.identifier i ON i.id = t.identifier_id JOIN partner.partner p ON p.id = i.partner_id WHERE t.deleted_at IS NULL AND p.trade_name_en LIKE 'TEST Seed Company%'
UNION ALL SELECT 'code_attributions', count(*) FROM finance.code_attribution a JOIN partner.partner p ON p.id = a.partner_id WHERE a.deleted_at IS NULL AND p.trade_name_en LIKE 'TEST Seed Company%'
UNION ALL SELECT 'invoices', count(*) FROM finance.invoice i WHERE i.deleted_at IS NULL AND i.ref LIKE '9000000%'
UNION ALL SELECT 'invoice_lines', count(*) FROM finance.invoice_line l JOIN finance.invoice i ON i.id = l.invoice_id WHERE l.deleted_at IS NULL AND i.ref LIKE '9000000%'
UNION ALL SELECT 'expense_lines', count(*) FROM finance.expense_line e JOIN finance.invoice i ON i.id = e.invoice_id WHERE e.deleted_at IS NULL AND i.ref LIKE '9000000%'
UNION ALL SELECT 'tax_invoices_dpins', count(*) FROM finance.tax_invoice t JOIN finance.invoice i ON i.id = t.parent_invoice_id WHERE t.deleted_at IS NULL AND i.ref LIKE '9000000%'
UNION ALL SELECT 'receipts', count(*) FROM finance.receipt r JOIN finance.invoice i ON i.id = r.invoice_id WHERE r.deleted_at IS NULL AND i.ref LIKE '9000000%'
UNION ALL SELECT 'code_uses', count(*) FROM finance.code_use u JOIN finance.invoice i ON i.id = u.invoice_id WHERE u.deleted_at IS NULL AND i.ref LIKE '9000000%'
UNION ALL SELECT 'tasks', count(*) FROM work.task t JOIN seed_tasks st ON st.id = t.id WHERE t.deleted_at IS NULL
UNION ALL SELECT 'achievements', count(*) FROM perf.achievement a WHERE a.deleted_at IS NULL AND a.title LIKE 'TEST %'
UNION ALL SELECT 'targets', count(*) FROM perf.target t JOIN perf.plan p ON p.id = t.plan_id JOIN core.department d ON d.id = p.department_id WHERE t.deleted_at IS NULL AND d.code = 'commercial' AND p.year IN (2025, 2026) AND t.created_by = core.test_id('person', 1);

-- Seed-only Finance figures (money_row rows whose ref is a seed ref).
SELECT 'seed_2025' AS period,
  count(*) AS units,
  coalesce(sum(revenue), 0) AS revenue,
  coalesce(sum(cost) FILTER (WHERE NOT provisional), 0) AS cost,
  coalesce(sum(profit) FILTER (WHERE NOT provisional), 0) AS profit,
  count(*) FILTER (WHERE provisional) AS provisional_units,
  coalesce(sum(revenue) FILTER (WHERE provisional), 0) AS provisional_revenue
FROM finance.money_row
WHERE counted AND ref LIKE '9000000%' AND created_on BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'
UNION ALL
SELECT 'seed_2026',
  count(*),
  coalesce(sum(revenue), 0),
  coalesce(sum(cost) FILTER (WHERE NOT provisional), 0),
  coalesce(sum(profit) FILTER (WHERE NOT provisional), 0),
  count(*) FILTER (WHERE provisional),
  coalesce(sum(revenue) FILTER (WHERE provisional), 0)
FROM finance.money_row
WHERE counted AND ref LIKE '9000000%' AND created_on BETWEEN DATE '2026-01-01' AND DATE '2026-11-30'
UNION ALL
SELECT 'seed_all_time',
  count(*),
  coalesce(sum(revenue), 0),
  coalesce(sum(cost) FILTER (WHERE NOT provisional), 0),
  coalesce(sum(profit) FILTER (WHERE NOT provisional), 0),
  count(*) FILTER (WHERE provisional),
  coalesce(sum(revenue) FILTER (WHERE provisional), 0)
FROM finance.money_row
WHERE counted AND ref LIKE '9000000%' AND created_on BETWEEN DATE '2025-01-01' AND DATE '2026-11-30';

-- Overall figures after the seed (live + seed), for the operator to compare.
SELECT 'overall_2025' AS period,
  count(*) AS units,
  coalesce(sum(revenue), 0) AS revenue,
  coalesce(sum(cost) FILTER (WHERE NOT provisional), 0) AS cost,
  coalesce(sum(profit) FILTER (WHERE NOT provisional), 0) AS profit,
  count(*) FILTER (WHERE provisional) AS provisional_units,
  coalesce(sum(revenue) FILTER (WHERE provisional), 0) AS provisional_revenue
FROM finance.money_row
WHERE counted AND created_on BETWEEN DATE '2025-01-01' AND DATE '2025-12-31'
UNION ALL
SELECT 'overall_2026_ytd',
  count(*),
  coalesce(sum(revenue), 0),
  coalesce(sum(cost) FILTER (WHERE NOT provisional), 0),
  coalesce(sum(profit) FILTER (WHERE NOT provisional), 0),
  count(*) FILTER (WHERE provisional),
  coalesce(sum(revenue) FILTER (WHERE provisional), 0)
FROM finance.money_row
WHERE counted AND created_on BETWEEN DATE '2026-01-01' AND DATE '2026-11-30'
UNION ALL
SELECT 'overall_all_time',
  count(*),
  coalesce(sum(revenue), 0),
  coalesce(sum(cost) FILTER (WHERE NOT provisional), 0),
  coalesce(sum(profit) FILTER (WHERE NOT provisional), 0),
  count(*) FILTER (WHERE provisional),
  coalesce(sum(revenue) FILTER (WHERE provisional), 0)
FROM finance.money_row
WHERE counted AND created_on BETWEEN DATE '2025-01-01' AND DATE '2026-11-30';

-- Assert the seed-only figures. If the schema computes money
-- differently than the design assumed, this fails loudly and the
-- whole seed rolls back instead of landing wrong figures.
DO $verify$
DECLARE
  r record;
BEGIN
  SELECT count(*) AS units, coalesce(sum(revenue), 0) AS revenue,
         coalesce(sum(cost) FILTER (WHERE NOT provisional), 0) AS cost,
         coalesce(sum(profit) FILTER (WHERE NOT provisional), 0) AS profit,
         coalesce(sum(revenue) FILTER (WHERE provisional), 0) AS provisional_revenue
    INTO r FROM finance.money_row
    WHERE counted AND ref LIKE '9000000%' AND created_on BETWEEN DATE '2025-01-01' AND DATE '2025-12-31';
  IF (r.units, r.revenue, r.cost, r.profit, r.provisional_revenue) IS DISTINCT FROM (63, 148600, 74880, 49920, 23800) THEN
    RAISE EXCEPTION 'Seed verification failed for 2025: got units=% revenue=% cost=% profit=% provisional=% (expected 63 / 148600 / 74880 / 49920 / 23800).', r.units, r.revenue, r.cost, r.profit, r.provisional_revenue;
  END IF;
  SELECT count(*) AS units, coalesce(sum(revenue), 0) AS revenue,
         coalesce(sum(cost) FILTER (WHERE NOT provisional), 0) AS cost,
         coalesce(sum(profit) FILTER (WHERE NOT provisional), 0) AS profit,
         coalesce(sum(revenue) FILTER (WHERE provisional), 0) AS provisional_revenue
    INTO r FROM finance.money_row
    WHERE counted AND ref LIKE '9000000%' AND created_on BETWEEN DATE '2026-01-01' AND DATE '2026-11-30';
  IF (r.units, r.revenue, r.cost, r.profit, r.provisional_revenue) IS DISTINCT FROM (62, 343400, 176400, 117600, 49400) THEN
    RAISE EXCEPTION 'Seed verification failed for 2026: got units=% revenue=% cost=% profit=% provisional=% (expected 62 / 343400 / 176400 / 117600 / 49400).', r.units, r.revenue, r.cost, r.profit, r.provisional_revenue;
  END IF;
  IF (SELECT coalesce(sum(discount_sar), 0) FROM finance.code_use u JOIN finance.invoice i ON i.id = u.invoice_id WHERE u.deleted_at IS NULL AND i.ref LIKE '9000000%') <> 7500 THEN
    RAISE EXCEPTION 'Seed verification failed: total discount on code uses is not 7,500.';
  END IF;
  -- The seed must not leave a failing Finance check behind (added 25 Nov 2026).
  SELECT count(*) AS n INTO r FROM finance."check" c WHERE NOT c.ok AND c.ref LIKE '9000000%';
  IF r.n <> 0 THEN
    RAISE EXCEPTION 'Seed verification failed: % Finance check(s) fail on the seeded invoices (expected 0).', r.n;
  END IF;
  IF (SELECT count(*) FROM finance.tax_invoice t JOIN finance.invoice i ON i.id = t.parent_invoice_id WHERE t.deleted_at IS NULL AND i.ref LIKE '9000000%') <> 45 THEN
    RAISE EXCEPTION 'Seed verification failed: the costed standalone invoices with a DPIN are not 45.';
  END IF;
  RAISE NOTICE 'Seed verification passed: 2025 = 63 units, 148,600 / 74,880 / 49,920 / 23,800; 2026 = 62 units, 343,400 / 176,400 / 117,600 / 49,400; discount total 7,500.';
END
$verify$;

COMMIT;

-- ================================================================
-- Done. Check the Finance Overview in the app: YTD 2026 should
-- read Revenue 351,950 / Cost 177,270 / Profit 121,080 /
-- Provisional 53,600 (live 8,550 / 870 / 3,480 / 4,200 + seed),
-- and 2025 should read 148,600 / 74,880 / 49,920 / 23,800.
-- To remove all of it: wipe-test-dataset-2026-11-19.sql.
-- ================================================================
