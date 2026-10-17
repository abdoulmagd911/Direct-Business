/**
 * V641 (3), the owner's live test of 17 Oct: a saved idea could not be found anywhere — the search box showed pages,
 * organisations, people and actions, never notes. At 375 and 1,440 px: an idea saved through Quick capture, as the
 * owner did, and one item of every other kind (note, checklist, reminder, meeting) are all found by search, each row
 * naming its kind, and a row opens its note. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "search-box-shows-no-notes".
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => `quill${Math.random().toString(36).slice(2, 7)}`;

for (const width of [375, 1440]) {
  test(`search finds a saved idea and every other kind of captured item, each naming its kind — at ${width} px`, async ({
    page,
  }) => {
    const member = await makePerson();
    const t = tag();
    const wide = width > 700;
    await page.setViewportSize({ width, height: wide ? 1000 : 800 });
    await signIn(page, member.email, '/my-day');
    await hydrated(page);

    // the idea, saved as the owner saved it: Quick capture, Idea, plain text
    await page.locator(wide ? '[data-create]' : '[data-create-bar]').click();
    await page.locator('[data-create-item="capture"]').click();
    await page.locator('[data-quick-kind="idea"]').click();
    await page.locator('[data-quick-text]').fill(`Made-up ${t} idea for the brochure`);
    await page.locator('[data-quick-save]').click();
    await expect(page.locator('[data-sonner-toast]', { hasText: 'Idea saved' }).first()).toBeVisible();

    // one of each other kind, through the same door the sheet uses
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    for (const [kind, values] of [
      ['sticky', { body: `Made-up ${t} note` }],
      ['checklist', { title: `Made-up ${t} list`, items: [{ text: 'Made-up first step' }] }],
      ['reminder', { title: `Made-up ${t} reminder`, remind_at: tomorrow }],
      ['meeting', { title: `Made-up ${t} meeting` }],
    ] as const) {
      const r = await callAs(page.context(), 'note_capture', { p_kind: kind, p_values: values });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
    }

    await page.locator('[data-search]').click();
    await page.locator('[data-command-palette]').getByPlaceholder('Go to a page or search…').fill(t);
    const rows = page.locator('[data-palette-note]');
    await expect(rows, 'all five are found').toHaveCount(5);
    for (const [words, kind] of [
      [`Made-up ${t} idea for the brochure`, 'Idea'],
      [`Made-up ${t} note`, 'Note'],
      [`Made-up ${t} list`, 'Checklist'],
      [`Made-up ${t} reminder`, 'Reminder'],
      [`Made-up ${t} meeting`, 'Meeting'],
    ] as const) {
      const row = rows.filter({ hasText: words });
      await expect(row, `${words} is found`).toHaveCount(1);
      await expect(row.locator('[data-palette-note-kind]'), `and says it is a ${kind}`).toHaveText(kind);
    }

    // the idea's row opens its note
    await rows.filter({ hasText: 'idea for the brochure' }).click();
    await expect(page).toHaveURL(/\/my-day\/notes\/[0-9a-f-]{36}$/);
    await expect(page.getByText(`Made-up ${t} idea for the brochure`).first()).toBeVisible();
  });
}
