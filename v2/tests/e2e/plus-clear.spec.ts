/**
 * Nothing sits under the floating + on a phone (the architect's ruling of 15 Oct, after the supervisor found the +
 * over the Weekly review row's chip on My day). At 375 px each page is scrolled to its foot: its last block ends above
 * the + and no tappable element overlaps the +'s rectangle. My day is read with the Weekly review row (the Me tab) and
 * without it (the Team tab); Tasks and Clients end in a list and a button too. At first view (not scrolled), My day is
 * read at the phone height that puts the + level with the Weekly review row — the supervisor's case of 15 Oct, where
 * the + covered the row's "Review day" chip — and no tappable element may sit under the + there either. Every value is
 * made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

/** What tappable inside the page sits under the floating +, named for the message. */
const underThePlus = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector('[data-create-floating]')!.getBoundingClientRect();
    const overlaps = (r: DOMRect) =>
      r.width > 0 &&
      r.height > 0 &&
      r.left < box.right &&
      r.right > box.left &&
      r.top < box.bottom &&
      r.bottom > box.top;
    return [
      ...document
        .querySelector('[data-page]')!
        .querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="tab"]'),
    ]
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
  test(`the floating + covers nothing at the foot of ${p.name} — at 375 px`, async ({ page }) => {
    const me = await makePerson({ admin: true });
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, me.email, p.path);
    await hydrated(page);
    if (p.door) await expect(page.locator('[data-week-door]')).toBeVisible();
    else await expect(page.locator('[data-week-door]')).toHaveCount(0);
    const plus = page.locator('[data-create-floating]');
    await expect(plus).toBeVisible();

    // scroll the page to its foot and let it settle
    await page.locator('[data-page]').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(300);

    const found = await page.evaluate(() => {
      const box = document.querySelector('[data-create-floating]')!.getBoundingClientRect();
      const page = document.querySelector('[data-page]')!;
      const overlaps = (r: DOMRect) =>
        r.width > 0 &&
        r.height > 0 &&
        r.left < box.right &&
        r.right > box.left &&
        r.top < box.bottom &&
        r.bottom > box.top;
      const last = [...page.children].filter((c) => c.getBoundingClientRect().height > 0).at(-1)!;
      const tappable = [
        ...page.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [role="tab"]'),
      ]
        .filter((el) => overlaps(el.getBoundingClientRect()))
        .map((el) => (el.getAttribute('data-week-door') !== null ? 'the Weekly review row' : el.tagName.toLowerCase()));
      return { plusTop: box.top, lastBottom: last.getBoundingClientRect().bottom, tappable };
    });
    expect(found.lastBottom, 'the last block of the page ends above the +').toBeLessThanOrEqual(found.plusTop);
    expect(found.tappable, 'nothing tappable is under the +').toEqual([]);
  });
}

test('the floating + covers nothing at the top of My day, even level with the Weekly review row — at 375 px', async ({
  page,
}) => {
  const me = await makePerson({ admin: true });
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  await hydrated(page);
  const door = page.locator('[data-week-door]');
  await expect(door).toBeVisible();
  // the phone height that puts the + (56 px, its foot 76 px above the screen's) across the row's middle, at first view
  const row = (await door.boundingBox())!;
  const height = Math.round(row.y + row.height / 2 + 76 + 28);
  await page.setViewportSize({ width: 375, height });
  await page.locator('[data-page]').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.waitForTimeout(300);
  await expect(page.locator('[data-create-floating]')).toBeVisible();
  expect(await underThePlus(page), `nothing tappable is under the + at first view (${height} px tall)`).toEqual([]);
});
