/**
 * The owner's phone round on production at 375 px (8 Oct): every control a thumb meets is a 44 px target — the Tasks
 * done-circle (a 24 px circle with a 44 px target), the filter chips, the List / Board / Calendar switch, Save view, the
 * client page's buttons — New client says what it needs before Save is enabled, and the Tasks tab row does not clip
 * Past work at the edge. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "phone-controls-shrink-again", "done-tick-target-is-the-circle",
 * "new-client-hides-what-it-needs", "tabs-clip-at-the-edge".
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql, type TestPerson } from './support/stack';

const PHONE = { width: 375, height: 812 };
const TARGET = 44;

const hydrated = (page: Page) =>
  page.waitForFunction(() => !!document.querySelector('[data-hydrated]'), null, { timeout: 30_000 });

async function memberWithTeam(): Promise<TestPerson> {
  const person = await makePerson();
  await sql(
    `insert into core.team (department_id, code, name_en, name_ar, created_by)
     values ((select id from core.department where code = 'commercial'), 'test_phone', 'Test phone team', 'فريق الهاتف', $1)
     on conflict (department_id, code) do nothing`,
    [person.id],
  );
  await sql(
    `update core.person set team_id = (select t.id from core.team t join core.department d on d.id = t.department_id
                                       where d.code = 'commercial' and t.code = 'test_phone') where id = $1`,
    [person.id],
  );
  return person;
}

/** The heights, in px, of everything a selector finds that is on the screen. */
const heights = (page: Page, selector: string) =>
  page
    .locator(selector)
    .evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getBoundingClientRect().height),
    );

test('phone 375: a done-circle, the chips, the layout switch, Save view and the client page are 44 px targets', async ({
  page,
}) => {
  const member = await memberWithTeam();
  const t = Math.random().toString(36).slice(2, 6);
  const title = `Made-up phone target task ${t}`;
  await sql(
    `insert into work.task (number, title, owner_id, team_id, department_id, status_id, work_type, created_by)
     values ($1, $2, $3, (select team_id from core.person where id = $3),
             (select department_id from core.person where id = $3),
             (select id from work.task_status where is_default and deleted_at is null), 'internal', $3)`,
    [`TSK-1999-${Math.floor(Math.random() * 90000) + 10000}`, title, member.id],
  );
  await page.setViewportSize(PHONE);
  await signIn(page, member.email, '/tasks');
  await hydrated(page);

  // the circle stays 24 px to look at; a thumb has 44 px around it
  const tick = page.locator('[data-done-tick]').first();
  await tick.scrollIntoViewIfNeeded();
  const box = (await tick.boundingBox())!;
  expect(box.width, 'the circle itself is still small').toBeLessThan(30);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const hits = (dx: number, dy: number) =>
    page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest('[data-done-tick]'), [cx + dx, cy + dy]);
  for (const [dx, dy] of [
    [21, 0],
    [-21, 0],
    [0, 21],
    [0, -21],
  ] as const)
    expect(await hits(dx, dy), `a tap ${dx},${dy} px from the circle's centre marks it done`).toBe(true);
  expect(await hits(30, 0), 'a tap well outside the 44 px does not').toBe(false);

  for (const h of await heights(page, '[data-task-chips] button'))
    expect(h, 'a Tasks filter chip is 44 px tall').toBeGreaterThanOrEqual(TARGET - 0.5);
  const layout = await heights(page, '[data-layouts] a');
  expect(layout.length, 'the List / Board / Calendar switch is there').toBe(3);
  for (const h of layout) expect(h, 'a layout link is 44 px tall').toBeGreaterThanOrEqual(TARGET - 0.5);

  // the tab row shows Past work whole: every tab sits inside the screen
  const tabs = await page
    .locator('[data-tabs] > *')
    .evaluateAll((els) =>
      els.map((e) => ({ right: e.getBoundingClientRect().right, left: e.getBoundingClientRect().left })),
    );
  expect(tabs.length, 'My work · Owned · Helping · Team · Past work').toBeGreaterThanOrEqual(5);
  for (const x of tabs) {
    expect(x.right, 'no tab is cut off at the right edge').toBeLessThanOrEqual(PHONE.width + 0.5);
    expect(x.left, 'nor at the left').toBeGreaterThanOrEqual(-0.5);
  }

  // Clients: the chips and Save view
  await page.goto('/clients');
  await hydrated(page);
  const bar = await heights(page, '[data-saved-views] button, [data-view-save]');
  expect(bar.length, 'Save view is there').toBeGreaterThan(0);
  for (const h of bar) expect(h, 'a saved-view pill and Save view are 44 px tall').toBeGreaterThanOrEqual(TARGET - 0.5);

  // a client's page: Add note, Log activity, + Add
  const created = await callAs(page.context(), 'partner_create', {
    p_partner: { trade_name_en: `Test Org Phone Target ${t}`, sides: [{ side: 'client', type: 'corporate' }] },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  await page.goto(`/clients/${(created.body as { id: string }).id}`);
  await hydrated(page);
  const record = await heights(
    page,
    '[data-record-header] button, [data-record-main] button, [data-record-rail] button',
  );
  expect(record.length, "the client page's buttons are there").toBeGreaterThan(2);
  for (const h of record) expect(h, "a button on the client's page is 44 px tall").toBeGreaterThanOrEqual(TARGET - 0.5);
});

test('phone 375: New client says what it needs before Save can be pressed', async ({ page }) => {
  const admin = await makePerson({ admin: true });
  await page.setViewportSize(PHONE);
  await signIn(page, admin.email, '/clients');
  await hydrated(page);
  await page.locator('[data-partner-new]').click();
  const form = page.locator('[data-partner-form]');
  await expect(page.locator('[data-partner-save]'), 'Save is off until the form is whole').toBeDisabled();
  await expect(form.getByText('Required'), 'the name and the type each say Required').toHaveCount(2);
  await expect(form.getByRole('combobox', { name: /Type/ }), 'the type asks to be chosen').toContainText(
    'Choose a type',
  );
});
