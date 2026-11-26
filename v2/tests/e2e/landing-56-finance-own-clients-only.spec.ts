/**
 * Landing 56 — "Own clients only" on Finance (the owner's approval of 26 Nov 2026), on the real stack.
 * A team member opens Finance and reads all of it; "New invoice" is offered and its form opens. On the Ledger they
 * are offered the deal-type control on the row of a client that is theirs, and not on a colleague's client's row.
 * An invoice sent straight to the database is kept for their own client and refused, in words, for a colleague's —
 * and nothing of the refused one is kept. A manager is offered the control on every row. The database decides
 * (OWN-02). Every value is made up.
 * Sabotages: tests/sabotage/landing-56-e2e.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { blocksSettled } from './support/finance-blocks';
import {
  clientId,
  hydrated,
  ownMonth,
  personAs,
  rowNo,
  seedImported,
  signedInAdmin,
  signedInAs,
  tag,
  today,
} from './support/landing-32';
import { callAs, sql } from './support/stack';

async function openFinance(page: Page, url: string) {
  await page.goto(url);
  await hydrated(page);
  await blocksSettled(page);
  await expect(page.locator('[data-finance-report]'), 'the Ledger has answered').toBeVisible({ timeout: 45_000 });
}
const ledgerRow = (page: Page, number: string) => page.locator('[data-finance-ledger-row]').filter({ hasText: number });
const setDeal = (page: Page, number: string) => ledgerRow(page, number).locator('[data-ledger-set-deal-type]');

test('a team member changes Finance entries of their own clients only; a manager of every client', async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { call, admin } = await signedInAdmin(page);
  const owner = await personAs('member');
  const colleague = await personAs('member');
  const manager = await personAs('manager');
  const month = await ownMonth('1957-06');

  // two clients, each with its client ID and one imported row in a month that is this test's alone
  const org = async (words: string, ownerId: string) => {
    const made = await call('partner_create', {
      p_partner: {
        trade_name_en: `Made Up ${words} Org ${tag()}`,
        sides: [{ side: 'client', type: 'corporate', owner_id: ownerId }],
      },
    });
    const cid = clientId();
    await call('identifier_add', {
      p_partner: made.id!,
      p_kind: 'payments_client_id',
      p_value: cid,
      p_reason: 'made up',
      p_subkind: 'prepaid',
    });
    return { id: made.id!, cid };
  };
  const mine = await org('Own Client', owner.id);
  const theirs = await org('Colleague Client', colleague.id);
  const myRow = rowNo();
  const theirRow = rowNo();
  await seedImported(mine.id, admin.id, month.mid, [{ number: myRow, revenue: 700, cost: 200 }]);
  await seedImported(theirs.id, admin.id, month.mid, [{ number: theirRow, revenue: 300, cost: 100 }]);

  // the team member: reads all of Finance, is offered New invoice, and the control on their own client's row only
  const me = await signedInAs(browser, owner, '/my-day');
  await openFinance(me.page, month.url);
  await expect(me.page.locator('[data-new-invoice-link]'), 'a team member is offered New invoice').toBeVisible();
  await expect(ledgerRow(me.page, myRow), 'a team member reads their own client’s row').toBeVisible();
  await expect(ledgerRow(me.page, theirRow), 'and a colleague’s client’s row').toBeVisible();
  await expect(setDeal(me.page, myRow), 'the deal-type control is on their own client’s row').toBeVisible({
    timeout: 30_000,
  });
  await expect(setDeal(me.page, theirRow), 'and not on a colleague’s client’s row').toHaveCount(0);
  await me.page.goto('/finance/new');
  await hydrated(me.page);
  await expect(me.page.locator('[data-new-invoice]'), 'the New invoice form opens for a team member').toBeVisible();

  // straight to the database: kept for their own client, refused for a colleague's, and nothing of that one is kept
  const invoice = (ref: string, cid: string) => ({
    p_table: 'invoice',
    p_fields: { ref, kind: 'standalone', client_id: cid, status: 'Fully Paid', created_on: today(), total_sar: 900 },
    p_reason: 'made up e2e: typed',
  });
  const ownRef = `L56-A-${tag()}`;
  const otherRef = `L56-B-${tag()}`;
  const kept = await callAs(me.context, 'finance_row_add', invoice(ownRef, mine.cid));
  expect(kept.status, `their own client's invoice is kept: ${JSON.stringify(kept.body)}`).toBe(200);
  const refused = await callAs(me.context, 'finance_row_add', invoice(otherRef, theirs.cid));
  expect(refused.status, `a colleague's client's invoice is refused: ${JSON.stringify(refused.body)}`).toBe(403);
  expect(JSON.stringify(refused.body), 'in words').toContain('finance.own_clients_only');
  const left = await sql<{ n: number }>(`select count(*)::int as n from finance.invoice where ref = $1`, [otherRef]);
  expect(left[0]?.n, 'nothing of the refused invoice is kept').toBe(0);
  const deal = await callAs(me.context, 'finance_deal_type_set', {
    p_partner: theirs.id,
    p_number: theirRow,
    p_type: 'tender',
    p_reason: 'made up e2e: a colleague tries',
  });
  expect(deal.status, `nor a deal type on a colleague's client's row: ${JSON.stringify(deal.body)}`).toBe(403);
  // the typed invoice is put away again, so the next run starts clean
  await sql(`update finance.invoice set deleted_at = now(), delete_reason = 'made up e2e: done' where ref = $1`, [
    ownRef,
  ]);
  await me.context.close();

  // a manager: every row
  const boss = await signedInAs(browser, manager, '/my-day');
  await openFinance(boss.page, month.url);
  await expect(setDeal(boss.page, myRow), 'a manager is offered the control on every row').toBeVisible({
    timeout: 30_000,
  });
  await expect(setDeal(boss.page, theirRow)).toBeVisible();
  await boss.context.close();
});
