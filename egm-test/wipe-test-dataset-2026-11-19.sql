-- ================================================================
-- TEST WIPE — removes the TEST seed (seed-test-dataset-2026-11-19.sql)
-- File: wipe-test-dataset-2026-11-19.sql
-- Date: 19 Nov 2026. Run as the postgres owner on the LIVE Supabase
-- project (project ref kimadjvaxgiqzjaukuqg), same connection as the
-- seed. NEVER on a database holding real data you have not backed up.
--
--   psql "$V2_DB_URL" -v ON_ERROR_STOP=1 \
--     -f ~/workspace/commercial-workspace-review/egm-test/wipe-test-dataset-2026-11-19.sql
--
-- WHAT IT DOES: soft-deletes (deleted_at / deleted_by /
-- delete_reason — nothing is gone for good) every row the seed
-- made, in reverse dependency order, in one transaction. Running
-- it twice is a no-op the second time. It does NOT touch:
--   * the six TEST people / five TEST teams (permanent test users)
--   * the pre-existing TEST rows (TEST Alpha 1163000012,
--     TEST Beta 1163000002, TEST Gamma 1163000005, the draft
--     TEST-20261113-01, the "TEST shared task of ..." tasks)
--   * any real partner, invoice, task or achievement
-- The partner / task / achievement numbers the seed drew from the
-- counters are NOT reset (the hard reset restarts them). After the
-- wipe, the seed script can run again cleanly.
-- ================================================================
\set ON_ERROR_STOP on

BEGIN;

-- The seed's partners and invoices, identified by their markers.
CREATE TEMP TABLE wipe_partners AS
SELECT id FROM partner.partner
WHERE deleted_at IS NULL AND trade_name_en LIKE 'TEST Seed Company%';

CREATE TEMP TABLE wipe_invoices AS
SELECT id FROM finance.invoice
WHERE deleted_at IS NULL AND ref LIKE '9000000%';

CREATE TEMP TABLE wipe_tasks AS
SELECT id FROM work.task
WHERE deleted_at IS NULL
  AND (title LIKE '%TEST Seed Company%' OR title LIKE 'TEST internal task%');

CREATE TEMP TABLE wipe_achievements AS
SELECT id FROM perf.achievement
WHERE deleted_at IS NULL AND title LIKE 'TEST %'
  AND partner_id IN (SELECT id FROM wipe_partners);

DO $wipe$
DECLARE
  v_admin uuid := core.test_id('person', 1);
  v_now timestamptz := now();
  v_reason text := 'TEST seed wipe 2026-11-19';
BEGIN
  -- Finance children first (reverse dependency order).
  UPDATE finance.code_use u SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE u.deleted_at IS NULL AND u.invoice_id IN (SELECT id FROM wipe_invoices);

  UPDATE finance.receipt r SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE r.deleted_at IS NULL AND r.invoice_id IN (SELECT id FROM wipe_invoices);

  UPDATE finance.expense_line e SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE e.deleted_at IS NULL AND e.invoice_id IN (SELECT id FROM wipe_invoices);

  UPDATE finance.invoice_line l SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE l.deleted_at IS NULL AND l.invoice_id IN (SELECT id FROM wipe_invoices);

  UPDATE finance.tax_invoice t SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE t.deleted_at IS NULL AND t.parent_invoice_id IN (SELECT id FROM wipe_invoices);

  UPDATE finance.invoice i SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE i.deleted_at IS NULL AND i.id IN (SELECT id FROM wipe_invoices);

  -- Achievements and their children.
  UPDATE perf.achievement_ref r SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE r.deleted_at IS NULL AND r.achievement_id IN (SELECT id FROM wipe_achievements);

  UPDATE perf.achievement_participant p SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE p.deleted_at IS NULL AND p.achievement_id IN (SELECT id FROM wipe_achievements);

  UPDATE perf.achievement a SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE a.deleted_at IS NULL AND a.id IN (SELECT id FROM wipe_achievements);

  -- Targets the seed wrote (commercial plans 2025/2026, by TEST Admin).
  UPDATE perf.target t SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE t.deleted_at IS NULL AND t.created_by = v_admin
    AND t.plan_id IN (
      SELECT p.id FROM perf.plan p JOIN core.department d ON d.id = p.department_id
      WHERE d.code = 'commercial' AND p.year IN (2025, 2026) AND p.deleted_at IS NULL);

  -- Tasks and their children.
  UPDATE work.task_ref r SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE r.deleted_at IS NULL AND r.task_id IN (SELECT id FROM wipe_tasks);

  UPDATE work.task_comment c SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE c.deleted_at IS NULL AND c.task_id IN (SELECT id FROM wipe_tasks);

  UPDATE work.action_item a SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE a.deleted_at IS NULL AND a.task_id IN (SELECT id FROM wipe_tasks);

  UPDATE work.task_helper h SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE h.deleted_at IS NULL AND h.task_id IN (SELECT id FROM wipe_tasks);

  UPDATE work.task_status_change s SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE s.deleted_at IS NULL AND s.task_id IN (SELECT id FROM wipe_tasks);

  UPDATE work.task t SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE t.deleted_at IS NULL AND t.id IN (SELECT id FROM wipe_tasks);

  -- Partner children: code terms + attributions, then identifiers,
  -- credit limits, contract terms + contracts, contacts, owners,
  -- status changes, sides.
  UPDATE partner.code_terms t SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE t.deleted_at IS NULL AND t.identifier_id IN (
    SELECT i.id FROM partner.identifier i
    WHERE i.deleted_at IS NULL AND i.partner_id IN (SELECT id FROM wipe_partners));

  UPDATE finance.code_attribution a SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE a.deleted_at IS NULL AND a.partner_id IN (SELECT id FROM wipe_partners);

  UPDATE partner.identifier i SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE i.deleted_at IS NULL AND i.partner_id IN (SELECT id FROM wipe_partners);

  UPDATE partner.credit_limit l SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE l.deleted_at IS NULL AND l.partner_id IN (SELECT id FROM wipe_partners);

  UPDATE partner.contract_term t SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE t.deleted_at IS NULL AND t.contract_id IN (
    SELECT c.id FROM partner.contract c
    WHERE c.deleted_at IS NULL AND c.partner_id IN (SELECT id FROM wipe_partners));

  UPDATE partner.contract c SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE c.deleted_at IS NULL AND c.partner_id IN (SELECT id FROM wipe_partners);

  UPDATE partner.contact c SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE c.deleted_at IS NULL AND c.partner_id IN (SELECT id FROM wipe_partners);

  UPDATE partner.side_owner o SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE o.deleted_at IS NULL AND o.partner_id IN (SELECT id FROM wipe_partners);

  UPDATE partner.side_status_change s SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE s.deleted_at IS NULL AND s.partner_id IN (SELECT id FROM wipe_partners);

  UPDATE partner.partner_side s SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE s.deleted_at IS NULL AND s.partner_id IN (SELECT id FROM wipe_partners);

  -- The partners themselves, last.
  UPDATE partner.partner p SET deleted_at = v_now, deleted_by = v_admin, delete_reason = v_reason
  WHERE p.deleted_at IS NULL AND p.id IN (SELECT id FROM wipe_partners);

  RAISE NOTICE 'Wipe done: partners, invoices, tasks, achievements and targets soft-deleted.';
END
$wipe$;

-- What is left of the seed markers (all should be 0).
SELECT 'partners_left' AS what, count(*) AS n FROM partner.partner WHERE deleted_at IS NULL AND trade_name_en LIKE 'TEST Seed Company%'
UNION ALL SELECT 'invoices_left', count(*) FROM finance.invoice WHERE deleted_at IS NULL AND ref LIKE '9000000%'
UNION ALL SELECT 'tasks_left', count(*) FROM work.task WHERE deleted_at IS NULL AND (title LIKE '%TEST Seed Company%' OR title LIKE 'TEST internal task%')
UNION ALL SELECT 'achievements_left', count(*) FROM perf.achievement WHERE deleted_at IS NULL AND title LIKE 'TEST %' AND partner_id IN (SELECT id FROM partner.partner WHERE trade_name_en LIKE 'TEST Seed Company%');

COMMIT;
