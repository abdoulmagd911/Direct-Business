/**
 * Found walking the daily flow in Arabic at 375 px: the font for dates and numbers has no Arabic letters, so the month in
 * "31 أكتوبر 2026" was drawn in a system monospace font, one letter apart and unjoined. The date now falls back to the
 * app's own Arabic font, like every other word. The browser is asked which fonts it really drew the date in. Every value is
 * made up. Sabotages: tests/sabotage/arabic-dates.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';
import { setPrefs } from './helpers';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

test('a date in Arabic is drawn in the app’s own fonts, not a system monospace one (375 px)', async ({
  page,
  context,
}) => {
  const member = await makePerson();
  const t = Math.random().toString(36).slice(2, 7);
  const [team] = await sql<{ id: string }>(
    `insert into core.team (department_id, code, name_en, name_ar)
       select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
    [member.id, `ad_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
  );
  await sql(`update core.person set team_id = $2 where id = $1`, [member.id, team!.id]);
  await sql(
    `insert into core.setting (key, value, valid_from, reason, created_by)
       values ('app.arabic_enabled', 'true'::jsonb, current_date, 'Made-up reason: Arabic dates', $1)`,
    [member.id],
  );
  try {
    await page.setViewportSize({ width: 375, height: 800 });
    await signIn(page, member.email, '/my-day');
    await hydrated(page);
    const made = await callAs(context, 'task_create', { p_values: { title: `Made-up ${t} dated` } });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    const { number } = made.body as { number: string };
    await sql(`update work.task set due_on = core.riyadh_today() where number = $1`, [number]);
    await setPrefs(context, { locale: 'ar' });
    await page.reload();
    await hydrated(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

    const date = page.locator(`[data-today-task="${number}"] .font-data`).first();
    await expect(date).toContainText(/[؀-ۿ]/);
    // the fonts the browser really used for the letters of this date: every one of them is one the app ships
    const cdp = await context.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await cdp.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: `[data-today-task="${number}"] .font-data`,
    });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    const system = fonts.filter((f) => !f.isCustomFont).map((f) => f.familyName);
    expect(system, 'the Arabic date is drawn in the app’s own fonts, not a system monospace font').toEqual([]);
  } finally {
    await sql(`update core.setting set deleted_at = now() where key = 'app.arabic_enabled'`);
  }
});
