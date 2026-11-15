import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';

// Landing 28 (15 Nov): the two broken pages. Made-up people, partners and codes only.
//  - /codes: a code's detail opens from the list, and a detail that cannot be read says what failed (the error's
//    kind and code) beside Try again, instead of only "could not be loaded".
//  - /activity: while signed in as a test user the settings log is not offered — its address lands on the default
//    tab and the other three tabs load; back on the admin's own account the settings log is there again.
// Sabotages: tests/sabotage/landing-28.mjs "e2e-codes-detail-drops-its-error" and
// "e2e-switched-session-is-offered-the-settings-log".

const hydrated = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

test('codes: a detail opens from the list, and a failed detail says what failed', async ({ page, context }) => {
  const admin = await makePerson({ admin: true });
  await signIn(page, admin.email, '/codes');
  await hydrated(page);
  const tag = randomUUID().slice(0, 8).toUpperCase();
  const code = `MADEUP${tag}`;
  const partner = await callAs(context, 'partner_create', {
    p_partner: { trade_name_en: `Made Up Codes Co ${tag}`, sides: [{ side: 'client', type: 'corporate' }] },
  });
  expect(partner.status, JSON.stringify(partner.body)).toBe(200);
  const added = await callAs(context, 'identifier_add', {
    p_partner: (partner.body as { id: string }).id,
    p_kind: 'discount_code',
    p_value: code,
    p_reason: 'made up',
  });
  expect(added.status, JSON.stringify(added.body)).toBe(200);
  const codeId = (added.body as { id: string }).id;

  await page.goto(`/codes?code=${codeId}`);
  await hydrated(page);
  const detail = page.locator('[data-codes-detail]');
  await expect(detail, 'the detail of the made-up code is drawn').toBeVisible();
  await expect(detail).toContainText(code);
  await expect(page.locator('[data-codes-detail-error]')).toHaveCount(0);

  // a code that is not there: the database answers "not found", and the failed state names that answer
  await page.goto(`/codes?code=${randomUUID()}`);
  await hydrated(page);
  await expect(page.locator('[data-codes-detail]')).toHaveCount(0);
  await expect(page.locator('[data-codes-detail-error]'), 'the failed detail says what failed').toHaveText(
    'NotFound · common.not_found',
  );
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('activity: a switched session is not offered the settings log, and no tab takes the page down', async ({
  page,
  context,
}) => {
  const owner = await makePerson({ admin: true });
  const testAdmin = await makePerson({ admin: true });
  await sql(`update core.person set is_test = true where id = $1`, [testAdmin.id]);
  await sql(`insert into core.test_switch_holder (person_id, note) values ($1, 'made up: the owner')`, [owner.id]);

  await signIn(page, owner.email, '/activity?tab=settings');
  await hydrated(page);
  // the admin's own account: the settings log is offered and read
  await expect(page.locator('[data-activity-settings]'), 'the real admin reads the settings log').toBeVisible();
  await expect(page.locator('[data-tabs] a[href="/activity?tab=settings"]')).toBeVisible();

  const switched = await callAs(context, 'test_switch_start', { p_person: testAdmin.id });
  expect(switched.status, JSON.stringify(switched.body)).toBe(200);

  await page.goto('/activity?tab=settings');
  await hydrated(page);
  await expect(page, 'the settings address lands on the default tab').toHaveURL(/\/activity$/);
  await expect(page.locator('[data-activity-changes]'), 'the default tab is drawn').toBeVisible();
  await expect(
    page.locator('[data-tabs] a[href="/activity?tab=settings"]'),
    'the Settings tab is not offered',
  ).toHaveCount(0);
  await expect(page.getByText('This page could not be drawn')).toHaveCount(0);

  for (const [tab, mark] of [
    ['signIns', '[data-activity-sign-ins]'],
    ['deleted', '[data-activity-deleted], [data-deleted-filters]'],
  ] as const) {
    await page.goto(`/activity?tab=${tab}`);
    await hydrated(page);
    await expect(page.locator(mark).first(), `the ${tab} tab is drawn while switched`).toBeVisible();
    await expect(page.locator('[data-state="failed"]')).toHaveCount(0);
    await expect(page.getByText('This page could not be drawn')).toHaveCount(0);
  }

  const back = await callAs(context, 'test_switch_end', {});
  expect(back.status, JSON.stringify(back.body)).toBe(200);
  await page.goto('/activity?tab=settings');
  await hydrated(page);
  await expect(page.locator('[data-activity-settings]'), 'back on the own account, the log is read').toBeVisible();
});
