/**
 * The Architect's ruling of 18 Oct (V630, QA 1's tap-size check): on a phone (375 px) every tappable thing is at least
 * 44 px high — client name links, the "All / Note" chips, switches and checkboxes included — whichever page it is on,
 * because one rule in the shared styles covers them all. On a wide screen the same things keep their compact size.
 * A walk of the main pages and of the dialogs and menus a finger opens from them. Every value is made up.
 * Sabotages: tests/sabotage/tap-sizes.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { noteLinkWidths, reminderStartGap, seed, walk } from './support/taps';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test('every tappable thing is at least 44 px wide and high on a phone, on every page and in the dialogs and menus — English', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 375, height: 800 });
  const { me, clientId, number } = await seed(page);
  expect(await walk(page, me, clientId, number), 'every tappable thing is 44 px wide and high on a phone').toEqual([]);
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

test('a short reminder title on My day starts right after the tick, not centred in its link — at 375 px (QA-580)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  const { me } = await seed(page);
  const { gap, width } = await reminderStartGap(page, me.id, 'Call Ali');
  expect(gap, 'the words start at the start edge of their link, not centred in it').toBeLessThanOrEqual(2);
  expect(width, 'and the link is still a finger wide').toBeGreaterThanOrEqual(43.5);
});

test('a short note title in the My day notes list is a finger wide on a phone — English and Arabic (QA-584)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await seed(page);
  const widths = await noteLinkWidths(page, ['Hi', 'علي', 'Check']);
  for (const [title, { width, height }] of Object.entries(widths)) {
    expect(height, `the note link "${title}" is 44 px high on a phone`).toBeGreaterThanOrEqual(43.5);
    expect(width, `the note link "${title}" is 44 px wide on a phone`).toBeGreaterThanOrEqual(43.5);
  }
});
