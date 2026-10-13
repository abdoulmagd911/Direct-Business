/**
 * The every-control sweep (the oversight's ask of 13 Oct): as an admin, a manager, a member and a viewer, at 1440 and
 * 390, in English and Arabic. Pages are found the way a person finds them — the drawer or the phone bar and its More,
 * the profile menu, the settings tabs, and the links inside each page — not from a fixed list. On each page:
 *  - every button, tab and toggle is pressed once (English only; Arabic presses them as the admin at 390), and what it
 *    did is read: it moved to a page, opened a dialog or a menu, changed the page, saved, or did NOTHING;
 *  - every link is followed once per address pattern, and one that answers Not found is named;
 *  - the wording: a raw catalogue key, a code word a person should never read (null, undefined, NaN, an id, a
 *    decision number), and English left on an Arabic page;
 *  - the layout: sideways scroll, text cut off, and a control covered by something else (the + button, the bar);
 *  - the page's heading, recorded so a heading that names the wrong thing (Suppliers headed Clients) is seen.
 * Destructive presses (sign out, delete, remove, archive, switch off, merge, close month) are never made. Writes are
 * counted. Kept out of the full sweep: QA_ROUND=1 run.sh -- --grep "every control". Made-up people only.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { fx, hydrated, info, shot, signIn, sql, user, verdict } from './lib';
import { V2_DIR } from './paths.mjs';

const AREA = 'control';
const ARABIC = 'QA every-control sweep: made up';
const NEVER =
  /(sign.?out|log.?out|undo|delete|remove|archive|switch off|merge|close month|revoke|end session|تسجيل.{0,3}خروج|تراجع|حذف|إزالة|أرشفة|إيقاف|دمج|إغلاق الشهر)/i;
/** Reads go through POST rpcs too; a call whose name is not one of these is counted as a write. */
const READS =
  /^(me|org|list|lists|my_day|tasks|task|partners|partner|people|settings|app_settings|access_matrix|activity|notes|my_note|from_note|hover_partner|achievements|achievement|achievement_categories|projects|contracts|record_history|team_load|following|my_devices|person_devices|sign_in_log|recently_deleted|search|notifications|unread|notifications_unread|pipeline|overview|views|page_seen|person_open_work|.*_list|.*_get|.*_read|.*_overview|.*_measures|finance_.*)$/;
const RAW_KEY = /(?<![\w@./-])[a-z][a-zA-Z]+\.[a-z][a-zA-Z]+(?:\.[a-zA-Z]+)+(?![\w@/-])/g;
const NAMESPACES = new Set(
  Object.keys(JSON.parse(readFileSync(join(V2_DIR, 'messages', 'en.json'), 'utf8')) as Record<string, unknown>),
);
/** Words a person should never read on a screen. */
const CODE_WORDS =
  /(?<![\w-])(null|undefined|NaN|Invalid Date|\[object Object\]|true|false|uuid|payload|enum|TODO|lorem|V\d{3}|QA-\d+|P\d-\d+[a-z]?)(?![\w-])/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The coverage matrix (the owner's ask of 13 Oct): one JSON line per cell — a page, a link or a control, at a width, in
 * a language, as a role — with what a real press did and the screenshot that shows it. QA_MATRIX names the file. */
type Cell = {
  role: string;
  lang: string;
  width: number;
  route: string;
  kind: string;
  control: string;
  result: string;
  ok: boolean;
  shot: string;
};
function cell(c: Cell): void {
  if (process.env.QA_MATRIX)
    appendFileSync(process.env.QA_MATRIX, `${JSON.stringify({ ...c, at: new Date().toISOString() })}\n`);
}

type Finding = { who: string; lang: string; width: number; page: string; problem: string; severity: string };

/** An address with its record ids and numbers taken out, so one record of a kind stands for all. */
const pattern = (p: string) =>
  p
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id')
    .replace(/\/[A-Z]{2,4}-\d{4}-\d+/g, '/:number')
    .replace(/\/\d+(?=\/|$)/g, '/:n');

async function readPage(page: Page, lang: string) {
  return page.evaluate(
    ({ lang }) => {
      const vw = window.innerWidth;
      const main = document.querySelector('main') as HTMLElement | null;
      const text = (document.body.innerText || '').replace(/\s+/g, ' ');
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
      };
      const cut: string[] = [];
      for (const el of Array.from(document.querySelectorAll('main *'))) {
        if (!visible(el) || el.children.length > 0) continue;
        const he = el as HTMLElement;
        const s = getComputedStyle(el);
        if (
          (s.overflow === 'hidden' || s.textOverflow === 'ellipsis' || s.overflowX === 'hidden') &&
          he.scrollWidth > he.clientWidth + 1 &&
          (he.innerText || '').trim()
        )
          cut.push((he.innerText || '').trim().slice(0, 30));
        if (el.getBoundingClientRect().right > vw + 1 && s.position !== 'fixed')
          cut.push(`off-screen: ${(he.innerText || el.tagName).trim().slice(0, 25)}`);
      }
      // a control whose centre is under something else: the + button, the phone bar, a sticky header
      const covered: string[] = [];
      for (const el of Array.from(main?.querySelectorAll('button, a[href], input, select, [role=tab]') ?? [])) {
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) continue;
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (top && top !== el && !el.contains(top) && !top.contains(el) && !top.closest('label')) {
          const by = top.closest('[data-bottom-bar], [data-create-menu], header, [role=dialog]');
          const name = (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.tagName).trim();
          covered.push(
            `${name.slice(0, 25)} under ${by ? (by.getAttribute('data-bottom-bar') !== null ? 'the phone bar' : by.tagName.toLowerCase() === 'header' ? 'the top bar' : 'the + button') : (top.getAttribute('aria-label') || top.tagName).slice(0, 20)}`,
          );
        }
      }
      const latin =
        lang === 'ar'
          ? [...(main?.innerText ?? '').matchAll(/(?<![\w@.-])[A-Za-z]{3,}(?![\w@.-])/g)].map((m) => m[0])
          : [];
      return {
        h1: (document.querySelector('main h1')?.textContent || '').trim(),
        title: document.title,
        text,
        sideways: document.documentElement.scrollWidth - vw,
        cut: [...new Set(cut)],
        covered: [...new Set(covered)],
        latin,
        dir: document.documentElement.dir || 'ltr',
        links: Array.from(document.querySelectorAll('main a[href]'))
          .filter(visible)
          .map((a) => (a as HTMLAnchorElement).getAttribute('href') || ''),
      };
    },
    { lang },
  );
}

/** The menus a person uses to move about: the drawer (desktop), the phone bar and its More, the settings tabs. */
async function menuLinks(page: Page, width: number): Promise<{ label: string; href: string }[]> {
  const out: { label: string; href: string }[] = [];
  const grab = async (sel: string) => {
    for (const a of await page.locator(sel).all()) {
      if (!(await a.isVisible().catch(() => false))) continue;
      const href = (await a.getAttribute('href')) || '';
      const label = ((await a.getAttribute('aria-label')) || (await a.innerText().catch(() => '')) || '').trim();
      if (href.startsWith('/')) out.push({ label: label.replace(/\s+/g, ' ').slice(0, 40), href });
    }
  };
  if (width > 600) await grab('nav a[href], aside a[href]');
  else {
    await grab('[data-bottom-bar] a[href]');
    const more = page.locator('[data-bottom-more]').first();
    if (await more.isVisible().catch(() => false)) {
      await more.click().catch(() => undefined);
      await page.waitForTimeout(400);
      await grab('[role=dialog] a[href]');
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  }
  // the profile menu
  const chip = page.locator('[data-topbar] [data-profile-chip]').first();
  if (await chip.isVisible().catch(() => false)) {
    await chip.click().catch(() => undefined);
    await page.waitForTimeout(300);
    await grab('[role=menu] a[href]');
    await page.keyboard.press('Escape').catch(() => undefined);
  }
  return out;
}

async function sweep(page: Page, who: string, lang: 'en' | 'ar', width: number, press: boolean, start = '/my-day') {
  const findings: Finding[] = [];
  const add = (pg: string, problem: string, severity: string) =>
    findings.push({ who, lang, width, page: pg, problem, severity });
  const writes: string[] = [];
  page.on('request', (r) => {
    const m = new URL(r.url()).pathname.match(/\/rest\/v1\/rpc\/([a-z_0-9]+)/);
    if (r.method() !== 'GET' && m && !READS.test(m[1]!)) writes.push(m[1]!);
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`uncaught: ${e.message.slice(0, 120)}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && /MISSING_MESSAGE/.test(m.text()))
      errors.push((m.text().match(/MISSING_MESSAGE: [\w.]+/) ?? [m.text()])[0]!);
  });

  await page.goto(start);
  await hydrated(page);
  // signed out, the "menu" is the sign-in page and every main page's address, each of which must lead to sign-in
  const menu =
    start === '/my-day'
      ? await menuLinks(page, width)
      : [
          start,
          '/my-day',
          '/tasks',
          '/clients',
          '/suppliers',
          '/pipeline',
          '/finance',
          '/kpis',
          '/settings',
          '/profile',
        ].map((href) => ({ label: href, href }));
  info({
    area: AREA,
    user: `${who} · ${lang} · ${width}`,
    check: `the menu: ${menu.map((m) => `${m.label} → ${m.href}`).join(' · ')}`,
  });
  // pages to visit: the menu's, then each page's own links, one address per pattern, at most 60
  const queue = [...new Set(menu.map((m) => m.href.split('#')[0]!))];
  const seen = new Set<string>(queue.map(pattern));
  const from = new Map<string, string>(queue.map((q) => [q, 'the menu']));
  const headings: string[] = [];
  let pressed = 0;
  let dead = 0;
  for (let i = 0; i < queue.length && i < 60; i++) {
    const path = queue[i]!;
    const resp = await page.goto(path).catch(() => null);
    await hydrated(page);
    await page.waitForTimeout(400);
    errors.length = 0;
    const r = await readPage(page, lang);
    const pg = pattern(path);
    headings.push(`${pg} = ${r.h1 || '(no heading)'}`);
    if (((resp && resp.status() === 404) || /not found|غير موجودة/i.test(r.h1)) && !/no\/such/.test(path))
      add(pg, `the link ${path} (on ${from.get(path) ?? '?'}) opens Not found`, 'High');
    if (r.sideways > 1) add(pg, `sideways scroll ${r.sideways}px`, 'Medium');
    if (r.cut.length) add(pg, `text cut off: ${r.cut.slice(0, 3).join('; ')}`, 'Low');
    if (r.covered.length) add(pg, `covered (unscrolled): ${r.covered.slice(0, 3).join('; ')}`, 'Low');
    const keys = [...new Set(r.text.match(RAW_KEY) ?? [])].filter((k) => NAMESPACES.has(k.split('.')[0]!));
    if (keys.length) add(pg, `raw catalogue keys: ${keys.slice(0, 5).join(', ')}`, 'Medium');
    const code = [...new Set([...r.text.replace(UUID, '').matchAll(CODE_WORDS)].map((m) => m[0]))];
    if (code.length) add(pg, `code words on screen: ${code.join(', ')}`, 'Medium');
    if (lang === 'ar') {
      if (r.dir !== 'rtl') add(pg, `direction ${r.dir} on an Arabic page`, 'High');
      const left = [...new Set(r.latin)].filter(
        (w) => !/^(Direct|PDF|Excel|CSV|KPI|KPIs|VAT|ZATCA|IBAN|SAR|Test)$/.test(w),
      );
      if (left.length > 2) add(pg, `English left: ${left.slice(0, 10).join(' ')}`, 'Medium');
    }
    if (who === 'signed_out' && path !== start && !/^\/sign-in/.test(new URL(page.url()).pathname))
      add(pg, `signed out, ${path} does not lead to sign-in (landed on ${new URL(page.url()).pathname})`, 'High');
    const pageShot = `control-${who}-${lang}-${width}-${pg.replace(/\W+/g, '-').slice(0, 60)}`;
    await shot(page, pageShot);
    const mine = findings.filter((f) => f.page === pg && f.width === width && f.lang === lang && f.who === who);
    cell({
      role: who,
      lang,
      width,
      route: pg,
      kind: from.get(path) === 'the menu' ? 'menu entry' : 'link',
      control: `${r.h1 || '(no heading)'} (from ${from.get(path) ?? '?'})`,
      result: mine.length
        ? mine
            .map((f) => `[${f.severity}] ${f.problem}`)
            .join(' | ')
            .slice(0, 400)
        : 'opens; nothing wrong found',
      ok: !mine.some((f) => f.severity !== 'Low'),
      shot: pageShot,
    });
    // the page's own links, one per pattern
    for (const href of r.links) {
      if (!href.startsWith('/') || href.startsWith('//')) continue;
      const k = pattern(href.split('#')[0]!);
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push(href.split('#')[0]!);
      from.set(href.split('#')[0]!, path);
    }
    if (!press) continue;
    // every button, tab and toggle in the page's main area, pressed once, the page reloaded after each
    const sel = 'main button, main [role=tab], main [role=switch], main [role=button], main summary';
    const count = await page.locator(sel).count();
    for (let j = 0; j < count && j < 40; j++) {
      const el = page.locator(sel).nth(j);
      if (!(await el.isVisible().catch(() => false))) continue;
      if (await el.isDisabled().catch(() => false)) continue;
      const name = ((await el.getAttribute('aria-label')) || (await el.innerText().catch(() => '')) || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
      if (NEVER.test(name)) continue;
      const on = await el.evaluate(
        (e) =>
          e.getAttribute('aria-pressed') === 'true' ||
          e.getAttribute('aria-selected') === 'true' ||
          e.getAttribute('aria-current') !== null ||
          e.getAttribute('data-state') === 'on' ||
          e.getAttribute('data-state') === 'active',
      );
      if (on) continue;
      const kind = await el.evaluate((e) => {
        const role = e.getAttribute('role');
        if (role === 'tab') return 'tab';
        if (role === 'switch' || role === 'checkbox') return 'toggle';
        if (e.tagName === 'SUMMARY') return 'section';
        if (e.getAttribute('aria-haspopup')) return 'menu';
        if (e.closest('[data-filters], [data-filter-bar]') || /^\+/.test((e.textContent || '').trim())) return 'filter';
        return 'button';
      });
      const before = await page.evaluate(() => ({
        url: location.href,
        text: document.body.innerText,
        layers: document.querySelectorAll(
          '[role=dialog], [role=menu], [role=listbox], [data-radix-popper-content-wrapper]',
        ).length,
        pressed: Array.from(
          document.querySelectorAll(
            '[aria-pressed], [aria-selected], [aria-checked], [aria-expanded], [aria-sort], [data-state]',
          ),
        )
          .map(
            (e) =>
              `${e.getAttribute('aria-pressed')}${e.getAttribute('aria-selected')}${e.getAttribute('aria-checked')}${e.getAttribute('aria-expanded')}${e.getAttribute('data-state')}${e.getAttribute('aria-sort')}`,
          )
          .join(''),
      }));
      const w0 = writes.length;
      const download = page.waitForEvent('download', { timeout: 1_500 }).catch(() => null);
      const clicked = await el
        .click({ timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      pressed++;
      if (!clicked) {
        add(pg, `"${name || '(no name)'}" cannot be pressed (covered or moving)`, 'Medium');
        cell({
          role: who,
          lang,
          width,
          route: pg,
          kind,
          control: name || '(no name)',
          result: 'cannot be pressed (covered or moving)',
          ok: false,
          shot: pageShot,
        });
        await page.goto(path).catch(() => undefined);
        await hydrated(page);
        continue;
      }
      await page.waitForTimeout(700);
      const got = await download;
      const after = await page.evaluate(() => ({
        url: location.href,
        text: document.body.innerText,
        layers: document.querySelectorAll(
          '[role=dialog], [role=menu], [role=listbox], [data-radix-popper-content-wrapper]',
        ).length,
        pressed: Array.from(
          document.querySelectorAll(
            '[aria-pressed], [aria-selected], [aria-checked], [aria-expanded], [aria-sort], [data-state]',
          ),
        )
          .map(
            (e) =>
              `${e.getAttribute('aria-pressed')}${e.getAttribute('aria-selected')}${e.getAttribute('aria-checked')}${e.getAttribute('aria-expanded')}${e.getAttribute('data-state')}${e.getAttribute('aria-sort')}`,
          )
          .join(''),
      }));
      const did =
        after.url !== before.url ||
        after.layers !== before.layers ||
        after.text !== before.text ||
        after.pressed !== before.pressed ||
        writes.length > w0 ||
        !!got;
      if (!did) {
        dead++;
        add(pg, `"${name || '(no name)'}" does nothing when pressed`, 'Medium');
      }
      // a dialog or a menu that opened is a state of its own: its title, its controls, its wording, its picture
      let stateShot = '';
      let what = '';
      if (after.layers > before.layers) {
        const layer = await page.evaluate(() => {
          const l = Array.from(
            document.querySelectorAll(
              '[role=dialog], [role=menu], [role=listbox], [data-radix-popper-content-wrapper]',
            ),
          ).pop() as HTMLElement | undefined;
          return {
            title: (
              l?.querySelector('h1, h2, [role=heading]')?.textContent ||
              l?.getAttribute('aria-label') ||
              ''
            ).trim(),
            controls: Array.from(l?.querySelectorAll('button, a, input, select, [role=menuitem], [role=option]') ?? [])
              .map((c) =>
                (c.getAttribute('aria-label') || (c as HTMLElement).innerText || c.getAttribute('name') || '').trim(),
              )
              .filter(Boolean)
              .slice(0, 12),
            text: (l?.innerText || '').replace(/\s+/g, ' '),
          };
        });
        const keys = [...new Set(layer.text.match(RAW_KEY) ?? [])].filter((k) => NAMESPACES.has(k.split('.')[0]!));
        if (keys.length) add(pg, `"${name}" opens with raw keys: ${keys.slice(0, 4).join(', ')}`, 'Medium');
        stateShot = `${pageShot}-state-${j}`;
        await shot(page, stateShot);
        what = `opens ${layer.title ? `"${layer.title.slice(0, 40)}"` : 'a panel'} with ${layer.controls.length} control(s): ${layer.controls.join(', ').slice(0, 160)}${keys.length ? `; raw keys ${keys.join(', ')}` : ''}`;
      }
      const result = !did
        ? 'does nothing'
        : got
          ? `downloads ${got.suggestedFilename()}`
          : after.url !== before.url
            ? `goes to ${new URL(after.url).pathname}${new URL(after.url).search}`
            : what
              ? what
              : writes.length > w0
                ? `saves (${writes.slice(w0).join(', ')})`
                : after.pressed !== before.pressed
                  ? 'switches on or off'
                  : 'changes the page';
      cell({
        role: who,
        lang,
        width,
        route: pg,
        kind,
        control: name || '(no name)',
        result: errors.length ? `${result}; ${[...new Set(errors)].slice(0, 2).join('; ')}` : result,
        ok: did && !errors.length,
        shot: stateShot || pageShot,
      });
      if (after.url !== before.url && !after.url.startsWith(new URL(before.url).origin))
        add(pg, `"${name}" leaves the app (${after.url.slice(0, 60)})`, 'Medium');
      if (errors.length) add(pg, `"${name}": ${[...new Set(errors)].slice(0, 2).join('; ')}`, 'Medium');
      errors.length = 0;
      await page.keyboard.press('Escape').catch(() => undefined);
      if (after.url !== before.url || after.layers > 0) {
        await page.goto(path).catch(() => undefined);
        await hydrated(page);
      }
    }
  }
  info({ area: AREA, user: `${who} · ${lang} · ${width}`, check: `headings: ${headings.join(' · ')}` });
  info({
    area: AREA,
    user: `${who} · ${lang} · ${width}`,
    check: `visited ${Math.min(queue.length, 60)} page(s), pressed ${pressed} control(s), ${dead} did nothing; writes: ${writes.length} (${[...new Set(writes)].join(', ')})`,
  });
  for (const f of findings)
    info({
      area: AREA,
      screen: f.page,
      user: `${f.who} · ${f.lang} · ${f.width}`,
      check: `[${f.severity}] ${f.problem}`,
    });
  return findings;
}

/** The owner's matrix (13 Oct): the admin, a Commercial member in a team, and someone signed out; QA_CONTROL_ROLES widens it. */
const PEOPLE = (process.env.QA_CONTROL_ROLES ?? 'admin,member,signed_out').split(',');
const WIDTHS = [1440, 375];
// one person's runs one after another (their language lives on their profile); the people side by side
for (const who of PEOPLE)
  test.describe(`every control: ${who}`, () => {
    test.describe.configure({ mode: 'serial' });
    for (const lang of ['en', 'ar'] as const)
      for (const width of WIDTHS)
        test(`every control: ${who} · ${lang} · ${width}`, async ({ browser }) => {
          test.setTimeout(3_600_000);
          if (lang === 'ar')
            await sql(
              `insert into core.setting (key, value, valid_from, reason, created_by)
               select 'app.arabic_enabled', 'true'::jsonb, core.riyadh_today(), $2, $1
               where not exists (select 1 from core.setting where key = 'app.arabic_enabled' and department_id is null
                                   and valid_from = core.riyadh_today() and deleted_at is null)`,
              [user('admin').id, ARABIC],
            );
          const signedOut = who === 'signed_out';
          if (!signedOut) {
            // the profile is the source of truth for the language (V216)
            await sql(
              `insert into core.person_profile (person_id, locale, created_by) values ($1, $2, $1)
               on conflict (person_id) do update set locale = excluded.locale`,
              [user(who).id, lang],
            );
            // the Commercial member works in a team of their department (the pilot's member, as the desktop round)
            if (who === 'member')
              await sql(
                `with t as (
                   insert into core.team (department_id, code, name_en, name_ar)
                   select department_id, 'qa_ctl', 'Test Commercial Team', 'فريق تجاري للاختبار' from core.person where id = $1
                   on conflict do nothing returning id)
                 update core.person set team_id = coalesce((select id from t), (select id from core.team where code = 'qa_ctl'))
                  where id = $1 and team_id is null`,
                [user('member').id],
              );
          }
          const ctx = await browser.newContext({
            baseURL: test.info().project.use.baseURL,
            viewport: { width, height: width > 600 ? 900 : 812 },
            isMobile: width < 600,
            hasTouch: width < 600,
          });
          const page = await ctx.newPage();
          page.setDefaultTimeout(15_000);
          try {
            if (signedOut) {
              // signed out, the language is the cookie's (there is no profile yet)
              await ctx.addCookies([
                { name: 'v2.locale', value: lang, url: test.info().project.use.baseURL as string },
              ]);
            } else await signIn(page, who, '/my-day');
            const found = await sweep(page, who, lang, width, true, signedOut ? '/sign-in' : '/my-day');
            verdict(
              {
                area: AREA,
                user: `${who} · ${lang} · ${width}`,
                check: 'the sweep ran (its findings are listed as INFO, its cells in QA_MATRIX)',
                detail: `${found.length} finding(s); run ${fx().tag}`,
              },
              true,
            );
          } finally {
            await ctx.close();
          }
          expect(true).toBe(true);
        });
  });
