/**
 * QA3-004 to 006 and W41 — tap size on a phone (V630). Every control a finger meets is 44 px: the top bar's search, the
 * rows of the Ctrl K palette, the bell's tabs and the colour swatches on My profile. On a wide screen the same controls
 * keep their compact size. At 375 and 1,440 px; the swatch row also checked at 320 px for sideways scroll. Every value is
 * made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const heights = (page: Page, sel: string) =>
  page.locator(sel).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height * 10) / 10));
const widths = (page: Page, sel: string) =>
  page.locator(sel).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width * 10) / 10));

for (const width of [375, 1440]) {
  const phone = width < 700;
  test(`the search, the palette rows and the bell's tabs are ${phone ? '44 px' : 'compact'} — at ${width} px`, async ({
    page,
  }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width, height: phone ? 800 : 1000 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);

    if (phone) {
      const [search] = await heights(page, '[data-search]');
      expect(search, 'the top bar search is a 44 px target').toBeGreaterThanOrEqual(43.5);
    }
    await page.locator('[data-search]').click();
    await expect(page.locator('[cmdk-item]').first()).toBeVisible();
    const rows = await heights(page, '[cmdk-item]');
    expect(rows.length, 'the palette lists pages').toBeGreaterThan(3);
    if (phone) expect(Math.min(...rows), 'every palette row is a 44 px target').toBeGreaterThanOrEqual(43.5);
    else expect(Math.max(...rows), 'on a wide screen the rows stay compact').toBeLessThanOrEqual(41);
    await page.keyboard.press('Escape');

    await page.locator('[data-bell]').click();
    await expect(page.locator('[data-notifications-panel] [role=tab]').first()).toBeVisible();
    const tabW = await widths(page, '[data-notifications-panel] [role=tab]');
    const tabH = await heights(page, '[data-notifications-panel] [role=tab]');
    if (phone) {
      expect(Math.min(...tabW), 'every bell tab is 44 px wide').toBeGreaterThanOrEqual(43.5);
      expect(Math.min(...tabH), 'and 44 px high').toBeGreaterThanOrEqual(43.5);
    }
  });
}

for (const width of [375, 320, 1440]) {
  const phone = width < 700;
  test(`the colour swatches on My profile are ${phone ? '44 px and do not scroll sideways' : 'compact'} — at ${width} px`, async ({
    page,
  }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width, height: phone ? 800 : 1000 });
    await signIn(page, me.email, '/profile');
    await hydrated(page);
    await expect(page.locator('[data-colour]').first()).toBeVisible();
    const h = await heights(page, '[data-colour]');
    const w = await widths(page, '[data-colour]');
    expect(h.length, 'six colours').toBe(6);
    if (phone) {
      expect(Math.min(...h, ...w), 'each swatch is a 44 px target').toBeGreaterThanOrEqual(43.5);
      const overflow = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth - window.innerWidth,
        swatches: Math.max(
          ...Array.from(document.querySelectorAll('[data-colour]')).map((e) => e.getBoundingClientRect().right),
        ),
      }));
      expect(overflow.page, 'and the page does not scroll sideways').toBeLessThanOrEqual(0);
      expect(overflow.swatches, 'every swatch is inside the screen').toBeLessThanOrEqual(width);
    } else {
      expect(Math.max(...h, ...w), 'on a wide screen the swatches keep their size').toBeLessThanOrEqual(33);
    }
  });
}

test('the + clears the last row on every page and the list searches are 44 px — at 375 px', async ({ page }) => {
  test.setTimeout(120_000);
  const me = await makePerson({ admin: true });
  await page.setViewportSize({ width: 375, height: 667 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  for (const path of ['/my-day', '/tasks', '/clients', '/suppliers', '/finance', '/kpis', '/profile']) {
    await page.goto(path);
    await hydrated(page);
    const gap = await page.evaluate(() => {
      const main = document.querySelector('#main [class*="overflow-y-auto"]') as HTMLElement | null;
      const plus = document.querySelector('[data-create-floating]') as HTMLElement | null;
      if (!main || !plus) return null;
      main.scrollTop = main.scrollHeight;
      const last = main.lastElementChild as HTMLElement;
      return Math.round(plus.getBoundingClientRect().top - last.getBoundingClientRect().bottom);
    });
    expect(gap, `${path}: the + and the scrolling page area are there`).not.toBeNull();
    expect(gap, `${path}: the last row ends above the floating +`).toBeGreaterThanOrEqual(8);
  }
  // the list searches live behind the Filter button on a phone: 44 px each
  for (const path of ['/clients', '/suppliers', '/tasks']) {
    await page.goto(path);
    await hydrated(page);
    await page.locator('[data-filter-toggle]').click();
    const input = page.locator('[data-filter-panel] input').first();
    await expect(input, `${path}: the search box is there`).toBeVisible();
    const h = (await input.boundingBox())!.height;
    expect(h, `${path}: the search box is a 44 px target`).toBeGreaterThanOrEqual(43.5);
  }
});
