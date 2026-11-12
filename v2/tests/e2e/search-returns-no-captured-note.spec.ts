/**
 * F-B3-03 (Landing 15): the top search no longer returns captured notes — a saved idea and one item of every
 * other kind (note, checklist, reminder, meeting) are all absent from search, each by the words only it
 * carries. The captures still exist (they are found on My day); only the search door is closed. At 375 and
 * 1,440 px. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => `quill${Math.random().toString(36).slice(2, 7)}`;

for (const width of [375, 1440]) {
  test(`search returns no captured note of any kind — at ${width} px`, async ({ page }) => {
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
    await expect(page.locator('[data-palette-note]'), 'no captured note of any kind shows').toHaveCount(0);
    await expect(page.locator('[data-command-palette]'), 'and nothing else matches the made-up words').toContainText(
      'Nothing matches',
    );
  });
}
