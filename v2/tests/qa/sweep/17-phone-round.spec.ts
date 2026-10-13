/**
 * The phone-width round (the oversight, 8 Oct): at 390 and 360 px, English and Arabic, as the admin and a member —
 * My day, Tasks, Clients, Pipeline, Profile, the phone bar's More, New task, New client. For each: sideways scroll,
 * tap targets under 44 px, text cut off, the page's direction, the bottom bar covering content, and buttons with no
 * name (a button nobody can tell the use of). New task and New client are saved with TEST names; every write the
 * screens send is counted. Kept out of the full sweep: QA_ROUND=1 run.sh -- --grep "phone round". Made-up people only.
 */
import { expect, test, type Page } from '@playwright/test';
import { fx, hydrated, info, shot, signIn, sql, user, verdict } from './lib';

const AREA = 'phone';
const ARABIC = 'QA phone round: made up';
const READS =
  /^(me|org|list|lists|my_day|tasks|task|partners|partner|people|settings|app_settings|access_matrix|activity|notes|my_note|from_note|hover_partner|achievements|achievement|achievement_categories|projects|contracts|record_history|team_load|following|my_devices|person_devices|sign_in_log|recently_deleted|search|notifications|unread|pipeline|.*_list|.*_get)$/;

type Finding = { page: string; width: number; lang: string; who: string; problem: string };
const findings: Finding[] = [];

async function measure(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const sideways = document.documentElement.scrollWidth - vw;
    const small: string[] = [];
    const cut: string[] = [];
    const unnamed: string[] = [];
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const label = (el: Element) =>
      (el.getAttribute('aria-label') || (el as HTMLElement).innerText || el.getAttribute('title') || '')
        .trim()
        .slice(0, 30);
    for (const el of Array.from(
      document.querySelectorAll('a[href], button, [role=button], input, select, textarea, [role=tab], [role=menuitem]'),
    )) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight * 4) continue;
      // inline links inside running text are exempt (WCAG 2.5.8)
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') continue;
      if (Math.min(r.width, r.height) < 44 && Math.max(r.width, r.height) < 44 * 4)
        small.push(`${label(el) || el.tagName.toLowerCase()} ${Math.round(r.width)}×${Math.round(r.height)}`);
      if ((el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') && !label(el))
        unnamed.push(el.outerHTML.slice(0, 60));
    }
    for (const el of Array.from(document.querySelectorAll('main *'))) {
      if (!visible(el) || el.children.length > 0) continue;
      const s = getComputedStyle(el);
      const he = el as HTMLElement;
      if (
        (s.overflow === 'hidden' || s.textOverflow === 'ellipsis' || s.overflowX === 'hidden') &&
        he.scrollWidth > he.clientWidth + 1 &&
        (he.innerText || '').trim().length > 0
      )
        cut.push((he.innerText || '').trim().slice(0, 30));
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && s.position !== 'fixed')
        cut.push(`off-screen: ${(he.innerText || el.tagName).trim().slice(0, 25)}`);
    }
    // the bottom bar: the page scrolled to its end, does the bar cover the last of main's content?
    const bar = document.querySelector('[data-bottom-bar]');
    let covered = '';
    if (bar && visible(bar)) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const barTop = bar.getBoundingClientRect().top;
      const items = Array.from(
        document.querySelectorAll('main a, main button, main input, main p, main li, main h2, main h3'),
      ).filter(visible);
      const last = items.map((e) => e.getBoundingClientRect()).sort((a, b) => b.bottom - a.bottom)[0];
      if (last && last.bottom > barTop + 1)
        covered = `last content ends at ${Math.round(last.bottom)}, bar starts at ${Math.round(barTop)}`;
      window.scrollTo(0, 0);
    }
    return {
      sideways,
      small: [...new Set(small)],
      cut: [...new Set(cut)],
      unnamed,
      covered,
      dir: document.documentElement.dir || 'ltr',
      lang: document.documentElement.lang,
    };
  });
}

test.describe.configure({ mode: 'serial' });

test('phone round: eight screens at 390 and 360, English and Arabic, admin and member', async ({ browser }) => {
  test.setTimeout(1_200_000);
  const tag = `${fx().tag}${Math.random().toString(36).slice(2, 5)}`;
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       select 'app.arabic_enabled', 'true'::jsonb, core.riyadh_today(), $2, $1
       where not exists (select 1 from core.setting where key = 'app.arabic_enabled' and department_id is null
                           and valid_from = core.riyadh_today() and deleted_at is null)`,
    [user('admin').id, ARABIC],
  );
  const writes: string[] = [];
  try {
    for (const who of ['admin', 'member']) {
      for (const lang of ['en', 'ar']) {
        for (const width of [390, 360]) {
          const ctx = await browser.newContext({
            baseURL: test.info().project.use.baseURL,
            viewport: { width, height: 800 },
            isMobile: true,
            hasTouch: true,
            deviceScaleFactor: 2,
          });
          const page = await ctx.newPage();
          page.on('request', (r) => {
            const u = new URL(r.url());
            const m = u.pathname.match(/\/rest\/v1\/rpc\/([a-z_]+)/);
            if (r.method() !== 'GET' && m && !READS.test(m[1]!)) writes.push(`${who}/${lang}/${width}: ${m[1]}`);
          });
          page.on('response', async (r) => {
            if (/rpc\/task/.test(r.url()) && r.request().method() !== 'GET')
              info({
                area: AREA,
                check: `task call ${who}/${lang}/${width}: ${r.status()} ${new URL(r.url()).pathname} ${(await r.text().catch(() => '')).slice(0, 200)}`,
              });
          });
          await signIn(page, who, '/my-day');
          // the language as a person sets it: Profile → Language (the profile is the source of truth; V216)
          await page.goto('/profile');
          await hydrated(page);
          const langBox = page.getByLabel(/^(Language|اللغة)$/).first();
          if (await langBox.isVisible().catch(() => false)) {
            await langBox.click();
            await page
              .getByRole('option', { name: lang === 'ar' ? /العربية|Arabic/ : /English|الإنجليزية/ })
              .first()
              .click()
              .catch(() => undefined);
            await page.waitForTimeout(1_500);
          }
          page.setDefaultTimeout(15_000);
          const at = (p: string) => `${p} · ${who} · ${lang} · ${width}`;
          const visit = async (name: string, path: string, after?: () => Promise<void>) => {
            await page.goto(path);
            await hydrated(page);
            if (after) await after();
            await page.waitForTimeout(500);
            const m = await measure(page);
            const add = (problem: string) => findings.push({ page: name, width, lang, who, problem });
            if (m.sideways > 1) add(`sideways scroll ${m.sideways}px`);
            if (m.small.length) add(`${m.small.length} tap target(s) under 44px: ${m.small.slice(0, 4).join('; ')}`);
            if (m.cut.length) add(`text cut off: ${m.cut.slice(0, 3).join('; ')}`);
            if (m.unnamed.length) add(`${m.unnamed.length} button(s) with no name`);
            if (m.covered) add(`bottom bar covers content (${m.covered})`);
            const wantDir = lang === 'ar' ? 'rtl' : 'ltr';
            if (m.dir !== wantDir) add(`direction ${m.dir}, expected ${wantDir}`);
            verdict(
              {
                area: AREA,
                screen: at(name),
                check: 'no sideways scroll, direction right',
                detail: `${m.sideways}px, ${m.dir}`,
              },
              m.sideways <= 1 && m.dir === wantDir,
            );
            await shot(page, `phone-${name.replace(/\W+/g, '-')}-${who}-${lang}-${width}`);
          };
          await visit('My day', '/my-day');
          await visit('Tasks', '/tasks');
          await visit('Clients', '/clients');
          await visit('Pipeline', '/pipeline');
          await visit('Profile', '/profile');
          await visit('More menu', '/my-day', async () => {
            await page
              .locator('[data-bottom-more]')
              .first()
              .click()
              .catch(() => undefined);
          });
          // New task: Quick add, saved with a TEST title (once per person and language, at 390)
          await visit('New task', '/tasks', async () => {
            await page
              .locator('[data-add-task]')
              .first()
              .click()
              .catch(() => undefined);
          });
          if (width === 390) {
            const form = page.locator('form[data-quick-add]');
            if (await form.isVisible().catch(() => false)) {
              await form.locator('input[name="title"]').fill(`TEST phone task ${tag} ${who} ${lang}`);
              // the Owner list is the dialog's first combobox (the app's own list, not the hidden native one)
              const owner = page.getByRole('dialog').getByRole('combobox').first();
              if (await owner.isVisible().catch(() => false)) {
                await owner.click();
                await page
                  .getByRole('option')
                  .first()
                  .click({ timeout: 3_000 })
                  .catch(() => undefined);
                await page.waitForTimeout(300);
              }
              await page
                .getByRole('dialog')
                .getByRole('button', { name: /^(Add task|إضافة مهمة)$/ })
                .first()
                .click({ timeout: 5_000 })
                .catch(() =>
                  findings.push({
                    page: 'New task',
                    width,
                    lang,
                    who,
                    problem: 'Save could not be tapped (covered or missing)',
                  }),
                );
              await page.waitForTimeout(1_500);
              const said = (
                await page
                  .locator('[data-sonner-toast], [role=alert], [aria-invalid=true] ~ *')
                  .allInnerTexts()
                  .catch(() => [])
              ).join(' | ');
              info({
                area: AREA,
                screen: `New task · ${who} · ${lang} · ${width}`,
                check: `after Add task: ${said.slice(0, 160) || '(nothing said)'}; dialog open: ${await page
                  .getByRole('dialog')
                  .isVisible()
                  .catch(() => false)}`,
              });
              await shot(page, `phone-New-task-saved-${who}-${lang}-${width}`);
            }
          }
          await page.keyboard.press('Escape').catch(() => undefined);
          // New client: the list's New client, saved with a TEST name (admin only, at 390)
          await visit('New client', '/clients?new=1');
          if (width === 390 && who === 'admin') {
            const dlg = page.getByRole('dialog');
            const name = dlg.locator('input').first();
            if (await name.isVisible().catch(() => false)) {
              await name.fill(`TEST phone client ${tag} ${lang}`);
              const type = dlg.getByLabel(/^(Type|النوع)$/).first();
              if (await type.isVisible().catch(() => false)) {
                await type.click();
                await page
                  .getByRole('option')
                  .first()
                  .click()
                  .catch(() => undefined);
              }
              await dlg
                .getByRole('button', { name: /^(Save|Create|حفظ|إنشاء)/ })
                .first()
                .click()
                .catch(() => undefined);
              await page.waitForTimeout(1_500);
            }
          }
          await ctx.close();
        }
      }
    }
  } finally {
    await sql(`delete from core.setting where key = 'app.arabic_enabled' and reason = $1`, [ARABIC]);
    await sql(`update core.person_profile set locale = 'en' where person_id = any($1::uuid[])`, [
      [user('admin').id, user('member').id],
    ]);
  }
  for (const f of findings)
    info({ area: AREA, screen: `${f.page} · ${f.who} · ${f.lang} · ${f.width}`, check: f.problem });
  const [made] = await sql<{ tasks: number; clients: number }>(
    `select (select count(*)::int from work.task where title like $1) as tasks,
            (select count(*)::int from partner.partner where trade_name_en like $2 or official_name_en like $2) as clients`,
    [`TEST phone task ${tag}%`, `TEST phone client ${tag}%`],
  );
  info({
    area: AREA,
    check: `writes the screens sent: ${writes.length} (${[...new Set(writes.map((w) => w.split(': ')[1]))].join(', ')}); TEST rows saved: ${made!.tasks} task(s), ${made!.clients} client(s)`,
  });
  expect(true).toBe(true);
});
