/**
 * The Architect's ruling of 18 Oct (V630, QA 1's tap-size check): on a phone (375 px) every tappable thing is at least
 * 44 px high — client name links, the "All / Note" chips, switches and checkboxes included — whichever page it is on,
 * because one rule in the shared styles covers them all. On a wide screen the same things keep their compact size.
 * A walk of the main pages and of the dialogs and menus a finger opens from them. Every value is made up.
 * Sabotages: tests/sabotage/tap-sizes.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

/** Every visible tappable thing under 44 px high, described so a failure names it. */
const small = (page: Page) =>
  page.evaluate(() => {
    const tappable =
      'a[href], button, summary, [role=button], [role=tab], [role=link], [role=menuitem], [role=checkbox], [role=switch], [role=option], input:not([type=hidden]):not(.sr-only), select, textarea';
    const found: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(tappable))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.height >= 43.5) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const words = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30);
      found.push(`${Math.round(r.height)} px high: <${el.tagName.toLowerCase()}> ${words}`);
    }
    return Array.from(new Set(found));
  });

async function seed(page: Page) {
  const me = await makePerson({ admin: true });
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), 'test_tasks', 'Test tasks team', 'فريق مهام تجريبي', $1)
     on conflict (department_id, code) do nothing`,
    [me.id],
  );
  await sql(
    `update core.person set team_id = (select t.id from core.team t where t.code = 'test_tasks') where id = $1`,
    [me.id],
  );
  await signIn(page, me.email, '/my-day');
  const ctx = page.context();
  const name = `Test Org Tap ${Math.random().toString(36).slice(2, 8)}`;
  const org = await callAs(ctx, 'partner_create', {
    p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
  });
  expect(org.status, JSON.stringify(org.body)).toBe(200);
  const clientId = (org.body as { id: string }).id;
  const task = await callAs(ctx, 'task_create', { p_values: { title: `Made-up tap ${name}`, partner_id: clientId } });
  expect(task.status, JSON.stringify(task.body)).toBe(200);
  const { number } = task.body as { number: string };
  await sql(`update work.task set due_on = core.riyadh_today() where number = $1`, [number]);
  return { me, clientId, number };
}

test('every tappable thing is at least 44 px high on a phone, on every page and in the dialogs and menus', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 375, height: 800 });
  const { me, clientId, number } = await seed(page);
  const pages = [
    '/my-day',
    '/tasks',
    `/tasks/${number}`,
    '/clients',
    `/clients/${clientId}`,
    '/suppliers',
    '/finance',
    '/profile',
    '/people',
    `/people/${me.id}`,
    '/reports',
    '/achievements',
    '/projects',
    '/kpis',
    '/settings/org',
    '/activity',
  ];
  for (const path of pages) {
    await page.goto(path);
    await hydrated(page).catch(() => undefined);
    expect(await small(page), `every tappable thing is 44 px high on a phone — ${path}`).toEqual([]);
  }

  // what a finger opens from a client's page and from My day
  await page.goto(`/clients/${clientId}`);
  await hydrated(page);
  await page.locator('[data-activity-log]').first().click();
  await expect(page.locator('[data-activity-form]')).toBeVisible();
  expect(await small(page), 'every tappable thing is 44 px high on a phone — Log activity').toEqual([]);
  await page.keyboard.press('Escape');
  await page.locator('[data-partner-more]').click();
  await expect(page.getByRole('menuitem').first()).toBeVisible();
  expect(await small(page), 'every tappable thing is 44 px high on a phone — the ⋯ menu').toEqual([]);
  await page.keyboard.press('Escape');
  await page.goto('/my-day');
  await hydrated(page);
  await page.locator('[data-bell]').click();
  await expect(page.locator('[data-notifications-panel]')).toBeVisible();
  expect(await small(page), 'every tappable thing is 44 px high on a phone — the bell').toEqual([]);
});

test('the client link and the Note chip on My day are 44 px on a phone and stay compact on a wide screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const { number } = await seed(page);
  const high = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((e) => Math.round(e.getBoundingClientRect().height * 10) / 10);

  await page.goto('/my-day');
  await hydrated(page);
  const client = `[data-today-task="${number}"] [data-today-client]`;
  const chip = '[data-kind-option="note"]';
  expect(await high(client), 'the client link on My day is a 44 px target on a phone').toBeGreaterThanOrEqual(43.5);
  expect(await high(chip), 'the All / Note chips are 44 px on a phone').toBeGreaterThanOrEqual(43.5);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await hydrated(page);
  expect(await high(client), 'on a wide screen the client link stays compact').toBeLessThanOrEqual(30);
  expect(await high(chip), 'on a wide screen the chips stay compact').toBeLessThanOrEqual(38);
});
