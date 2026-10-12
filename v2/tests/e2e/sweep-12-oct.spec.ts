/**
 * The oversight's production sweep of 12 Oct (the Architect's list D2, D6 and the wording and layout items), at phone and
 * desktop width: a client's Overview, Activity and Related each show only their own content; a client's own timeline
 * says "Client added"; a figure with no value says so in plain words; "1 organisation" agrees in number; the floating +
 * never ends up over the last row of a list (the page keeps its height clear); New client's Key partner switch has a
 * visible label; the task form's ?new=1 is spent when it closes; Finance and Settings are in the menu of the people whose
 * role opens them, in the drawer and in the phone's More sheet. Every value is made up.
 * Sabotage: tests/sabotage/sweep.mjs "overview-tab-repeats-the-timeline", "activity-tab-repeats-the-details",
 * "client-page-says-partner-added", "empty-figure-says-not-measured", "one-organisations", "page-ends-under-the-plus",
 * "key-partner-switch-has-no-label", "task-form-keeps-new-in-the-address", "admin-menu-loses-finance-and-settings".
 */
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });
const tag = () => Math.random().toString(36).slice(2, 8);

async function createClient(context: BrowserContext, name: string) {
  const r = await callAs(context, 'partner_create', {
    p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
  });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return (r.body as { id: string }).id;
}

for (const [label, width, height] of [
  ['desk 1440', 1440, 900],
  ['phone 390', 390, 844],
] as const) {
  test(`${label}: a client's tabs each show only their own content, and its timeline says Client added`, async ({
    page,
  }) => {
    const name = `Sweep Org ${tag()}`;
    await page.setViewportSize({ width, height });
    const admin = await makePerson({ admin: true });
    await signIn(page, admin.email);
    const id = await createClient(page.context(), name);

    await page.goto(`/clients/${id}`);
    await hydrated(page);
    await expect(page.locator('[data-partner-details]'), 'Overview shows the details').toBeVisible();
    await expect(page.locator('[data-partner-notes]'), 'Overview does not repeat the timeline').toHaveCount(0);
    await expect(page.locator('[data-record-rail]'), 'no rail repeats the fields beside a tab').toHaveCount(0);
    // a figure with no value says so in plain words, never "not measured"
    const figures = page.locator('[data-key-figures]');
    await expect(figures, 'a client with no activity says so').toContainText('No activity yet');
    await expect(figures).toContainText('No next step');
    await expect(figures).not.toContainText(/not measured/i);

    await page.goto(`/clients/${id}?tab=activity`);
    await hydrated(page);
    await expect(page.locator('[data-partner-notes]'), 'Activity is the timeline').toBeVisible();
    await expect(page.locator('[data-partner-details]'), 'Activity does not repeat the details').toHaveCount(0);
    await expect(page.locator('[data-record-rail]')).toHaveCount(0);
    await expect(page.locator('main'), 'a client’s timeline says Client added').toContainText('Client added');
    await expect(page.locator('main'), 'never Partner added').not.toContainText('Partner added');

    await page.goto(`/clients/${id}?tab=related`);
    await hydrated(page);
    await expect(page.locator('[data-partner-related]'), 'Related shows what is related').toBeVisible();
    await expect(page.locator('[data-partner-details]'), 'Related does not repeat the details').toHaveCount(0);
    await expect(page.locator('[data-partner-notes]')).toHaveCount(0);
    await expect(page.locator('[data-record-rail]')).toHaveCount(0);
  });
}

test('one organisation agrees in number', async ({ page }) => {
  const name = `Sweep Single ${tag()}`;
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email);
  await createClient(page.context(), name);
  await page.goto(`/clients?q=${encodeURIComponent(name)}`);
  await hydrated(page);
  await expect(page.locator('[data-partners-total]'), '1 organisation, not 1 organisations').toHaveText(
    '1 organisation',
  );
});

test('phone 390: a page keeps the floating + clear of its last row, New client labels its switch, the task form spends ?new=1', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email);

  // the floating + is 56 px at 76 px up: the page's foot is at least that clear (the + never ends over a row)
  await page.goto('/clients');
  await hydrated(page);
  const clear = await page.locator('[data-page]').evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  expect(clear, 'the page keeps the + clear: at least 132 px below its last row').toBeGreaterThanOrEqual(132);

  // New client: the Key partner switch is a visible word, not only an accessible name
  await page.goto('/clients?new=1');
  await hydrated(page);
  await expect(page.locator('[data-partner-form]')).toBeVisible();
  await expect(page.locator('#new-partner-key'), 'the switch has a visible label').toBeVisible();
  await expect(page.locator('[data-key-partner]')).toContainText('Key partner');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-partner-form]')).toHaveCount(0);

  // the task form: Create's ?new=1 is spent when it closes
  await page.goto('/tasks/new');
  await hydrated(page);
  await expect(page).toHaveURL(/\/tasks\?new=1/);
  await expect(page.locator('[data-quick-add]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-quick-add]')).toHaveCount(0);
  await expect(page, 'the address no longer opens the form again').not.toHaveURL(/new=1/);
});

test('Finance and Settings are in the menu of the people whose role opens them: drawer on a desktop, More on a phone', async ({
  page,
}) => {
  const links = async (sel: string) => page.locator(sel).evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  const admin = await makePerson({ admin: true });
  const manager = await makePerson();
  await sql(`update core.person set role_id = (select id from core.role where key = 'manager') where id = $1`, [
    manager.id,
  ]);
  const member = await makePerson();

  for (const [who, finance, settings] of [
    [admin, true, true],
    [manager, true, false],
    [member, false, false],
  ] as const) {
    await page.context().clearCookies();
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, who.email);
    await page.goto('/my-day');
    await hydrated(page);
    const drawer = await links('[data-drawer] a, nav[aria-label="Main"] a');
    expect(drawer.includes('/finance'), `the drawer carries Finance for ${who.name}: ${finance}`).toBe(finance);
    expect(drawer.includes('/settings'), `the drawer carries Settings for ${who.name}: ${settings}`).toBe(settings);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/my-day');
    await hydrated(page);
    const more = page.locator('[data-bottom-more]');
    if (finance || settings) {
      await more.click();
      const sheet = await links('[data-more-sheet] a');
      expect(sheet.includes('/finance'), `More carries Finance for ${who.name}: ${finance}`).toBe(finance);
      expect(sheet.includes('/settings'), `More carries Settings for ${who.name}: ${settings}`).toBe(settings);
    }
  }
});
