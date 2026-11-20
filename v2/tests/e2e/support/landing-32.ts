/**
 * Landing 32 (Finance F-B) · what its two browser specs share: made-up people in each role, made-up organisations
 * with a client ID, imported money rows, a far-past month that is one test's alone, and the clean-up of the lists.
 * Every value is made up.
 */
import { randomUUID } from 'node:crypto';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql, type TestPerson } from './stack';

export const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
export const tag = () => Math.random().toString(36).slice(2, 8);
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
/** A made-up client ID: 9903 and five more digits. */
export const clientId = () => `9903${Math.floor(Math.random() * 90000 + 10000)}`;
/** A made-up row number. */
export const rowNo = () => `9932${Math.floor(Math.random() * 900000 + 100000)}`;
/** The number written in a figure ("1,350 SAR" → 1350). */
export const num = (s: string) => Number(s.replace(/[^\d.-]/g, ''));

export type Door = <T = { id?: string }>(fn: string, args: Record<string, unknown>) => Promise<T>;
export type RoleKey = 'admin' | 'head' | 'manager' | 'member' | 'viewer' | 'none';

/** A made-up person holding one of the five roles, or none at all. */
export async function personAs(role: RoleKey): Promise<TestPerson> {
  const p = await makePerson({ admin: role === 'admin' });
  if (role === 'none') await sql(`update core.person set role_id = null where id = $1`, [p.id]);
  else if (role !== 'admin' && role !== 'member')
    await sql(`update core.person set role_id = (select id from core.role where key = $1) where id = $2`, [role, p.id]);
  return p;
}

export const doorOf =
  (context: BrowserContext): Door =>
  async <T>(fn: string, args: Record<string, unknown>) => {
    const r = await callAs(context, fn, args);
    expect(r.status, `${fn}: ${JSON.stringify(r.body)}`).toBe(200);
    return r.body as T;
  };

/** An admin signed in on this page, with the doors of the database in hand. */
export async function signedInAdmin(page: Page): Promise<{ call: Door; admin: TestPerson }> {
  const admin = await makePerson({ admin: true });
  // one made-up import from Payments is logged, so the Finance page is past "Not imported yet"
  await sql(
    `insert into finance.import_batch (id, file, file_name, export_time, started_by)
     values ('00000000-0000-4000-8000-0000000f1ce5', 'invoices', 'made-up-invoices.xlsx', now() - interval '1 day', $1)
     on conflict (id) do nothing`,
    [admin.id],
  );
  await signIn(page, admin.email, '/my-day');
  await hydrated(page);
  return { call: doorOf(page.context()), admin };
}

/** A second browser signed in as another person; close it when done. */
export async function signedInAs(browser: Browser, person: TestPerson, from = '/my-day') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await signIn(page, person.email, from);
  return { context, page };
}

/** A made-up organisation with its own client ID. */
export async function seedOrg(call: Door, words: string) {
  const name = `Made Up ${words} Org ${tag()}`;
  const cid = clientId();
  const p = await call('partner_create', {
    p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
  });
  const id = p.id!;
  await call('identifier_add', {
    p_partner: id,
    p_kind: 'payments_client_id',
    p_value: cid,
    p_reason: 'made up',
    p_subkind: 'postpaid',
  });
  return { id, name, cid };
}

export type Imported = { number: string; revenue: number; cost: number | null };

/** Imported, fully paid transactions of one organisation on one day. */
export async function seedImported(partnerId: string, byId: string, day: string, rows: Imported[]) {
  const batch = randomUUID();
  await sql(
    `insert into work.import_batch (id, partner_id, signature, file_name, created_by)
     values ($1, $2, 'invoice_export', 'made-up-l32.csv', $3)`,
    [batch, partnerId, byId],
  );
  for (const r of rows)
    await sql(
      `insert into work.import_record
         (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar,
          profit_sar, fully_paid, created_by)
       values ($1, $2, 'transaction', $3, $3, $4, $5, $5, $6, $7, true, $8)`,
      [partnerId, batch, r.number, day, r.revenue, r.cost, r.cost === null ? null : r.revenue - r.cost, byId],
    );
}

/**
 * A far-past month that is this test's alone: what an earlier run of the same test left in it is put away first, so
 * the page-wide figures of the month are exactly the rows seeded now.
 */
export async function ownMonth(month: string) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
  await sql(
    `update work.import_record set deleted_at = now(), delete_reason = 'made up e2e: an earlier run'
      where record_date between $1 and $2 and deleted_at is null`,
    [from, to],
  );
  return { from, to, mid: `${month}-15`, url: `/finance?period=custom&from=${from}&to=${to}` };
}

/** The lists are everyone's: whatever these tests typed on them is taken off again. */
export async function clearMadeUpRules() {
  await sql(
    `update finance.exclusion_rule set deleted_at = now() where reason like 'made up e2e%' and deleted_at is null`,
  );
  await sql(`update finance.merge_rule set deleted_at = now() where reason like 'made up e2e%' and deleted_at is null`);
}
