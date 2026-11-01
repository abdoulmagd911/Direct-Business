/**
 * Found walking Wrap up at 375 px: the day under "Tomorrow" ("Sun, 1 Nov 2026") broke over two or three lines inside the
 * narrow button, in English and worse in Arabic. Tomorrow's column is now the wider one and its day is written on one line.
 * The three choices still sit on one row and stay 44 px high. Every value is made up.
 * Sabotages: tests/sabotage/wrap-up-day.mjs.
 */
import { expect, test, type Page } from '@playwright/test';
import { callAs, makePerson, signIn, sql } from './support/stack';
import { setPrefs } from './helpers';
import { withArabicOn } from './support/arabic';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));

for (const code of ['en', 'ar'] as const) {
  test(`the day under Tomorrow in Wrap up is on one line, 375 px — ${code === 'en' ? 'English' : 'Arabic'}`, async ({
    page,
    context,
  }) => {
    const member = await makePerson();
    const t = Math.random().toString(36).slice(2, 7);
    const [team] = await sql<{ id: string }>(
      `insert into core.team (department_id, code, name_en, name_ar)
         select department_id, $2, $3, $4 from core.person where id = $1 returning id`,
      [member.id, `wu_${t}`, `Test Team ${t}`, `فريق اختبار ${t}`],
    );
    await sql(`update core.person set team_id = $2 where id = $1`, [member.id, team!.id]);
    const body = async () => {
      await page.setViewportSize({ width: 375, height: 800 });
      await signIn(page, member.email, '/my-day');
      await hydrated(page);
      const made = await callAs(context, 'task_create', { p_values: { title: `Made-up ${t} wrap day` } });
      expect(made.status, JSON.stringify(made.body)).toBe(200);
      await sql(`update work.task set due_on = core.riyadh_today() where number = $1`, [
        (made.body as { number: string }).number,
      ]);
      if (code === 'ar') await setPrefs(context, { locale: 'ar' });
      await page.reload();
      await hydrated(page);
      await page.locator('[data-wrap-open]').click();
      await page.locator('[data-wrap-up]').waitFor();
      const day = page.locator('[data-wrap-lands-on="tomorrow"]').first();
      await expect(day).toBeVisible();
      const lines = await day.evaluate((e) => {
        const r = document.createRange();
        r.selectNodeContents(e);
        return new Set(Array.from(r.getClientRects()).map((x) => Math.round(x.top))).size;
      });
      expect(lines, 'the day under Tomorrow is written on one line').toBe(1);
      const row = page.locator('[data-wrap-choice]');
      const tops = await row.evaluateAll((els) =>
        els.slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().top)),
      );
      expect(new Set(tops).size, 'Done, Tomorrow and Drop stay on one row').toBe(1);
      const heights = await row.evaluateAll((els) => els.slice(0, 3).map((e) => e.getBoundingClientRect().height));
      expect(Math.min(...heights), 'each choice is a 44 px target').toBeGreaterThanOrEqual(43.5);
    };
    if (code === 'ar') await withArabicOn(member.id, 'Made-up reason: wrap-up day', body);
    else await body();
  });
}
