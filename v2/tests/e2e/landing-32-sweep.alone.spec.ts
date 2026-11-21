/**
 * Landing 32 (Finance F-B) · the sweep: every role (admin, head, manager, member, viewer, and a person with no role)
 * × a PC (1,440 px) and a phone (375 px) × English and Arabic, on the four places the landing changed — the Finance
 * page for a far-past month, Settings → Finance, an organisation's Finance tab, and a code's detail under /codes —
 * over seeded rows that include a row excluded by hand, a row a list rule excludes, and rows with no cost.
 * On every page, every row drawn in the landing's areas is tested (it stays inside the screen; a row with no cost
 * never shows a bare 0), and the page itself is checked: nothing scrolls sideways, no word is under 12 px, the page
 * did not crash, it reads in the right direction, on a phone every button of the landing is 44 px high, an admin has
 * the buttons and nobody else does, and a person without access gets the no-access state.
 * What was tested is written to test-results/l32-sweep.json; one row with an issue fails the sweep.
 * Arabic is a switch of the whole app, so this runs alone. Every value is made up.
 * Sabotage: tests/sabotage/landing-32-e2e.mjs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { withArabicOn } from './support/arabic';
import {
  clearMadeUpRules,
  hydrated,
  ownMonth,
  personAs,
  rowNo,
  seedImported,
  seedOrg,
  signedInAdmin,
  tag,
  today,
  type RoleKey,
} from './support/landing-32';
import { smallWords } from './support/look';
import { signIn, sql } from './support/stack';

const ROLES: RoleKey[] = ['admin', 'head', 'manager', 'member', 'viewer', 'none'];
const WIDTHS = [1440, 375] as const;
const OUT = 'test-results/l32-sweep.json';

type PageKey = 'finance' | 'settings' | 'tab' | 'code';
type Seed = { finance: string; tab: string; code: string; noCost: string[]; noCostOrg: string };
type Entry = {
  role: RoleKey;
  width: number;
  language: 'en' | 'ar';
  rowsTested: number;
  rowsWithIssue: number;
  issues: string[];
  pages: Record<string, number>;
};

/** The rows the landing draws, by page. */
const ROWS: Record<PageKey, string> = {
  finance:
    '[data-finance-ledger-row], [data-ledger-not-counted-row], [data-counted-table] tbody tr, [data-finance-ledger-companies] tbody tr',
  settings: '[data-exclusion-rule], [data-exclusion-row-rule], [data-merge-rule]',
  tab: '[data-partner-finance-row], [data-company-not-counted-row]',
  code: '[data-code-use]',
};
/** The landing's buttons: 44 px high on a phone. */
const BUTTONS =
  '[data-ledger-exclude], [data-ledger-include], [data-exclusion-add], [data-merge-add], [data-exclusion-remove], [data-merge-remove], [data-code-exclude], [data-code-include]';
/** The buttons only an admin has. */
const ADMIN_ONLY = '[data-ledger-exclude], [data-ledger-include], [data-code-exclude], [data-code-include]';

let seed: Seed | undefined;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  await clearMadeUpRules();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const { call, admin } = await signedInAdmin(page);
    const month = await ownMonth('1966-06');
    const d = today();
    const orgA = await seedOrg(call, 'Sweep');
    const orgB = await seedOrg(call, 'Sweep Listed');
    const orgC = await seedOrg(call, 'Sweep No Cost');
    const [a1, a2, a3, b1, c1, t1, t2, t3] = Array.from({ length: 8 }, rowNo) as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    // the far-past month: a costed row, a row with no cost, a row excluded by hand, a row a list rule excludes, and
    // an organisation none of whose rows has a cost
    await seedImported(orgA.id, admin.id, month.mid, [
      { number: a1, revenue: 500, cost: 200 },
      { number: a2, revenue: 300, cost: null },
      { number: a3, revenue: 250, cost: 50 },
    ]);
    await seedImported(orgB.id, admin.id, month.mid, [{ number: b1, revenue: 150, cost: 50 }]);
    await seedImported(orgC.id, admin.id, month.mid, [{ number: c1, revenue: 400, cost: null }]);
    await call('finance_row_exclude', { p_partner: orgA.id, p_number: a3, p_reason: 'made up e2e: sweep row' });
    await call('finance_exclusion_rule_save', {
      p_id: null,
      p_fields: { kind: 'client_id', value: orgB.cid, reason: 'made up e2e: sweep list' },
      p_reason: 'made up e2e: sweep list',
    });
    await call('finance_merge_rule_save', {
      p_id: null,
      p_fields: {
        kind: 'discount_code',
        value: `MADEUPE2ESWEEP${tag().toUpperCase()}`,
        partner_id: orgA.id,
        reason: 'made up e2e: sweep merge',
      },
      p_reason: 'made up e2e: sweep merge',
    });
    // this year, for the organisation's tab (year to date): the same three kinds of row
    await seedImported(orgA.id, admin.id, d, [
      { number: t1, revenue: 500, cost: 200 },
      { number: t2, revenue: 300, cost: null },
      { number: t3, revenue: 250, cost: 50 },
    ]);
    await call('finance_row_exclude', { p_partner: orgA.id, p_number: t3, p_reason: 'made up e2e: sweep tab row' });
    // a code with two uses: one counted, one excluded by hand
    const code = await call('identifier_add', {
      p_partner: orgA.id,
      p_kind: 'discount_code',
      p_value: `MADEUPE2E${tag().toUpperCase()}`,
      p_reason: 'made up',
    });
    const [u1, u2] = [`TX-L${rowNo()}`, `TX-L${rowNo()}`];
    await call('finance_import', {
      p_file: 'invoices',
      p_rows: [u1, u2].map((ref) => ({
        ref,
        status: 'Fully Paid',
        created_on: d,
        total_sar: 800,
        client_id: orgA.cid,
      })),
      p_export_time: new Date().toISOString(),
    });
    // The counted use has an approved cost. (A use recorded here with no approved expense reads "Cost 0" on the
    // code's detail — the database hands that page 0 for it, an older fault than this landing, reported to the lead;
    // the no-cost rows this sweep tests are the imported ones, on the Finance page and the organisation's tab.)
    await call('finance_import', {
      p_file: 'expenses',
      p_rows: [{ ref: u1, expense_type: 'Hotel', status: 'Approved', amount_sar: 300, created_at: `${d}T10:00:00Z` }],
      p_export_time: new Date().toISOString(),
    });
    for (const ref of [u1, u2])
      await call('code_use_add', { p_code: code.id, p_invoice_ref: ref, p_discount: 80, p_reason: 'made up: a use' });
    await call('finance_row_exclude', { p_partner: orgA.id, p_number: u2, p_reason: 'made up e2e: sweep use' });
    seed = {
      finance: month.url,
      tab: `/partners/${orgA.id}?tab=finance`,
      code: `/codes?code=${code.id}`,
      noCost: [a2, c1, t2],
      noCostOrg: orgC.id,
    };
  } finally {
    await context.close();
  }
});

test.afterAll(async () => {
  await clearMadeUpRules();
});

/** Adds one role × width × language to the file, beside what the other roles wrote. */
function record(entry: Entry) {
  mkdirSync('test-results', { recursive: true });
  const all: Entry[] = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as { sweep: Entry[] }).sweep : [];
  const kept = all.filter((e) => !(e.role === entry.role && e.width === entry.width && e.language === entry.language));
  const sweep = [...kept, entry];
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        rowsTested: sweep.reduce((s, e) => s + e.rowsTested, 0),
        rowsWithIssue: sweep.reduce((s, e) => s + e.rowsWithIssue, 0),
        sweep,
      },
      null,
      2,
    ),
  );
}

/** Waits until the page has drawn what this person is to see on it; says what is missing instead of throwing. */
async function settle(page: Page, key: PageKey, role: RoleKey, phone: boolean): Promise<string[]> {
  const missing: string[] = [];
  const seen = async (selector: string, what: string, timeout = 45_000) => {
    try {
      await page.locator(selector).first().waitFor({ state: 'visible', timeout });
    } catch {
      missing.push(what);
    }
  };
  const gone = async (selector: string, what: string) => {
    try {
      await expect(page.locator(selector)).toHaveCount(0, { timeout: 45_000 });
    } catch {
      missing.push(what);
    }
  };
  // Settings → Finance holds the credit limit for everyone who signs in (Landing 31); the lists are an admin's
  if (role === 'none' && key !== 'settings') {
    await seen('[data-state="no-access"]', 'a person without access is not shown the no-access state', 20_000);
    return missing;
  }
  // every role reads Finance and a partner's Finance tab (the owner, 21 Nov: a Team member starts at Full on both, a
  // Viewer at View; this overrules Landing 34's none for a member) — so a member is swept like a manager below
  if (key === 'finance') {
    await gone('[data-finance-overview] [data-state="loading"]', 'the Overview blocks never answered');
    if (phone) await page.locator('[role=tab][id$="-tab-ledger"]').click();
    await seen('[data-finance-report]', 'the Ledger was not drawn');
    await seen('[data-counted-table] tbody tr', 'Is it counted? was not drawn');
  } else if (key === 'settings') {
    if (role === 'admin') {
      await seen('[data-exclusion-list] [data-exclusion-rule]', 'the exclusion list was not drawn for the admin');
      await seen('[data-merge-list] [data-merge-rule]', 'the merge list was not drawn for the admin');
    } else {
      await seen('[data-credit-limit], [data-state="no-access"]', 'neither the credit limit nor a no-access state');
    }
  } else if (key === 'tab') {
    await seen('[data-partner-finance-ledger][data-state="ready"]', 'the tab ledger never answered');
    await seen('[data-partner-finance-row]', 'the tab rows were not drawn');
  } else {
    await seen('[data-codes-detail] [data-code-use]', 'the code’s uses were not drawn');
  }
  return missing;
}

/** Tests every row of the landing's areas on the open page, and the page itself. */
async function inspect(page: Page, key: PageKey, role: RoleKey, phone: boolean, dir: 'ltr' | 'rtl') {
  const found = await page.evaluate(
    ({ rows, buttons, adminOnly, noCost, noCostOrg, phone }) => {
      const drawn = (e: Element) => {
        const b = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && s.display !== 'none';
      };
      // a figure that reads 0 once its currency word is taken away ("0", "0 SAR", "0 ريال")
      const isZero = (words: string | null) =>
        /^-?0([.,]0+)?$/.test((words ?? '').replace(/SAR|ريال|ر\.س|\s|\u00a0/g, ''));
      const bareZero = (e: Element) =>
        [...e.querySelectorAll<HTMLElement>('*')].some((x) => drawn(x) && isZero(x.textContent));
      const issues: string[] = [];
      let tested = 0;
      let bad = 0;
      for (const row of document.querySelectorAll<HTMLElement>(rows)) {
        if (!drawn(row)) continue;
        tested += 1;
        const mine: string[] = [];
        const b = row.getBoundingClientRect();
        if (b.left < -0.5 || b.right > window.innerWidth + 0.5) mine.push('runs off the screen');
        const words = row.textContent ?? '';
        if (noCost.some((n) => words.includes(n)) && bareZero(row)) mine.push('a row with no cost shows a bare 0');
        if (row.querySelector(`a[href="/partners/${noCostOrg}"]`) && row.closest('[data-finance-ledger-companies]')) {
          for (const cell of row.querySelectorAll('[data-ledger-partner-cost], [data-ledger-partner-profit]'))
            if (isZero(cell.textContent)) mine.push('an organisation with no cost shows 0');
        }
        if (mine.length) {
          bad += 1;
          issues.push(`row "${words.trim().slice(0, 40)}": ${mine.join('; ')}`);
        }
      }
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      if (overflow > 0) issues.push(`the page scrolls sideways by ${overflow} px`);
      const body = document.body.innerText;
      if (/Something went wrong|This page could not be drawn|Application error/.test(body))
        issues.push('the page crashed');
      if (!document.querySelector('main, #main')?.textContent?.trim()) issues.push('the page is empty');
      if (phone)
        for (const b of document.querySelectorAll<HTMLElement>(buttons)) {
          const h = b.getBoundingClientRect().height;
          if (drawn(b) && h < 43.5) issues.push(`a button is ${Math.round(h)} px high on a phone`);
        }
      const adminButtons = [...document.querySelectorAll(adminOnly)].filter(drawn).length;
      const lists = document.querySelectorAll('[data-exclusion-list], [data-merge-list]').length;
      return { tested, bad, issues, adminButtons, lists, dir: document.documentElement.getAttribute('dir') };
    },
    {
      rows: ROWS[key],
      buttons: BUTTONS,
      adminOnly: ADMIN_ONLY,
      noCost: seed!.noCost,
      noCostOrg: seed!.noCostOrg,
      phone,
    },
  );
  const issues = [...found.issues];
  if (found.dir !== dir) issues.push(`the page reads ${found.dir}, not ${dir}`);
  const small = await smallWords(page);
  if (small.length) issues.push(`words under 12 px: ${small.slice(0, 3).join(' | ')}`);
  // who has the buttons, and who sees the lists
  if (role === 'admin' && (key === 'finance' || key === 'code') && found.adminButtons < 2)
    issues.push('the admin is missing Exclude or Include');
  if (role !== 'admin' && found.adminButtons > 0) issues.push('someone who is not an admin has Exclude or Include');
  if (role !== 'admin' && found.lists > 0) issues.push('someone who is not an admin sees the lists');
  if (role !== 'none' && found.tested === 0 && (key !== 'settings' || role === 'admin'))
    issues.push('no row of the landing was drawn');
  return { tested: found.tested, bad: found.bad, issues };
}

for (const role of ROLES) {
  test(`the sweep as ${role === 'none' ? 'a person with no role' : `a${role === 'admin' ? 'n' : ''} ${role}`}: PC and phone, English and Arabic`, async ({
    page,
  }) => {
    test.setTimeout(600_000);
    expect(seed, 'the seed was made').toBeTruthy();
    const person = await personAs(role);
    const pages: [PageKey, string][] = [
      ['finance', seed!.finance],
      ['settings', '/settings/finance'],
      ['tab', seed!.tab],
      ['code', seed!.code],
    ];
    const entries: Entry[] = [];
    const walk = async (language: 'en' | 'ar') => {
      for (const width of WIDTHS) {
        const phone = width < 700;
        await page.setViewportSize({ width, height: phone ? 800 : 1000 });
        const entry: Entry = { role, width, language, rowsTested: 0, rowsWithIssue: 0, issues: [], pages: {} };
        for (const [key, url] of pages) {
          await page.goto(url);
          await hydrated(page);
          const missing = await settle(page, key, role, phone);
          const found = await inspect(page, key, role, phone, language === 'ar' ? 'rtl' : 'ltr');
          entry.rowsTested += found.tested;
          entry.rowsWithIssue += found.bad;
          entry.pages[key] = found.tested;
          entry.issues.push(...[...missing, ...found.issues].map((i) => `${key}: ${i}`));
        }
        record(entry);
        entries.push(entry);
        console.log(
          `[l32-sweep] ${role} · ${width} px · ${language} · rows tested ${entry.rowsTested} · rows with an issue ${entry.rowsWithIssue} · page issues ${entry.issues.length}`,
        );
      }
    };
    await signIn(page, person.email, '/my-day');
    await hydrated(page);
    await walk('en');
    await withArabicOn(person.id, 'Made-up reason: the Landing 32 sweep', async () => {
      await sql(
        `insert into core.person_profile (person_id, created_by, locale) values ($1, $1, 'ar')
           on conflict (person_id) do update set locale = 'ar'`,
        [person.id],
      );
      await page.context().addCookies([{ name: 'v2.locale', value: 'ar', url: new URL(page.url()).origin }]);
      await walk('ar');
    });
    expect(entries, 'both widths in both languages were walked').toHaveLength(4);
    for (const e of entries) {
      const at = `${role} · ${e.width} px · ${e.language}`;
      expect(e.issues, `${at}: no issue on any page`).toEqual([]);
      expect(e.rowsWithIssue, `${at}: no row with an issue`).toBe(0);
      if (role !== 'none') expect(e.rowsTested, `${at}: rows were tested`).toBeGreaterThan(0);
    }
  });
}
