/**
 * Landing 55 — a team member changes their own organisations only (the owner's approved design of 22 Nov 2026), on
 * the real stack. Found on live after Landing 51: a team member was offered Edit, + Add, Archive and the file picker
 * on a colleague's organisation. Here a colleague opens it and reads it, is offered none of those, and a save sent
 * straight to the database is refused; they may still log an activity. Its owner is offered all of it, and so is a
 * manager. A team member is still offered "New" on the list, and what they add is theirs. The database decides
 * (OWN-01). Every value is made up.
 * Sabotages: tests/sabotage/landing-55-e2e.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs } from './support/stack';
import { doorOf, hydrated, personAs, signedInAs, tag } from './support/landing-32';

const edit = (page: Page) => page.locator('[data-partner-edit]');
const addContact = (page: Page) => page.locator('[data-contact-add]');
const filePicker = (page: Page) => page.locator('[data-partner-files] input[type="file"]');
const log = (page: Page) => page.locator('[data-activity-log]');

/** Open the record's ⋯ menu, when it has one. */
async function openMore(page: Page) {
  await page.locator('[data-partner-more]').click();
  await expect(page.getByRole('menu')).toBeVisible();
}

test('a colleague reads an organisation and is offered no change to it; its owner and a manager are', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const owner = await personAs('member');
  const colleague = await personAs('member');
  const manager = await personAs('manager');
  const name = `Made Up Own Org ${tag()}`;

  // the owner adds it: a team member is offered New, and what they add is theirs
  const mine = await signedInAs(browser, owner, '/partners');
  await hydrated(mine.page);
  await expect(mine.page.locator('[data-partner-new]'), 'a team member is offered New on the list').toBeVisible();
  const made = await doorOf(mine.context)('partner_create', {
    p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
  });
  const id = made.id!;

  await mine.page.goto(`/partners/${id}`);
  await hydrated(mine.page);
  await expect(mine.page.getByRole('heading', { name }).first(), 'the owner opens their organisation').toBeVisible();
  await expect(edit(mine.page), 'its owner is offered Edit').toBeVisible();
  await expect(addContact(mine.page), 'and + Add on its contacts').toBeVisible();
  await expect(filePicker(mine.page), 'and the file picker').toHaveCount(1);
  await openMore(mine.page);
  await expect(mine.page.locator('[data-partner-archive]'), 'and Archive').toBeVisible();
  await mine.page.keyboard.press('Escape');

  // a colleague: reads it, is offered none of it
  const theirs = await signedInAs(browser, colleague, `/partners/${id}`);
  await hydrated(theirs.page);
  await expect(theirs.page.getByRole('heading', { name }).first(), 'a colleague still reads it').toBeVisible();
  await expect(log(theirs.page), 'and may log an activity with it').toBeVisible();
  await expect(edit(theirs.page), 'a colleague is not offered Edit').toHaveCount(0);
  await expect(addContact(theirs.page), 'nor + Add on its contacts').toHaveCount(0);
  await expect(filePicker(theirs.page), 'nor the file picker').toHaveCount(0);
  await openMore(theirs.page);
  await expect(theirs.page.locator('[data-note-add]'), 'the menu still adds a note').toBeVisible();
  await expect(theirs.page.locator('[data-partner-archive]'), 'nor Archive').toHaveCount(0);
  await expect(theirs.page.locator('[data-partner-remove]'), 'nor Remove').toHaveCount(0);
  await theirs.page.keyboard.press('Escape');

  // and a save sent straight to the database is refused
  const sent = await callAs(theirs.context, 'partner_update', {
    p_id: id,
    p_changes: { city: 'Made Up City' },
    p_version: 1,
    p_reason: 'made up: a colleague tries',
  });
  expect(sent.status, `the database refuses a colleague's save: ${JSON.stringify(sent.body)}`).toBe(403);
  expect(JSON.stringify(sent.body), 'in the words of an access refusal').toContain('access.needs_level');
  const contact = await callAs(theirs.context, 'contact_save', {
    p_partner: id,
    p_id: null,
    p_values: { name_en: 'Made Up Contact' },
  });
  expect(contact.status, `nor a contact: ${JSON.stringify(contact.body)}`).toBe(403);
  const archive = await callAs(theirs.context, 'partner_archive', { p_id: id, p_reason: 'made up' });
  expect(archive.status, `nor an archive: ${JSON.stringify(archive.body)}`).toBe(403);
  await theirs.context.close();

  // a manager keeps Full
  const boss = await signedInAs(browser, manager, `/partners/${id}`);
  await hydrated(boss.page);
  await expect(boss.page.getByRole('heading', { name }).first()).toBeVisible();
  await expect(edit(boss.page), 'a manager is offered Edit on any organisation').toBeVisible();
  await boss.context.close();
  await mine.context.close();
});
