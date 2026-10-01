/**
 * The oversight's signed-in walk (W33, 1 Oct): every page of the gallery as a member, a manager, an admin and a viewer,
 * at 1440 and 390, in English and Arabic. Each page is read for what a person would notice: a raw catalogue key or a
 * MISSING_MESSAGE, an uncaught error, a page wider than a phone, an empty main area, English left on an Arabic page, and
 * — for a viewer — a button that writes. The menus (the drawer or the phone's More, the profile menu, the bell, Ctrl K)
 * open with entries. Arabic needs the admin's switch (api.app_settings, #136): before it, the Arabic half is NOT BUILT.
 * Made-up people only (seed.mjs).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROUTES } from '../gallery/routes';
import { V2_DIR } from './paths.mjs';
import { fx, hydrated, info, notBuilt, signIn, sql, user, verdict } from './lib';

const AREA = 'walk33';
const PERSONAS = ['member', 'manager', 'admin', 'viewer'];
const WIDTHS = [1440, 390];
/** A catalogue key on screen (`pages.myDay.title`), never inside an email or an address. */
const RAW_KEY = /(?<![\w@./-])[a-z][a-zA-Z]+\.[a-z][a-zA-Z]+(?:\.[a-zA-Z]+)+(?![\w@/-])/g;
/** The catalogue's namespaces (messages/en.json): a dotted word is a key only when it starts with one of them. */
const NAMESPACES = new Set(
  Object.keys(JSON.parse(readFileSync(join(V2_DIR, 'messages', 'en.json'), 'utf8')) as Record<string, unknown>),
);
/** Words that stay Latin on an Arabic page: names of things, formats and codes. */
const LATIN_OK = new Set(
  'Direct Commercial PDF Excel CSV PPTX KPI KPIs VAT ZATCA IBAN SAR Chrome Safari Firefox Edge Linux Windows macOS iOS Android Ctrl QA sweep seed Test'.split(
    ' ',
  ),
);
const WRITE_BUTTON = /^(\+|Add|Create|New|Edit|Remove|Delete|Archive|Save|Switch|Import|Upload|Merge|Assign|Restore)\b/;

/** The fixtures' names and the org names: data, not wording, on any page. */
function dataWords(): Set<string> {
  const f = fx();
  const names = [...Object.values(f.users).map((u) => u.name), f.orgs.alpha.name, f.orgs.beta.name, f.tag];
  return new Set(
    names
      .join(' ')
      .split(/[^A-Za-z]+/)
      .filter(Boolean),
  );
}

async function read(page: Page, width: number) {
  return page.evaluate((w) => {
    const main = document.querySelector('main') as HTMLElement | null;
    const text = (main?.innerText ?? '').replace(/\s+/g, ' ').trim();
    const wide = document.documentElement.scrollWidth > w + 1;
    // the Latin words of the page's own wording: leave out what a person typed (inputs) and codes, emails, numbers
    const latin = [...(main?.innerText ?? '').matchAll(/(?<![\w@.-])[A-Za-z]{3,}(?![\w@.-])/g)].map((m) => m[0]);
    const buttons = [...(main?.querySelectorAll('button, a[role=button]') ?? [])]
      .filter((b) => (b as HTMLElement).offsetParent !== null && !(b as HTMLButtonElement).disabled)
      .map((b) => (b.getAttribute('aria-label') || (b as HTMLElement).innerText || '').trim())
      .filter(Boolean);
    return {
      text,
      wide,
      width: document.documentElement.scrollWidth,
      latin,
      buttons,
      lang: `${document.documentElement.lang}/${document.documentElement.dir}`,
      title: document.title,
    };
  }, width);
}

async function walk(browser: Browser, persona: string, lang: 'en' | 'ar') {
  const ctx = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale: 'en-GB' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(`uncaught: ${e.message.slice(0, 200)}`));
  try {
    await signIn(page, persona, '/my-day');
    if (lang === 'ar') {
      await ctx.addCookies([{ name: 'v2.locale', value: 'ar', url: page.url() }]);
      await page.reload();
    }
    const data = dataWords();
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
      for (const route of ROUTES) {
        const path = route.path(fx(), persona);
        const where = { screen: `${path} @${width}`, user: `${persona} · ${lang}` };
        errors.length = 0;
        await page.goto(path);
        await hydrated(page);
        await page.waitForTimeout(300);
        const r = await read(page, width);
        const keys = [...new Set(r.text.match(RAW_KEY) ?? [])].filter((k) => NAMESPACES.has(k.split('.')[0]!));
        const missing = errors.filter((e) => /MISSING_MESSAGE|IntlError/.test(e));
        const other = errors.filter((e) => !/MISSING_MESSAGE|IntlError/.test(e));
        verdict(
          {
            area: AREA,
            ...where,
            check: `${route.id}: no catalogue key or MISSING_MESSAGE`,
            detail: [...keys, ...missing].join(' | ').slice(0, 300),
          },
          keys.length === 0 && missing.length === 0,
        );
        verdict(
          {
            area: AREA,
            ...where,
            check: `${route.id}: no uncaught or console error`,
            detail: other.join(' | ').slice(0, 300),
          },
          other.length === 0,
        );
        verdict(
          { area: AREA, ...where, check: `${route.id}: the main area says something`, detail: r.text.slice(0, 80) },
          r.text.length >= 8,
        );
        if (width > 600)
          verdict(
            {
              area: AREA,
              ...where,
              check: `${route.id}: W37 · QA-219 · the tab title names the page, not only the app`,
              detail: r.title,
            },
            r.title.trim().length > 0 && !/^(Commercial|Commercial Workspace)$/.test(r.title.trim()),
          );
        if (/no access|not available to you|ليس لديك|لا يمكنك/i.test(r.text))
          info({
            ...where,
            area: AREA,
            check: `${route.id}: W40 · the no-access wording`,
            detail: r.text.slice(0, 160),
          });
        if (width < 600)
          verdict(
            { area: AREA, ...where, check: `${route.id}: nothing wider than the phone`, detail: `page ${r.width}px` },
            !r.wide,
          );
        if (lang === 'ar') {
          const left = [...new Set(r.latin.filter((w) => !LATIN_OK.has(w) && !data.has(w)))];
          verdict(
            {
              area: AREA,
              ...where,
              check: `${route.id}: Arabic, right to left, no English wording left`,
              detail: `${r.lang}; ${left.slice(0, 15).join(' ')}`,
            },
            r.lang === 'ar/rtl' && left.length === 0,
          );
        }
        if (persona === 'viewer' && lang === 'en') {
          const writes = r.buttons.filter((b) => WRITE_BUTTON.test(b));
          verdict(
            {
              area: AREA,
              ...where,
              check: `${route.id}: a viewer is offered no button that writes`,
              detail: writes.slice(0, 10).join(', '),
            },
            writes.length === 0,
          );
        }
      }
      if (width < 600) {
        const box = await page
          .locator('[data-topbar] input[type=search], [data-topbar] [role=searchbox], [data-topbar] [data-search]')
          .first()
          .boundingBox()
          .catch(() => null);
        verdict(
          {
            area: AREA,
            screen: `/my-day @${width}`,
            user: `${persona} · ${lang}`,
            check: 'W41 · QA-222 · the phone search box is at least 44 px high (a finger-sized target)',
            detail: box ? `${Math.round(box.width)}×${Math.round(box.height)} px` : 'not found',
          },
          !!box && box.height >= 44,
        );
      }
      // the menus open, with entries, without an error
      await page.goto('/my-day');
      await hydrated(page);
      errors.length = 0;
      const menus: [string, () => Promise<void>, string][] = [
        [
          'the profile menu',
          () => page.locator('[data-topbar] [data-profile-chip]').first().click(),
          '[role=menu] [role=menuitem], [role=menu] a',
        ],
        ['Ctrl K', () => page.keyboard.press('Control+k'), '[cmdk-root] [cmdk-item]'],
        ['the bell', () => page.locator('[data-bell]').first().click(), '[role=dialog] *, [data-bell-panel] *'],
        [
          width < 600 ? "the phone bar's More" : 'the drawer',
          width < 600
            ? () =>
                page
                  .getByRole('button', { name: lang === 'ar' ? /المزيد|More/ : /More/ })
                  .last()
                  .click()
            : async () => undefined,
          width < 600 ? '[role=dialog] a, [data-more-sheet] a' : 'nav a',
        ],
      ];
      for (const [name, open, items] of menus) {
        await page.keyboard.press('Escape').catch(() => undefined);
        const opened = await open()
          .then(() => true)
          .catch(() => false);
        const n = opened ? await page.locator(items).count() : 0;
        verdict(
          {
            area: AREA,
            screen: `/my-day @${width}`,
            user: `${persona} · ${lang}`,
            check: `${name} opens with entries`,
            detail: `${opened ? 'opened' : 'could not open'}; ${n} entries; ${errors.join(' | ').slice(0, 200)}`,
          },
          opened && n > 0 && errors.length === 0,
        );
      }
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  } finally {
    await ctx.close();
  }
  info({
    area: AREA,
    user: `${persona} · ${lang}`,
    check: `W33 · walked ${ROUTES.length} pages at ${WIDTHS.join(' and ')}`,
  });
  expect(true).toBe(true);
}

for (const persona of PERSONAS)
  test(`W33 · ${persona} · en: every page at 1440 and 390, and the menus`, async ({ browser }) => {
    test.setTimeout(600_000);
    await walk(browser, persona, 'en');
  });

const ARABIC = 'QA W33: made up';
test('W33 · member, manager, admin and viewer · ar: every page at 1440 and 390, and the menus', async ({ browser }) => {
  test.setTimeout(2_400_000);
  const [built] = await sql<{ ok: boolean }>(`select to_regprocedure('api.app_settings()') is not null as ok`);
  if (!built?.ok)
    return notBuilt({
      area: AREA,
      check: 'W33 · ar: Arabic cannot be switched on before api.app_settings (#136, V214)',
    });
  // one admin switch for the four walks: a setting holds one value per day (setting_one_per_date)
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       select 'app.arabic_enabled', 'true'::jsonb, core.riyadh_today(), $2, $1
       where not exists (select 1 from core.setting where key = 'app.arabic_enabled' and department_id is null
                           and valid_from = core.riyadh_today() and deleted_at is null)`,
    [user('admin').id, ARABIC],
  );
  try {
    for (const persona of PERSONAS) await walk(browser, persona, 'ar');
  } finally {
    await sql(`delete from core.setting where key = 'app.arabic_enabled' and reason = $1`, [ARABIC]);
  }
});
