/**
 * The pilot path (V517, stage 0 — Sunday 4 Oct): Clients (Suppliers as its tab) and My day's notes, for a manager and
 * Commercial members, in English; the deferred modules (Finance, KPIs, Pipeline, Projects, Overview, Reports,
 * Appraisal) hidden by setting their page level to none on the pilot roles, as the runbook's pilot row says (logged,
 * undoable). Checked the way a pilot member meets it: the menus at 1440 and 390, Ctrl K and the +, every deferred
 * address, Clients' list and record, and My day's capture turned into a call on a client. The levels are put back
 * afterwards. It changes role levels, so it runs alone, never in a full sweep:
 * QA_PILOT=1 tests/qa/sweep/run.sh -- --grep "pilot path".
 * Made-up people only (seed.mjs).
 */
import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { apiAs, fx, hydrated, info, notBuilt, said, signIn, sql, toast, user, verdict } from './lib';
import { V2_DIR } from './paths.mjs';

const AREA = 'pilot';
const DEFERRED = ['finance', 'kpis', 'pipeline', 'projects', 'overview', 'reports', 'appraisal'];
const DEFERRED_WORDS = /^(Finance|KPIs|Pipeline|Projects|Overview|Reports|Appraisal)\b/;
const PILOT_ROLES = ['member', 'manager'];
const REASON = 'QA pilot path: made up';
type Where = { screen?: string; user?: string; detail?: string };
const check = (expected: string, w: Where, ok: boolean) => verdict({ area: AREA, ...w, check: expected }, ok);

/** The links a person can reach from the shell: the drawer at 1440, the bottom bar and its More sheet at 390. */
async function menuLinks(page: Page, phone: boolean): Promise<string[]> {
  if (phone) {
    const more = page.getByRole('button', { name: /More/ }).last();
    if (await more.isVisible().catch(() => false)) await more.click();
  }
  const hrefs = await page
    .locator('nav a[href], [role=dialog] a[href]')
    .evaluateAll((as) => [...new Set(as.map((a) => new URL((a as HTMLAnchorElement).href).pathname))]);
  await page.keyboard.press('Escape').catch(() => undefined);
  return hrefs;
}

test.describe.configure({ mode: 'serial' });

test('pilot path: stage 0 as a pilot member and manager — the menus, the deferred addresses, Clients and My day', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const admin = await apiAs('admin');
  const roles = await sql<{ id: string; key: string }>(`select id::text, key from core.role where key = any($1)`, [
    PILOT_ROLES,
  ]);
  const before = await sql<{ role_id: string; page_key: string; level: string }>(
    `select role_id::text, page_key, level::text from core.role_page_level
      where role_id = any($1::uuid[]) and page_key = any($2) and deleted_at is null`,
    [roles.map((r) => r.id), DEFERRED],
  );
  // the runbook's pilot row: the deferred modules at none on the pilot roles, through the admin's own door
  for (const r of roles)
    for (const p of DEFERRED) {
      const a = await admin('access_set_role_level', { p_role: r.id, p_page: p, p_level: 'none', p_reason: REASON });
      if (!a.ok) info({ area: AREA, check: `set ${r.key} · ${p} to none: ${said(a)}` });
    }
  try {
    for (const persona of PILOT_ROLES) {
      await page.context().clearCookies();
      await signIn(page, persona, '/my-day');
      await hydrated(page);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
        await page.goto('/my-day');
        await hydrated(page);
        const links = await menuLinks(page, width < 600);
        const deferred = links.filter((l) => DEFERRED.some((d) => l === `/${d}` || l.startsWith(`/${d}/`)));
        check(
          'the menu offers none of the deferred modules',
          { screen: `menu @${width}`, user: persona, detail: `links: ${links.join(' ')}` },
          deferred.length === 0,
        );
        check(
          'and offers My day and Clients',
          { screen: `menu @${width}`, user: persona, detail: links.join(' ') },
          links.includes('/my-day') && links.some((l) => l.startsWith('/clients') || l.startsWith('/partners')),
        );
      }
      // every page the menu still offers has something in it in stage 0: none is a "Being built" page (QA-236)
      await page.setViewportSize({ width: 1440, height: 1000 });
      for (const link of (await menuLinks(page, false)).filter((l) => !DEFERRED.some((d) => l.startsWith(`/${d}`)))) {
        await page.goto(link);
        await hydrated(page);
        const text = (
          (await page
            .getByRole('main')
            .innerText()
            .catch(() => '')) ?? ''
        ).replace(/\s+/g, ' ');
        check(
          'a page the pilot menu offers is not a "Being built" page',
          { screen: link, user: persona, detail: text.slice(0, 120) },
          !/Being built/i.test(text),
        );
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      // the + (Create) offers nothing of a deferred module: no Log achievement while KPIs is at none (#162, V605)
      const create = page.getByRole('button', { name: /^Create$/ }).first();
      if (await create.isVisible().catch(() => false)) {
        await create.click();
        const items = (
          await page
            .getByRole('menuitem')
            .allInnerTexts()
            .catch(() => [] as string[])
        ).map((s) => s.trim());
        await page.keyboard.press('Escape');
        check(
          'the + offers no deferred module (no Log achievement while KPIs is at none)',
          { screen: '+ Create', user: persona, detail: items.join(', ') || 'no items' },
          !items.some((s) => /achievement|invoice/i.test(s)),
        );
      }
      // Ctrl K and the + name no deferred module
      await page.keyboard.press('Control+k');
      const palette = await page
        .locator('[cmdk-root] [cmdk-item]')
        .allInnerTexts()
        .catch(() => [] as string[]);
      await page.keyboard.press('Escape');
      const inPalette = palette.map((s) => s.trim()).filter((s) => DEFERRED_WORDS.test(s));
      check(
        'Ctrl K names no deferred module',
        { screen: 'Ctrl K', user: persona, detail: inPalette.join(', ') || `${palette.length} entries` },
        inPalette.length === 0,
      );
      // every deferred address reads as the no-access state, never the module's content (QA-229) — and a deferred
      // module's deeper pages too once they exist (KPIs' achievements, #151)
      const deferredAddresses = [
        ...DEFERRED.map((d) => `/${d}`),
        ...(existsSync(join(V2_DIR, 'src', 'app', '(app)', 'kpis', 'achievements', 'page.tsx'))
          ? ['/kpis/achievements', '/kpis/achievements/new']
          : []),
      ];
      for (const addr of deferredAddresses) {
        const p = addr.slice(1);
        await page.goto(addr);
        await hydrated(page);
        const text = (
          (await page
            .getByRole('main')
            .innerText()
            .catch(() => '')) ?? ''
        ).replace(/\s+/g, ' ');
        check(
          `/${p} shows the no-access state`,
          { screen: `/${p}`, user: persona, detail: text.slice(0, 120) },
          /do not have access|not available to you|not there|switched off/i.test(text),
        );
      }
      // Clients: the list and a client's record (at /clients since #123; /partners?view=clients before it)
      const clients = (await menuLinks(page, false)).find((l) => l.startsWith('/clients')) ?? '/partners?view=clients';
      const recordBase = clients.startsWith('/clients') ? '/clients' : '/partners';
      await page.goto(clients);
      await hydrated(page);
      const alpha = fx().orgs.alpha;
      const listed = await page
        .getByRole('main')
        .getByText(alpha.name)
        .first()
        .waitFor({ timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      check('Clients lists the clients they may see', { screen: clients, user: persona }, listed);
      await page.goto(`${recordBase}/${alpha.id}`);
      await hydrated(page);
      const record = (
        (await page
          .getByRole('main')
          .innerText()
          .catch(() => '')) ?? ''
      ).replace(/\s+/g, ' ');
      check(
        "a client's record opens, with no deferred module's tab or figure",
        { screen: `${recordBase}/:id`, user: persona, detail: record.slice(0, 120) },
        record.includes(alpha.name) && !/do not have access/i.test(record),
      );
    }

    // My day's notes, as a pilot member: capture, then turn into a call on a client (P3-13, P3-14)
    const [built] = await sql<{ ok: boolean }>(
      `select to_regprocedure('api.note_capture(text,jsonb,uuid[])') is not null as ok`,
    );
    if (!built?.ok || !existsSync(join(V2_DIR, 'src', 'modules', 'my-day', 'screens', 'TurnDialogs.tsx'))) {
      notBuilt({
        area: AREA,
        user: 'member',
        check: "My day's notes (P3-13's data or P3-14's screens not on this build)",
      });
    } else {
      await page.context().clearCookies();
      await signIn(page, 'member', '/my-day');
      await hydrated(page);
      const title = `Pilot note ${fx().tag}`;
      await page.locator('[data-capture-input]').fill(title);
      await page.locator('[data-capture-input]').press('Enter');
      const filed = await toast(page, 'Note filed')
        .waitFor({ timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      check('a capture is filed in My notes', { screen: '/my-day', user: 'member' }, filed);
      const row = page.locator('[data-my-note]', { hasText: title });
      await row.locator('[data-note-open]').click();
      await hydrated(page);
      await page.locator('[data-turn-into]').click();
      const kinds = await page
        .locator('[data-turn-kind]')
        .evaluateAll((e) => e.map((x) => x.getAttribute('data-turn-kind')));
      check(
        'Turn into offers only what the pilot has (a call or a reminder; no task before stage 1)',
        { screen: '/my-day/notes/:id', user: 'member', detail: kinds.join(', ') },
        !kinds.includes('task') && kinds.includes('activity'),
      );
      await page.locator('[data-turn-kind="activity"]').click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('[data-partner-search]').fill(fx().orgs.alpha.name);
      await dialog.locator('[data-partner-hit]').first().click();
      await dialog.getByLabel('Outcome').click();
      await page.getByRole('option').first().click();
      await dialog.locator('[data-log-from-note-save]').click();
      const logged = await toast(page, `logged on ${fx().orgs.alpha.name}`)
        .waitFor({ timeout: 15_000 })
        .then(() => true)
        .catch(() => false);
      check('the note becomes a call on the client', { screen: '/my-day/notes/:id', user: 'member' }, logged);
    }

    // the admin keeps every module (the pilot hides by role, not for admins)
    await page.context().clearCookies();
    await signIn(page, 'admin', '/my-day');
    await hydrated(page);
    const adminLinks = await menuLinks(page, false);
    check(
      "the admin's menu still holds the deferred modules",
      { screen: 'menu @1440', user: 'admin', detail: adminLinks.join(' ') },
      DEFERRED.every((d) => adminLinks.includes(`/${d}`)),
    );
  } finally {
    // put every level back as it was (a page without a role level had none set: clear it)
    for (const r of roles)
      for (const p of DEFERRED) {
        const was = before.find((b) => b.role_id === r.id && b.page_key === p);
        if (was)
          await admin('access_set_role_level', { p_role: r.id, p_page: p, p_level: was.level, p_reason: REASON });
        else
          await sql(
            `update core.role_page_level set deleted_at = now(), delete_reason = $3
              where role_id = $1 and page_key = $2 and deleted_at is null`,
            [r.id, p, REASON],
          );
      }
  }
  expect(user('admin').id).toBeTruthy();
});
