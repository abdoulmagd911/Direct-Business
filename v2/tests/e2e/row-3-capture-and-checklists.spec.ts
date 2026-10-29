/**
 * Row 3 of the Architect's 26 Oct order, at 375 px and 1,440 px. Every value is made up.
 *  - Finding 1: a note captured as one paragraph opens with a short title and the rest in Notes.
 *  - Finding 2: saving a checklist on its page says "Checklist saved", not "Note saved".
 *  - Finding 3: a checklist's row is ticked from the My day list, and the count moves on.
 *  - Finding 6: the palette finds "Create · Capture" typed with its dot.
 * (Finding 4, the helper and follow-up lines on a task's Activity, is in #340 with B.)
 * Sabotage: tests/sabotage/row-3.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { openCapture } from './support/capture';
import { callAs, makePerson, signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast][data-front="true"]', { hasText: text });

for (const size of [
  { width: 375, height: 800 },
  { width: 1440, height: 1000 },
]) {
  test(`a captured paragraph, a checklist saved and ticked from My day, and Create · Capture found — at ${size.width} px`, async ({
    page,
  }) => {
    const me = await makePerson({ admin: true });
    const tag = Math.random().toString(36).slice(2, 8);
    await page.setViewportSize(size);
    await signIn(page, me.email, '/my-day');
    await hydrated(page);

    // finding 1
    const first = `Call the made-up client ${tag} about the renewal.`;
    const rest = 'They asked for the new prices by Thursday and want the team list too.';
    await openCapture(page);
    await page.locator('[data-quick-text]').fill(`${first} ${rest}`);
    await page.locator('[data-quick-save]').click();
    await expect(toast(page, 'Note saved')).toBeVisible();
    await page.locator('[data-my-note]', { hasText: first }).locator('[data-note-open]').click();
    await expect(page.locator('[data-note-title]'), 'the first sentence is the title').toHaveValue(first);
    await expect(page.locator('[data-note-body]'), 'and the rest is in Notes').toHaveValue(rest);

    // finding 2
    const made = await callAs(page.context(), 'note_capture', {
      p_kind: 'checklist',
      p_values: {
        title: `Made-up list ${tag}`,
        items: [
          { text: `First row ${tag}`, done: false },
          { text: `Second row ${tag}`, done: false },
        ],
      },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const id = (made.body as { id: string }).id;
    await page.goto(`/my-day/notes/${id}`);
    await hydrated(page);
    await page.locator('[data-note-title]').fill(`Made-up list ${tag} renamed`);
    await page.locator('[data-note-save]').click();
    await expect(toast(page, 'Checklist saved'), 'a checklist is saved as a checklist').toBeVisible();

    // finding 3
    await page.goto('/my-day');
    await hydrated(page);
    const row = page.locator(`[data-my-note="${id}"]`);
    await expect(row.locator('[data-note-count]')).toHaveText('0/2');
    await row.getByRole('checkbox', { name: `First row ${tag}` }).click();
    await expect(toast(page, 'Item done')).toBeVisible();
    await expect(row.locator('[data-note-count]'), 'ticked from the list').toHaveText('1/2');
    await expect(row.getByRole('checkbox', { name: `First row ${tag}` }), 'the done row leaves the list').toHaveCount(
      0,
    );
    await expect(row.getByRole('checkbox', { name: `Second row ${tag}` })).toBeVisible();
    const box = await row.getByRole('checkbox', { name: `Second row ${tag}` }).boundingBox();
    if (size.width === 375) expect(box!.height, 'a 44 px target on a phone').toBeGreaterThanOrEqual(44);

    // finding 6
    if (size.width === 1440) {
      await page.keyboard.press('Control+k');
      await page.getByRole('combobox').fill('Create · Capture');
      await page.getByRole('option', { name: 'Create · Capture', exact: true }).click();
      await expect(page.locator('[data-quick-capture]'), 'typed with its dot, it is found').toBeVisible();
    }
  });
}
