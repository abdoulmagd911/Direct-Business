/**
 * The 13 Oct sweep, nav and Finance (V238): the desktop menu, the phone bar and More are one list — a page shows where the
 * person's access opens it and nowhere else, for an admin and for a Commercial member, at desktop and phone width; the
 * Suppliers page is titled Suppliers (its tab sits under it, Clients keeps
 * its own title), at desktop and phone width; and on a wide Finance window the lists beside the figures fill while the heavy
 * reads (the closed months, the health line) are still on their way — the page never sits on one grey wait. Every value is
 * made up.
 * Sabotage: tests/sabotage/nav-access.mjs "suppliers-page-says-clients", "finance-lists-wait-for-the-heavy-reads",
 * "phone-more-drops-the-last-page", "settings-shown-to-everyone".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn, sql, type TestPerson } from './support/stack';

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

for (const size of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test(`${size.name}: the Suppliers page is titled Suppliers and Clients keeps its title`, async ({ page }) => {
    const admin = await makePerson({ admin: true });
    await page.setViewportSize({ width: size.width, height: size.height });
    await signIn(page, admin.email, '/suppliers');
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1 }), 'the title is the page on screen').toHaveText('Suppliers');
    await expect(page.locator('[data-side-tab="supplier_partner"]')).toHaveAttribute('aria-current', 'page');
    await page.goto('/clients');
    await hydrated(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clients');
    await expect(page.locator('[data-side-tab="client"]')).toHaveAttribute('aria-current', 'page');
  });
}

test('desktop: Finance fills the lists beside the figures while the heavy reads are still on their way', async ({
  page,
}) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  // the closed months and the health line are the heavy reads: hold them back, as a slow database would
  await page.route('**/rest/v1/rpc/finance_*', async (route) => {
    const fn = new URL(route.request().url()).pathname.split('/').pop()!;
    try {
      if (fn === 'finance_closed_months' || fn === 'finance_health') await new Promise((r) => setTimeout(r, 6000));
      const response = await route.fetch();
      await route.fulfill({ response }).catch(() => {
        // the page gave up on this request; the server has answered all the same
      });
    } catch {
      // the test ended while the server was still answering
    }
  });
  await signIn(page, admin.email, '/finance?period=mtd');
  await hydrated(page);
  await expect(
    page.locator('[data-finance-not-invoiced]'),
    'Not yet invoiced fills before the heavy reads',
  ).toBeVisible({
    timeout: 4000,
  });
  await expect(
    page.locator('[data-finance-service], [data-finance-service-empty]').first(),
    'By service fills too',
  ).toBeVisible({
    timeout: 4000,
  });
  await expect(page.locator('[data-finance-months]'), 'the months are still on their way').toHaveCount(0);
  await expect(page.locator('[data-finance-months]'), 'and arrive when their read does').toBeVisible({
    timeout: 30_000,
  });
});

/** A made-up Commercial member: a plain member in a team of the Commercial department. */
async function commercialMember(): Promise<TestPerson> {
  const person = await makePerson();
  await sql(
    `insert into core.department (code, name_en, name_ar) values ('commercial', 'Test department', 'قسم تجريبي')
     on conflict (code) do nothing`,
  );
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), 'test_nav', 'Test nav team', 'فريق تجريبي', $1)
     on conflict (department_id, code) do nothing`,
    [person.id],
  );
  await sql(
    `update core.person set team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                       where d.code = 'commercial' and t.code = 'test_nav') where id = $1`,
    [person.id],
  );
  return person;
}

const drawerPages = async (page: Page) =>
  (await page.locator('[data-drawer] a[href]:not([data-entity])').allInnerTexts()).map((l) => l.trim()).filter(Boolean);

/** The phone's pages in order: the bar's first four, then what More holds (its profile link and Sign out aside). */
async function phonePages(page: Page) {
  const bar = (await page.locator('[data-bottom-bar] a').allInnerTexts()).map((l) => l.trim()).filter(Boolean);
  await page.locator('[data-bottom-more]').click();
  const sheet = page.locator('[data-more-sheet]');
  await expect(sheet).toBeVisible();
  const more = (await sheet.locator('a[href]:not([data-entity])').allInnerTexts()).map((l) => l.trim());
  await page.keyboard.press('Escape');
  return [...bar, ...more];
}

for (const who of ['admin', 'Commercial member'] as const) {
  test(`${who}: the desktop menu, the phone bar and More are one list, and every entry opens a page`, async ({
    browser,
  }) => {
    const person = who === 'admin' ? await makePerson({ admin: true }) : await commercialMember();
    const desktop = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await signIn(desktop, person.email, '/my-day');
    await hydrated(desktop);
    const wide = await drawerPages(desktop);
    expect(wide.length, 'a menu with pages in it').toBeGreaterThan(2);

    const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await signIn(phone, person.email, '/my-day');
    await hydrated(phone);
    expect(
      await phonePages(phone),
      'the phone bar and More list what the desktop menu does, in the same order',
    ).toEqual(wide);

    // a page is in the menu only because it opens: every entry lands on a page, never on the no-access state
    const hrefs = await desktop
      .locator('[data-drawer] a[href]:not([data-entity])')
      .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
    for (const href of hrefs) {
      await desktop.goto(href);
      await hydrated(desktop);
      await expect(desktop.locator('[data-state="no-access"]'), `${href} opens for a ${who}`).toHaveCount(0);
    }

    // Settings is the admin's alone, at the foot
    if (who === 'admin') expect(wide.at(-1), 'Settings sits at the foot for an admin').toBe('Settings');
    else expect(wide, 'no Settings for a member').not.toContain('Settings');

    // the pages a plain member's access opens are the pages in their menu
    if (who === 'Commercial member')
      for (const name of ['Finance', 'Achievements'])
        expect(wide, `${name} is in the menu where the access opens it`).toContain(name);
    await desktop.context().close();
    await phone.context().close();
  });
}
