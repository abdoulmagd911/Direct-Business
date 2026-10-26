/**
 * My day reminder fixes (the oversight's job N): a Reminder shows once — in the Reminders block while it waits, never
 * again among My notes; the capture sheet offers only "Only me" for a Reminder and files it private whatever was chosen
 * before; a follow-up's chip wraps on a phone, wide enough to read, instead of being squeezed by the time and Done.
 * At 375 px and 1,440 px; every value made up. Sabotages: tests/sabotage/my-day-reminder-fixes.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => Math.random().toString(36).slice(2, 8);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

for (const width of [375, 1440]) {
  test(`a Reminder is listed once on My day — in the Reminders block, not again in My notes — at ${width} px`, async ({
    page,
    context,
  }) => {
    const me = await makePerson();
    const t = tag();
    await page.setViewportSize({ width, height: width > 700 ? 1000 : 800 });
    await signIn(page, me.email, '/my-day');
    const made = await callAs(context, 'note_capture', {
      p_kind: 'reminder',
      p_values: { title: `Call the supplier ${t}`, visibility: 'private', remind_at: inDays(4) },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const plain = await callAs(context, 'note_capture', {
      p_kind: 'sticky',
      p_values: { title: `Plain note ${t}`, visibility: 'private' },
    });
    expect(plain.status, JSON.stringify(plain.body)).toBe(200);
    await page.goto('/my-day');
    await hydrated(page);
    await expect(page.locator('[data-reminders]'), 'the reminder is listed in the Reminders block').toContainText(
      `Call the supplier ${t}`,
    );
    await expect(page.locator('[data-block="me"]'), 'a plain note is still in My notes').toContainText(
      `Plain note ${t}`,
    );
    await expect(page.locator('[data-block="me"]'), 'the reminder is not also a row of My notes').not.toContainText(
      `Call the supplier ${t}`,
    );
    await expect(page.getByText(`Call the supplier ${t}`), 'it shows once on the whole page').toHaveCount(1);
    // the Reminder filter is the one place that asks for reminders as notes
    await page.goto('/my-day?kind=reminder');
    await hydrated(page);
    await expect(page.locator('[data-block="me"]'), 'the Reminder filter still lists it').toContainText(
      `Call the supplier ${t}`,
    );
  });

  test(`the capture sheet offers only Only me for a Reminder and files it private — at ${width} px`, async ({
    page,
  }) => {
    const me = await makePerson();
    const t = tag();
    const wide = width > 700;
    await page.setViewportSize({ width, height: wide ? 1000 : 800 });
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    await page.locator(wide ? '[data-create]' : '[data-create-bar]').click();
    await page.locator('[data-create-item="capture"]').click();
    await expect(page.locator('[data-quick-capture]')).toBeVisible();
    await expect(page.locator('[data-quick-visibility]'), 'a note offers three audiences').toHaveCount(3);
    await page.locator('[data-quick-visibility="team"]').click();
    await page.locator('[data-quick-kind="reminder"]').click();
    await expect(page.locator('[data-quick-visibility]'), 'a Reminder offers one').toHaveCount(1);
    await expect(page.locator('[data-quick-visibility="private"]'), 'and it is Only me').toBeVisible();
    await page.locator('[data-quick-text]').fill(`Told only to me ${t}`);
    await page.locator('[data-quick-save]').click();
    await expect(page.locator('[data-quick-capture]')).toHaveCount(0);
    const [row] = await sql<{ visibility: string }>(
      `select visibility from my.note where person_id = $1 and title = $2`,
      [me.id, `Told only to me ${t}`],
    );
    expect(row?.visibility, 'filed private even though Team was picked before').toBe('private');
  });
}

test('a follow-up chip wraps on a phone and stays wide enough to read next to the time and Done', async ({
  page,
  context,
}) => {
  const me = await makePerson({ admin: true });
  const t = tag();
  const long = `Chipfollow${t} the made-up travel and tourism company of the long and winding name that goes on for a good while`;
  await page.setViewportSize({ width: 375, height: 800 });
  await signIn(page, me.email, '/my-day');
  const org = await callAs(context, 'partner_create', {
    p_partner: { trade_name_en: long, sides: [{ side: 'client', type: 'corporate' }] },
  });
  expect(org.status, JSON.stringify(org.body)).toBe(200);
  const made = await callAs(context, 'note_capture', {
    p_kind: 'reminder',
    p_values: {
      title: 'Follow-up',
      visibility: 'private',
      remind_at: inDays(4),
      about: { entity: 'partner', id: (org.body as { id: string }).id },
    },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  await page.goto('/my-day');
  await hydrated(page);
  const row = page.locator('[data-reminders] [data-reminder]').first();
  await expect(row).toContainText(`Chipfollow${t}`);
  const m = await row.evaluate((el) => {
    const chip = el.querySelector('.rounded-pill') as HTMLElement;
    const r = el.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    return { rowW: r.width, chipW: c.width, chipH: c.height, line: parseFloat(getComputedStyle(chip).lineHeight) };
  });
  expect(m.chipW, 'the chip takes most of the row, not a sliver beside the time').toBeGreaterThan(m.rowW * 0.6);
  expect(m.chipH, 'and wraps to a few lines, never a tall strip').toBeLessThan(m.line * 5);
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(sideways, 'nothing scrolls sideways').toBe(false);
});
