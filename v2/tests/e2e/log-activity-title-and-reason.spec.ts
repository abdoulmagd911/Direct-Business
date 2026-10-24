/**
 * QA-587, QA-588 (V653, V654): in Log activity from the + the reason beside a greyed Save sits next to the buttons and
 * in view, Change stays at the end of the title line even for an ordinary name, and a long name keeps to three lines
 * with a More tap. 320, 375 and 1,440 px. Every name is made up.
 * Sabotages: tests/sabotage/log-activity-entry.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { setPrefs } from './helpers';
import { callAs, makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);

const LONG =
  'TEST Agency Client with a very long registered trading name that goes on and on and on across several lines for the title check';

for (const width of [320, 375, 1440]) {
  test(`the Save reason sits next to Save, Change ends the title line and a long name keeps to three lines — at ${width} px`, async ({
    page,
    context,
  }) => {
    const admin = await makePerson({ admin: true });
    const short = `TEST Agency ${tag()}`;
    const long = `${LONG} ${tag()}`;
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 700 });
    await signIn(page, admin.email, '/my-day');
    await hydrated(page);
    const ids: Record<string, string> = {};
    for (const name of [short, long]) {
      const made = await callAs(context, 'partner_create', {
        p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
      });
      expect(made.status, JSON.stringify(made.body)).toBe(200);
      ids[name] = (made.body as { id: string }).id;
    }

    const openFor = async (name: string, search: string) => {
      await page.locator(width < 640 ? '[data-create-bar]' : '[data-create]').click();
      await page.locator('[data-create-item="activity"]').click();
      await page.locator('[data-partner-search]').fill(search);
      await page.locator(`[data-partner-hit="${ids[name]}"]`).click();
      await page.locator('[data-activity-who-next]').click();
      await expect(page.locator('[data-activity-form]')).toBeVisible();
    };

    // an ordinary name: Change is on the title's first line, at its end
    await openFor(short, short);
    const title = page.locator('[data-activity-title]');
    const change = page.locator('[data-activity-change]');
    const t = (await title.boundingBox())!;
    const c = (await change.boundingBox())!;
    expect(Math.abs(c.y - t.y), 'Change is on the title line').toBeLessThan(24);
    expect(c.x, 'Change is after the title text').toBeGreaterThan(t.x + 40);
    // at 320 px the line left for the name beside Change is narrow, so even an ordinary name may run past three lines
    if (width >= 375) {
      await expect(page.locator('[data-activity-title-more]'), 'no More tap for a short name').toHaveCount(0);
    }

    // Save is off: the reason sits in the footer with the buttons, in view, without scrolling the form
    const why = page.locator('[data-activity-why]');
    const save = page.locator('[data-activity-save]');
    await expect(save).toBeDisabled();
    await expect(why).toContainText('Write what happened to save');
    const w = (await why.boundingBox())!;
    const s = (await save.boundingBox())!;
    expect(w.y + w.height, 'the reason is in view').toBeLessThanOrEqual(page.viewportSize()!.height);
    expect(s.y - (w.y + w.height), 'the reason touches the buttons, not the form').toBeLessThan(30);

    // a long name: three lines at most, a More tap, and Less to fold it back
    await page.locator('[data-activity-change]').click();
    await page.locator('[data-partner-picked] button').click();
    await page.locator('[data-partner-search]').fill(long.slice(0, 30));
    await page.locator(`[data-partner-hit="${ids[long]}"]`).click();
    await page.locator('[data-activity-who-next]').click();
    await expect(page.locator('[data-activity-form]')).toBeVisible();
    const folded = (await title.boundingBox())!;
    const lineHeight = await title.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect(folded.height, 'at most three lines').toBeLessThanOrEqual(lineHeight * 3 + 2);
    const more = page.locator('[data-activity-title-more]');
    if (width < 700) {
      await expect(more).toBeVisible();
      const m = (await more.boundingBox())!;
      expect(Math.abs(m.x - folded.x), 'More starts at the title start edge').toBeLessThanOrEqual(1);
      await more.click();
      expect((await title.boundingBox())!.height, 'More shows the whole name').toBeGreaterThan(folded.height);
      await more.click();
      expect((await title.boundingBox())!.height, 'Less folds it back').toBeLessThanOrEqual(lineHeight * 3 + 2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('More starts at the title start edge in Arabic too — 375 px', async ({ page, context }) => {
  const admin = await makePerson({ admin: true });
  const long = `${LONG} ${tag()}`;
  await setPrefs(context, { locale: 'ar' });
  await page.setViewportSize({ width: 375, height: 700 });
  await signIn(page, admin.email, '/my-day');
  await hydrated(page);
  const made = await callAs(context, 'partner_create', {
    p_partner: { trade_name_en: long, sides: [{ side: 'client', type: 'corporate' }] },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  const id = (made.body as { id: string }).id;
  await page.locator('[data-create-bar]').click();
  await page.locator('[data-create-item="activity"]').click();
  await page.locator('[data-partner-search]').fill(long.slice(0, 30));
  await page.locator(`[data-partner-hit="${id}"]`).click();
  await page.locator('[data-activity-who-next]').click();
  await expect(page.locator('[data-activity-form]')).toBeVisible();
  await expect(page.locator('[data-activity-title-more]')).toBeVisible();
  // both boxes in one frame, so the dialog's opening animation cannot move one between the two reads
  const r = await page.evaluate(() => {
    const box = (sel: string) => {
      const b = document.querySelector(sel)!.getBoundingClientRect();
      return { x: b.x, right: b.right };
    };
    return {
      dir: getComputedStyle(document.documentElement).direction,
      title: box('[data-activity-title]'),
      more: box('[data-activity-title-more]'),
    };
  });
  expect(r.dir, 'the page reads right to left').toBe('rtl');
  expect(
    Math.abs(r.more.right - r.title.right),
    `More starts at the right edge in Arabic ${JSON.stringify(r)}`,
  ).toBeLessThanOrEqual(2);
});
