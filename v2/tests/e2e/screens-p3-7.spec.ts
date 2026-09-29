/**
 * Screenshots of the P3-7 pieces: the bell's panel with a notification, Recently deleted, the list kit (saved views
 * and the bulk bar) — four themes at 1,500 and 400 px; the conflict dialog in Direct at both widths; axe on each.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { THEMES, fitToPage, setPrefs, shot } from './helpers';
import { makePerson, signIn, sql } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text }).first();

/** A person with one unread notification (their record changed by an admin) and one removed saved view. */
async function stage(page: Page, admin: { email: string; id: string; name: string }, tag: string) {
  const member = await makePerson();
  await signIn(page, admin.email, `/people/${member.id}`);
  await hydrated(page);
  await page.locator('[data-person-edit]').click();
  await page.getByRole('dialog').getByLabel('Job title', { exact: true }).fill('Made-up title');
  await page.getByRole('dialog').locator('[data-person-save]').click();
  await expect(toast(page, 'updated')).toBeVisible();
  await page.goto('/kit');
  await hydrated(page);
  await page.locator('[data-view-save]').click();
  await page.getByRole('dialog').getByLabel('Name').fill(`Shot view ${tag}`);
  await page.getByRole('dialog').locator('[data-view-save-confirm]').click();
  await expect(toast(page, 'View saved')).toBeVisible();
  const [view] = await sql<{ id: string }>(`select id from core.saved_view where name = $1`, [`Shot view ${tag}`]);
  await sql(`update core.saved_view set deleted_at = now(), deleted_by = $2 where id = $1`, [view!.id, admin.id]);
  return member;
}

for (const theme of THEMES) {
  for (const width of [1500, 400] as const) {
    test(`shot · P3-7 · ${theme} · ${width}px`, async ({ page, context, browser }) => {
      await setPrefs(context, { theme });
      await page.setViewportSize({ width: 1500, height: 900 });
      const admin = await makePerson({ admin: true });
      const tag = `${theme}${width}${Date.now().toString(36)}`;
      const member = await stage(page, admin, tag);

      // the bell, as the member who was told
      const ctx = await browser.newContext();
      await setPrefs(ctx, { theme });
      const their = await ctx.newPage();
      await their.setViewportSize({ width, height: 900 });
      await signIn(their, member.email, '/my-day');
      await hydrated(their);
      await their.locator('[data-bell]').click();
      await expect(their.locator('[data-notifications-panel] [data-notification]').first()).toBeVisible();
      await their.screenshot({ path: shot(`bell-${theme}-${width}`) });
      await ctx.close();

      await page.setViewportSize({ width, height: 900 });
      await page.goto('/activity?tab=deleted');
      await hydrated(page);
      await expect(page.locator('[data-deleted-row]').first()).toBeVisible();
      await fitToPage(page, width);
      await page.screenshot({ path: shot(`recently-deleted-${theme}-${width}`) });

      await page.goto('/kit');
      await hydrated(page);
      const table = page.locator('[data-kit-section="Table"]');
      await table.locator('tr[data-index]').nth(0).getByLabel('Select row').click();
      await table.locator('tr[data-index]').nth(1).getByLabel('Select row').click();
      await expect(page.locator('[data-bulk-bar]')).toBeVisible();
      await table.scrollIntoViewIfNeeded();
      await page.screenshot({ path: shot(`list-kit-${theme}-${width}`) });
    });
  }
}

for (const width of [1500, 400] as const) {
  test(`shot · conflict dialog · direct · ${width}px`, async ({ page, context, browser }) => {
    await setPrefs(context, { theme: 'direct' });
    const a = await makePerson({ admin: true });
    const b = await makePerson({ admin: true });
    const target = await makePerson();
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, b.email, `/people/${target.id}`);
    await hydrated(page);
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await other.setViewportSize({ width: 1500, height: 900 });
    await signIn(other, a.email, `/people/${target.id}`);
    await hydrated(other);
    await other.locator('[data-person-edit]').click();
    await other.getByRole('dialog').getByLabel('Job title', { exact: true }).fill('Head of made-up things');
    await other.getByRole('dialog').locator('[data-person-save]').click();
    await expect(toast(other, 'updated')).toBeVisible();
    await ctx.close();
    await page.locator('[data-person-edit]').click();
    await page.getByRole('dialog').getByLabel('Job title', { exact: true }).fill('Lead of sample matters');
    await page.getByRole('dialog').locator('[data-person-save]').click();
    await expect(page.locator('[data-conflict-dialog]')).toBeVisible();
    await page.screenshot({ path: shot(`conflict-direct-${width}`) });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  });
}

test('axe · the bell panel and Recently deleted', async ({ page, context, browser }) => {
  await setPrefs(context, { theme: 'direct' });
  await page.setViewportSize({ width: 1500, height: 900 });
  const admin = await makePerson({ admin: true });
  const tag = `axe${Date.now().toString(36)}`;
  const member = await stage(page, admin, tag);
  await page.goto('/activity?tab=deleted');
  await hydrated(page);
  await expect(page.locator('[data-deleted-row]').first()).toBeVisible();
  const serious = (r: Awaited<ReturnType<AxeBuilder['analyze']>>) =>
    r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
  expect(serious(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())).toEqual([]);
  const ctx = await browser.newContext();
  const their = await ctx.newPage();
  await their.setViewportSize({ width: 1500, height: 900 });
  await signIn(their, member.email, '/my-day');
  await hydrated(their);
  await their.locator('[data-bell]').click();
  await expect(their.locator('[data-notifications-panel] [data-notification]').first()).toBeVisible();
  expect(serious(await new AxeBuilder({ page: their }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())).toEqual(
    [],
  );
  await ctx.close();
});
