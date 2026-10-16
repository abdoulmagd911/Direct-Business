/**
 * Nothing sits under Create on a phone (the architect's ruling of 15 Oct, after the supervisor found the floating + over
 * the Weekly review row's chip on My day; option C made Create the bottom bar's last slot, so it floats over nothing).
 * At 375 px each page is scrolled to its foot: its last block ends above Create and no tappable element of the page
 * overlaps Create's rectangle. My day is read with the Weekly review row (the Me tab) and without it (the Team tab);
 * Tasks and Clients end in a list and a button too. At first view (not scrolled), My day is read at the phone height
 * that puts Create level with the Weekly review row — the supervisor's case of 15 Oct — and no tappable element may sit
 * under it there either. Every value is made up.
 * Sabotage: tests/sabotage/plus-clear.mjs "page-foot-has-no-room-for-the-plus", "create-floats-over-the-page-again".
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

/** What tappable inside the page sits under Create, named for the message. */
const underThePlus = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector('[data-create-bar]')!.getBoundingClientRect();
    const page = document.querySelector('[data-page]')!;
    // only the part of an element the page shows counts: what scrolls out of the page is clipped, not under Create
    const clip = page.getBoundingClientRect();
    const overlaps = (r: DOMRect) =>
      r.width > 0 &&
      r.height > 0 &&
      Math.max(r.left, clip.left) < box.right &&
      Math.min(r.right, clip.right) > box.left &&
      Math.max(r.top, clip.top) < box.bottom &&
      Math.min(r.bottom, clip.bottom) > box.top;
    return [...page.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="tab"]')]
      .filter((el) => overlaps(el.getBoundingClientRect()))
      .map((el) => (el.getAttribute('data-week-door') !== null ? 'the Weekly review row' : el.tagName.toLowerCase()));
  });

const PAGES = [
  { name: 'My day, with the Weekly review row', path: '/my-day', door: true },
  { name: 'My day, without the Weekly review row', path: '/my-day?tab=team', door: false },
  { name: 'Tasks', path: '/tasks', door: false },
  { name: 'Clients', path: '/clients', door: false },
];

for (const p of PAGES) {
  test(`Create covers nothing at the foot of ${p.name} — at 375 px`, async ({ page }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, me.email, p.path);
    await hydrated(page);
    if (p.door) await expect(page.locator('[data-week-door]')).toBeVisible();
    else await expect(page.locator('[data-week-door]')).toHaveCount(0);
    const plus = page.locator('[data-create-bar]');
    await expect(plus).toBeVisible();

    // scroll the page to its foot and let it settle
    await page.locator('[data-page]').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(300);

    const found = await page.evaluate(() => {
      const box = document.querySelector('[data-create-bar]')!.getBoundingClientRect();
      const page = document.querySelector('[data-page]')!;
      const clip = page.getBoundingClientRect();
      const overlaps = (r: DOMRect) =>
        r.width > 0 &&
        r.height > 0 &&
        Math.max(r.left, clip.left) < box.right &&
        Math.min(r.right, clip.right) > box.left &&
        Math.max(r.top, clip.top) < box.bottom &&
        Math.min(r.bottom, clip.bottom) > box.top;
      const last = [...page.children].filter((c) => c.getBoundingClientRect().height > 0).at(-1)!;
      const tappable = [
        ...page.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="tab"]'),
      ]
        .filter((el) => overlaps(el.getBoundingClientRect()))
        .map((el) => (el.getAttribute('data-week-door') !== null ? 'the Weekly review row' : el.tagName.toLowerCase()));
      return { plusTop: box.top, lastBottom: last.getBoundingClientRect().bottom, tappable };
    });
    expect(found.lastBottom, 'the last block of the page ends above Create').toBeLessThanOrEqual(found.plusTop);
    expect(found.tappable, 'nothing tappable is under Create').toEqual([]);
  });
}

test('Create covers nothing at the top of My day, even level with the Weekly review row — at 375 px', async ({
  page,
}) => {
  const me = await makePerson({ admin: true });
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  const door = page.locator('[data-week-door]');
  await expect(door).toBeVisible();
  // the phone height that puts Create's middle level with the row's middle, at first view
  const row = (await door.boundingBox())!;
  const create = (await page.locator('[data-create-bar]').boundingBox())!;
  const height = Math.round(row.y + row.height / 2 + (800 - create.y - create.height / 2));
  await page.setViewportSize({ width: 375, height });
  await page.locator('[data-page]').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.waitForTimeout(300);
  await expect(page.locator('[data-create-bar]')).toBeVisible();
  expect(await underThePlus(page), `nothing tappable is under Create at first view (${height} px tall)`).toEqual([]);
});
