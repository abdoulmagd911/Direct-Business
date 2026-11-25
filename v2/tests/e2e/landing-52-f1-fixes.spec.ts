/**
 * Landing 52 — the three failures of the F1 live re-test of 25 Nov, in the browser, as a person meets them.
 *  · FIX-11: on Recently deleted a Team member is listed only what they removed themselves — not what a colleague
 *    or the admin removed, even of a task they could open — while a manager (who may open Activity) still is.
 *  · FIX-13: the top search asks the server once for a word typed letter by letter (it asked once per letter),
 *    finds an organisation by its name promptly, and a search that fails says so with Try again — never
 *    "Nothing matches".
 *  · FIX-19: the sign-in page has a set-password link; it opens a page a signed-out visitor can use, where the work
 *    email and the temporary password from an admin lead to "Choose a new password"; the language button still works.
 * Every value is made up. Sabotage: tests/sabotage/landing-52.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, signOut, sql } from './support/stack';

test.skip(process.env.SIGN_IN_METHOD === 'code', 'the code door is on instead');

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const tag = () => `bin${Math.random().toString(36).slice(2, 7)}`;
const palette = (page: Page) => page.locator('[data-command-palette]');
const box = (page: Page) => palette(page).getByPlaceholder('Go to a page or search…');

test('Recently deleted: a member is listed only what they removed themselves; a manager is listed the team’s', async ({
  browser,
}) => {
  test.slow();
  const t = tag();
  const [one, two, manager, admin] = await Promise.all([
    makePerson(),
    makePerson(),
    makePerson(),
    makePerson({ admin: true }),
  ]);
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [one.id, `rd_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $1 where id = any ($2)`, [team!.id, [one.id, two.id, manager.id]]);
  await sql(`update core.person set role_id = (select id from core.role where key = 'manager') where id = $1`, [
    manager.id,
  ]);

  const open = async (email: string) => {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page, email, '/recently-deleted');
    await hydrated(page);
    return page;
  };
  const rowOf = (page: Page, id: string) => page.locator(`[data-deleted-row="${id}"]`);

  // member one makes two tasks and removes the first; the admin removes the second
  const first = await open(one.email);
  const made = async (page: Page, title: string) => {
    const r = await callAs(page.context(), 'task_create', { p_values: { title } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return (r.body as { id: string }).id;
  };
  const mine = await made(first, `Made-up ${t} removed by its owner`);
  const theirs = await made(first, `Made-up ${t} removed by the admin`);
  const gone = await callAs(first.context(), 'tasks_remove', { p_ids: [mine], p_reason: 'made up: mine, gone' });
  expect(gone.status, JSON.stringify(gone.body)).toBe(200);
  const boss = await open(admin.email);
  const cut = await callAs(boss.context(), 'tasks_remove', { p_ids: [theirs], p_reason: 'made up: removed by admin' });
  expect(cut.status, JSON.stringify(cut.body)).toBe(200);

  // the member who removed one: that one, with Restore — and not the one the admin removed
  await first.reload();
  await hydrated(first);
  await expect(rowOf(first, mine), 'a member sees what they removed themselves').toBeVisible();
  await expect(rowOf(first, mine).locator('[data-deleted-restore]')).toBeVisible();
  await expect(rowOf(first, theirs), 'a member is not listed what the admin removed').toHaveCount(0);
  await expect(first.getByText(`Made-up ${t} removed by the admin`)).toHaveCount(0);

  // a colleague in the same team, who could open both tasks: neither
  const second = await open(two.email);
  await expect(second.locator('[data-deleted-filters], [data-activity-deleted]').first()).toBeVisible();
  await expect(rowOf(second, mine), 'a member is not listed what a colleague removed').toHaveCount(0);
  await expect(rowOf(second, theirs)).toHaveCount(0);
  await expect(second.getByText(`Made-up ${t}`)).toHaveCount(0);
  // and the database answers that member the same way, whatever the page draws
  const asked = await callAs(second.context(), 'recently_deleted', { p_limit: 200 });
  expect(asked.status).toBe(200);
  expect(
    (asked.body as { deleted_by: string }[]).filter((r) => r.deleted_by !== two.id),
    'no row a member is answered was removed by someone else',
  ).toEqual([]);

  // a manager may open Activity: listed what the team removed, as before
  const third = await open(manager.email);
  await expect(rowOf(third, mine), 'a manager is still listed what the team removed').toBeVisible();
  await expect(rowOf(third, theirs)).toBeVisible();
  // and the admin
  await boss.goto('/recently-deleted');
  await hydrated(boss);
  await expect(rowOf(boss, mine)).toBeVisible();
  await expect(rowOf(boss, theirs)).toBeVisible();
  await Promise.all([first.close(), second.close(), third.close(), boss.close()]);
});

test('the top search asks once for a typed word, finds an organisation promptly, and says when it fails', async ({
  page,
}) => {
  test.slow();
  const t = tag();
  const admin = await makePerson({ admin: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page, admin.email, '/my-day');
  await hydrated(page);
  const name = `Made-up ${t} Transport Co`;
  const made = await callAs(page.context(), 'partner_create', {
    p_partner: { trade_name_en: name, sides: [{ side: 'client', type: 'corporate' }] },
  });
  expect(made.status, JSON.stringify(made.body)).toBe(200);
  const id = (made.body as { id: string }).id;

  const asked: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/rpc/search')) asked.push((r.postDataJSON() as { p_q: string }).p_q);
  });

  // typed letter by letter, as a person types: one request, for the whole word
  await page.locator('[data-search]').click();
  const started = Date.now();
  await box(page).pressSequentially(t, { delay: 40 });
  const row = page.locator(`[data-palette-partner="${id}"]`);
  await expect(row, 'the organisation is found by its name').toBeVisible({ timeout: 5_000 });
  expect(Date.now() - started, 'and promptly: within five seconds of the first letter').toBeLessThan(5_000);
  await expect(row).toContainText(name);
  expect(asked, 'the search asked the server once for the typed word, not once per letter').toEqual([t]);

  // a search the server does not answer says so — never "Nothing matches" — and Try again finds it
  await page.keyboard.press('Escape');
  await page.route('**/rpc/search', (route) => route.abort('failed'));
  await page.locator('[data-search]').click();
  await box(page).fill(t);
  const failed = page.locator('[data-palette-search-failed]');
  await expect(failed, 'a search that fails says so').toBeVisible({ timeout: 10_000 });
  await expect(failed).toContainText('Search did not answer.');
  await expect(failed).toContainText('Try again');
  await expect(palette(page).getByText('Nothing matches'), 'a failed search is not "Nothing matches"').toHaveCount(0);
  await page.unroute('**/rpc/search');
  await failed.click();
  await expect(row, 'Try again finds it').toBeVisible({ timeout: 5_000 });

  // a word nothing carries: "Nothing matches", once the server has answered
  await box(page).fill(`zz${t}zz`);
  await expect(palette(page).getByText('Nothing matches')).toBeVisible({ timeout: 5_000 });
  await expect(failed).toHaveCount(0);

  // the result opens the organisation
  await box(page).fill(t);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/partners/${id}$`), { timeout: 15_000 });
});

test('the sign-in page links to set-password; a temporary password leads to choosing one’s own', async ({
  page,
  browser,
}) => {
  test.slow();
  // an admin gives a person a temporary password
  const admin = await makePerson({ admin: true });
  const person = await makePerson({ passwordRecorded: false });
  await page.setViewportSize({ width: 1500, height: 1000 });
  await signIn(page, admin.email, `/people/${person.id}`);
  await hydrated(page);
  await page.locator('[data-person-more]').click();
  await page.locator('[data-password-generate]').click();
  await page.getByRole('dialog').getByLabel('Reason').fill('Made-up reason: first day');
  await page.getByRole('dialog').locator('[data-reason-save]').click();
  await expect(page.locator('[data-temporary-password]')).toBeVisible();
  const temporary = (await page.locator('[data-temporary-password]').textContent())?.trim() ?? '';
  await signOut(page);

  const ctx = await browser.newContext();
  const their = await ctx.newPage();
  await their.setViewportSize({ width: 1500, height: 1000 });
  await their.goto('/sign-in');
  // the door as it was, plus the link
  await expect(their.getByText('Forgot your password? Ask your admin.')).toBeVisible();
  const link = their.getByRole('link', { name: 'Have a temporary password? Set your password' });
  await expect(link, 'the sign-in page has a set-password link').toBeVisible();
  // the language button still switches the whole page, and the link with it
  await their.locator('[data-door-language]:visible').click();
  await expect(their.getByRole('link', { name: 'لديك كلمة مرور مؤقتة؟ عيّن كلمة مرورك' })).toBeVisible();
  await their.locator('[data-door-language]:visible').click();
  await expect(link).toBeVisible();

  // the link opens a page, signed out — not the sign-in page again
  await link.click();
  await expect(their, 'the link leads to the set-password page').toHaveURL(/\/set-password$/);
  await expect(their.getByRole('heading', { name: 'Set your password' })).toBeVisible();
  await expect(their.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  // a wrong temporary password is refused in words, in place
  await their.getByLabel('Work email').fill(person.email);
  await their.getByLabel('Temporary password', { exact: true }).fill('not-the-temporary-one');
  await their.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(their.getByRole('main').getByRole('alert')).toHaveText(
    "That email and password don't match. Try again or ask your admin to reset it.",
  );
  await expect(their).toHaveURL(/\/set-password$/);
  // the right one leads to "Choose a new password", and from there into the app
  await their.getByLabel('Temporary password', { exact: true }).fill(temporary);
  await their.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    their.getByRole('heading', { name: 'Choose a new password' }),
    'the temporary password leads to choosing one’s own',
  ).toBeVisible({ timeout: 15_000 });
  const own = `Own-${Date.now().toString(36)}-pass`;
  await their.getByLabel('New password', { exact: true }).fill(own);
  await their.getByLabel('New password again').fill(own);
  await their.locator('[data-set-password-save]').click();
  await expect(their).not.toHaveURL(/set-password|sign-in/, { timeout: 15_000 });
  await hydrated(their);

  // Back to sign in goes back; someone already signed in is sent on from /set-password
  await their.goto('/set-password');
  await expect(their, 'a signed-in person with nothing to change is sent on').not.toHaveURL(/set-password/, {
    timeout: 15_000,
  });
  await ctx.close();
  const fresh = await browser.newPage();
  await fresh.goto('/set-password');
  await fresh.getByRole('link', { name: 'Back to sign in' }).click();
  await expect(fresh).toHaveURL(/\/sign-in$/);
  await fresh.close();
});
