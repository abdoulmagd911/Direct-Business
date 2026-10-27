/**
 * The Architect's ruling on the shared "Who was it with?" picker (22 Oct; QA-586): one click or tap picks a result — never
 * a first click that only highlights — and Enter picks the highlighted row (the first at the start, ArrowDown moves it);
 * on a phone every result row is 44 px high. At 375 and 1,440 px, with a real press of the mouse. Every value is made up.
 * The result row (23 Oct ruling): a long name wraps and is never cut with an ellipsis, the code sits whole under it.
 * Sabotages: tests/sabotage/who-picker.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);

for (const width of [375, 1440]) {
  test(`one press picks a result, Enter picks the highlighted row, and the rows are finger-high — at ${width} px`, async ({
    page,
    context,
  }) => {
    const admin = await makePerson({ admin: true });
    const t = tag();
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, admin.email, '/my-day');
    await hydrated(page);
    for (const n of ['A', 'B']) {
      const made = await callAs(context, 'partner_create', {
        p_partner: { trade_name_en: `Pickorg${t} ${n}`, sides: [{ side: 'client', type: 'corporate' }] },
      });
      expect(made.status, JSON.stringify(made.body)).toBe(200);
    }
    const open = async () => {
      await page.locator(width < 640 ? '[data-create-bar]' : '[data-create]').click();
      await page.locator('[data-create-item="activity"]').click();
      await expect(page.locator('[data-activity-who]')).toBeVisible();
      await page.locator('[data-partner-search]').fill(`Pickorg${t}`);
      await expect(page.locator('[data-partner-hit]')).toHaveCount(2);
    };

    // one real press of the mouse (move, down, up) picks the row
    await open();
    const rows = page.locator('[data-partner-hit]');
    if (width < 640) {
      for (const i of [0, 1])
        expect(
          (await rows.nth(i).boundingBox())!.height,
          'a result row is 44 px high on a phone',
        ).toBeGreaterThanOrEqual(43.5);
    }
    const box = (await rows.nth(1).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('[data-partner-picked]'), 'one press picks the result').toBeVisible();
    await expect(page.locator('[data-activity-who-next]')).toBeEnabled();
    await page.keyboard.press('Escape');

    // the keyboard: the first row is highlighted at the start, ArrowDown moves it, Enter picks it
    await open();
    await expect(rows.nth(0), 'the first row starts highlighted').toHaveAttribute('aria-selected', 'true');
    await page.locator('[data-partner-search]').press('ArrowDown');
    await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
    const second = await rows.nth(1).getAttribute('data-partner-hit');
    await page.locator('[data-partner-search]').press('Enter');
    await expect(page.locator(`[data-partner-picked="${second}"]`), 'Enter picks the highlighted row').toBeVisible();
  });
}

for (const width of [375, 1440]) {
  test(`a long client name wraps without an ellipsis and the client code stays whole on its own line — at ${width} px`, async ({
    page,
    context,
  }) => {
    const admin = await makePerson({ admin: true });
    const t = tag();
    const long = `Wraporg${t} the made-up travel and tourism company of the long and winding name that goes on for a good while`;
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, admin.email, '/my-day');
    await hydrated(page);
    const made = await callAs(context, 'partner_create', {
      p_partner: { trade_name_en: long, sides: [{ side: 'client', type: 'corporate' }] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    await page.locator(width < 640 ? '[data-create-bar]' : '[data-create]').click();
    await page.locator('[data-create-item="activity"]').click();
    await page.locator('[data-partner-search]').fill(`Wraporg${t}`);
    const row = page.locator('[data-partner-hit]').first();
    await expect(row).toBeVisible();
    const name = row.locator('[data-partner-hit-name]');
    const code = row.locator('[data-partner-hit-number]');
    const r = (await row.boundingBox())!;
    const n = (await name.boundingBox())!;
    const c = (await code.boundingBox())!;
    expect(r.height, 'the row is at least 44 px high').toBeGreaterThanOrEqual(43.5);
    expect(
      await name.evaluate((e) => getComputedStyle(e).textOverflow),
      'the name is not cut with an ellipsis',
    ).not.toBe('ellipsis');
    const lineHeight = await name.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
    expect(n.height, 'the long name wraps onto more than one line').toBeGreaterThan(lineHeight * 1.5);
    expect(n.x + n.width, 'the whole name is inside the row').toBeLessThanOrEqual(r.x + r.width + 0.5);
    expect(c.y, 'the code is on its own line under the name').toBeGreaterThanOrEqual(n.y + n.height - 1);
    expect(c.height, 'the code is one piece on one line').toBeLessThan(lineHeight * 1.5);
    expect(c.x + c.width, 'the whole code is inside the row').toBeLessThanOrEqual(r.x + r.width + 0.5);
  });
}

for (const width of [375, 1440]) {
  test(`the chosen client chip wraps a long name without an ellipsis and keeps the code whole on its own line — at ${width} px`, async ({
    page,
    context,
  }) => {
    const admin = await makePerson({ admin: true });
    const t = tag();
    const long = `Chiporg${t} the made-up travel and tourism company of the long and winding name that goes on for a good while`;
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, admin.email, '/my-day');
    await hydrated(page);
    const made = await callAs(context, 'partner_create', {
      p_partner: { trade_name_en: long, sides: [{ side: 'client', type: 'corporate' }] },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    await page.locator(width < 640 ? '[data-create-bar]' : '[data-create]').click();
    await page.locator('[data-create-item="activity"]').click();
    await page.locator('[data-partner-search]').fill(`Chiporg${t}`);
    await page.locator('[data-partner-hit]').first().click();
    const chip = page.locator('[data-partner-picked]');
    await expect(chip).toBeVisible();
    const name = chip.locator('[data-partner-picked-name]');
    const code = chip.locator('[data-partner-picked-number]');
    const c0 = (await chip.boundingBox())!;
    const n = (await name.boundingBox())!;
    const c = (await code.boundingBox())!;
    expect(
      await name.evaluate((e) => getComputedStyle(e).textOverflow),
      'the name is not cut with an ellipsis',
    ).not.toBe('ellipsis');
    const lineHeight = await name.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight));
    expect(n.height, 'the long name wraps onto more than one line').toBeGreaterThan(lineHeight * 1.5);
    expect(await name.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), 'the whole name is shown').toBe(true);
    expect(n.x + n.width, 'the name is inside the chip').toBeLessThanOrEqual(c0.x + c0.width + 0.5);
    expect(c.y, 'the code is on its own line under the name').toBeGreaterThanOrEqual(n.y + n.height - 1);
    expect(c.height, 'the code is one piece on one line').toBeLessThan(lineHeight * 1.5);
    expect(c0.x + c0.width, 'the chip fits the screen').toBeLessThanOrEqual(width);
  });
}
