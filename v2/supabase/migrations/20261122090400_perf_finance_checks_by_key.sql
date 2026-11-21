-- Landing 35 — the checks find an invoice's own units by key (owner's live sweep, 21 Nov 2026: Finance health
-- took 3 s on live and was cut on and off).
--
-- finance.check asks three things of every monthly and standalone invoice — its approved cost, whether any of
-- its units is not Ready, whether all of them are commission — and each asked "the unit IS this invoice OR is
-- one of the transactions linked to it". Written as an OR, Postgres could use no key: for every invoice it read
-- EVERY invoice, three times (quadratic: 0.3 s of the read at 150 invoices on live, 1.2 s here at 1,500).
-- The same question, asked as "the unit is one of these ids" — the invoice itself and its linked transactions,
-- listed once per invoice — is a key lookup. The set of units is the same set, so every check answers as before:
-- a transaction counts under a monthly invoice exactly when a live link names it (which is what
-- invoice_fact.billing_invoice_id says too).
create or replace view finance."check" with (security_invoker = true) as
 WITH parent AS (
         SELECT f.id,
            f.ref,
            f.kind,
            f.total_sar,
            f.dpin,
            f.dpin_total,
                CASE
                    WHEN f.kind = 'billing'::text THEN ( SELECT sum(x_1.total_sar) AS sum
                       FROM finance.billing_link l
                         JOIN finance.invoice x_1 ON x_1.id = l.transaction_invoice_id
                      WHERE l.billing_invoice_id = f.id AND l.deleted_at IS NULL AND x_1.deleted_at IS NULL)
                    ELSE NULL::numeric
                END AS linked_sar,
            ( SELECT sum(c.cost_sar) AS sum
                   FROM finance.invoice_cost c
                  WHERE c.id = ANY (own.ids)) AS approved_sar,
            ( SELECT bool_or(c.cost_status <> 'ready'::text) AS bool_or
                   FROM finance.invoice_cost c
                  WHERE c.id = ANY (own.ids)) AS any_not_ready,
            ( SELECT bool_and(x_1.commission) AS bool_and
                   FROM finance.invoice_fact x_1
                  WHERE x_1.id = ANY (own.ids)) AS all_commission
           FROM finance.invoice_fact f
             CROSS JOIN LATERAL ( SELECT ARRAY[f.id] || ARRAY( SELECT l.transaction_invoice_id
                           FROM finance.billing_link l
                          WHERE l.billing_invoice_id = f.id AND l.deleted_at IS NULL) AS ids
                 OFFSET 0) own
          WHERE f.kind = ANY (ARRAY['billing'::text, 'standalone'::text])
        )
 SELECT p.id AS invoice_id,
    p.ref,
    x.check_key,
    x.ok,
    x.amount_sar
   FROM parent p
     CROSS JOIN LATERAL ( VALUES ('billing_has_no_transactions'::text,false,p.total_sar,p.kind = 'billing'::text AND p.linked_sar IS NULL), ('fee_on_monthly_invoice'::text,true,p.total_sar - p.linked_sar,p.kind = 'billing'::text AND p.total_sar > p.linked_sar), ('billing_short'::text,false,p.linked_sar - p.total_sar,p.kind = 'billing'::text AND p.total_sar < p.linked_sar), ('dpin_differs'::text,false,p.dpin_total - (p.total_sar - COALESCE(p.approved_sar, 0::numeric)),p.dpin_total IS NOT NULL AND abs(p.dpin_total - (p.total_sar - COALESCE(p.approved_sar, 0::numeric))) > 1::numeric AND NOT (p.dpin_total = p.total_sar AND COALESCE(p.approved_sar, 0::numeric) = 0::numeric)), ('expenses_missing'::text,false,p.dpin_total,p.dpin_total IS NOT NULL AND p.dpin_total = p.total_sar AND COALESCE(p.approved_sar, 0::numeric) = 0::numeric AND NOT COALESCE(p.all_commission, false)), ('dpin_before_ready'::text,false,NULL::numeric,p.dpin IS NOT NULL AND COALESCE(p.any_not_ready, false))) x(check_key, ok, amount_sar, applies)
  WHERE x.applies;
