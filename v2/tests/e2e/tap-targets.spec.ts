/**
 * QA3-004 to 006 and W41 — tap size on a phone (V630). Every control a finger meets is 44 px: the top bar's search, the
 * rows of the Ctrl K palette, the bell's tabs and the Theme box on My profile (which took the place of the colour swatches,
 * V636). On a wide screen the same controls keep their compact size. At 375, 320 and 1,440 px. Every value is made up.
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
  test(`the Theme box on My profile is ${phone ? '44 px, one to a row and inside the screen' : 'compact, beside Density'} — at ${width} px`, async ({
    page,
  }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width, height: phone ? 800 : 1000 });
    await signIn(page, me.email, '/profile');
    await hydrated(page);
    const rect = (label: string) =>
      page.getByLabel(label, { exact: true }).evaluate((e) => {
        const b = e.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: b.height };
      });
    const theme = await rect('Theme');
    const density = await rect('Density');
    if (phone) {
      expect(theme.height, 'the Theme box is a 44 px target').toBeGreaterThanOrEqual(43.5);
      expect(density.top, 'Theme and Density are one to a row, not squeezed side by side').toBeGreaterThanOrEqual(
        theme.bottom,
      );
      expect(theme.width, 'the Theme box takes the width of the screen').toBeGreaterThanOrEqual(width - 80);
      expect(theme.right, 'and is inside the screen').toBeLessThanOrEqual(width);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'the page does not scroll sideways').toBeLessThanOrEqual(0);
    } else {
      expect(theme.height, 'on a wide screen the Theme box keeps its compact size').toBeLessThanOrEqual(41);
      expect(Math.abs(density.top - theme.top), 'and sits beside Density').toBeLessThanOrEqual(2);
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
      const plus = document.querySelector('[data-create-bar]') as HTMLElement | null;
      if (!main || !plus) return null;
      main.scrollTop = main.scrollHeight;
      const last = main.lastElementChild as HTMLElement;
      return Math.round(plus.getBoundingClientRect().top - last.getBoundingClientRect().bottom);
    });
    expect(gap, `${path}: the + and the scrolling page area are there`).not.toBeNull();
    expect(gap, `${path}: the last row ends above Create`).toBeGreaterThanOrEqual(8);
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

for (const [width, rtl] of [
  [375, false],
  [375, true],
  [320, false],
] as const) {
  test(`the bell's three tabs sit on one row, each 44 px and with its words whole — at ${width} px${rtl ? ', right to left' : ''}`, async ({
    page,
    context,
    baseURL,
  }) => {
    const me = await makePerson({ admin: true });
    if (rtl) await context.addCookies([{ name: 'v2.dir', value: 'rtl', url: baseURL! }]);
    await page.setViewportSize({ width, height: 700 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    if (rtl) expect(await page.evaluate(() => document.documentElement.dir), 'the page is right to left').toBe('rtl');
    await page.locator('[data-bell]').click();
    const tabs = page.locator('[data-notifications-panel] [role=tab]');
    await expect(tabs).toHaveCount(3);
    const boxes = await tabs.evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { top: Math.round(r.top), w: r.width, h: r.height, whole: e.scrollWidth <= e.clientWidth + 1 };
      }),
    );
    expect(new Set(boxes.map((b) => b.top)).size, 'the three tabs share one row').toBe(1);
    for (const b of boxes) {
      expect(b.w, 'each tab is 44 px wide').toBeGreaterThanOrEqual(43.5);
      expect(b.h, 'and 44 px high').toBeGreaterThanOrEqual(43.5);
      expect(b.whole, 'its words are not cut off').toBe(true);
    }
    const panel = (await page.locator('[data-notifications-panel]').boundingBox())!;
    const last = await tabs.last().boundingBox();
    const first = await tabs.first().boundingBox();
    const edge = rtl ? first! : last!;
    expect(edge.x + edge.width, 'the row stays inside the panel').toBeLessThanOrEqual(panel.x + panel.width + 0.5);
  });
}
