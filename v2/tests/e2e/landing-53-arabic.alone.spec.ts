/**
 * Landing 53 in Arabic (Batch 2 of the boards), on a PC and on a phone — it runs alone (Arabic is one setting for
 * everyone), under the Arabic specs' one database lock (support/arabic.ts); the person reads Arabic because they saved
 * it. My day reads right to left: the day «الجمعة، 13 نوفمبر 2026» with Latin digits, the buttons ختام اليوم and تدوين,
 * «ثلاث مهام اليوم» with مهمة · سريعة · روتينية and their sub-lines, the cards mirrored (the first card at the right), the
 * streak line «… من 9 مكتملة اليوم», «بقية اليوم» with the kinds in Arabic, and the same rows, in the same order, as in
 * English. Nothing scrolls sideways and no word is under 12 px. Every value is made up.
 */
import { expect, test, type Page } from '@playwright/test';
import { readsArabic, withArabicOn } from './support/arabic';
import { DESKTOP, sideways, staffAs, tag } from './support/landing-34';
import { PHONE_390, madeUpType, seedDay, shot, smallWords } from './support/landing-53';
import { signIn } from './support/stack';

const hydrated = (page: Page) => page.waitForFunction(() => !!document.querySelector('[data-hydrated]'));
const GROUPS = ['important', 'short', 'maintenance'] as const;

test('Arabic: My day reads right to left as the Batch 2 boards draw it, on a PC and on a phone', async ({ page }) => {
  test.setTimeout(240_000);
  const me = await staffAs('member');
  const word = tag();
  const key = `made_up_${word}`;
  await madeUpType(me.id, key, `Zed kind ${word}`, `نوع ${word}`);
  const day = await seedDay(me, word, key);
  await readsArabic(me.id);
  await withArabicOn(me.id, 'made up: Landing 53 in Arabic', async () => {
    await page.setViewportSize(DESKTOP);
    await signIn(page, me.email, '/my-day');
    await hydrated(page);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'ar');
    await expect(html).toHaveAttribute('dir', 'rtl');
    // the day: Arabic words, Latin digits, Gregorian
    await expect(page.locator('[data-day-heading]')).toHaveText(
      /^(الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)، \d{1,2} \S+ \d{4}$/,
    );
    await expect(page.locator('[data-wrap-open]')).toHaveText('ختام اليوم');
    await expect(page.locator('[data-capture-open]')).toHaveText('تدوين');
    const wrap = (await page.locator('[data-wrap-open]').boundingBox())!;
    const heading = (await page.locator('[data-day-heading]').boundingBox())!;
    expect(wrap.x, 'the banner is mirrored: its buttons are at the left edge').toBeLessThan(heading.x);

    const three = page.locator('[data-todays-three]');
    await expect(three.locator('h2')).toHaveText('ثلاث مهام اليوم');
    await expect(three.locator('[data-three-group] h3 span:first-child')).toHaveText(['مهمة', 'سريعة', 'روتينية']);
    await expect(three.locator('[data-three-sub]')).toHaveText(['أولوية قصوى', 'أقل من 15 دقيقة', 'مهام روتينية']);
    await expect(three.locator('[data-streak-today]'), 'Latin digits').toHaveText('0 من 9 مكتملة اليوم');
    for (const g of GROUPS)
      expect(
        await three
          .locator(`[data-three-group="${g}"] [data-three-row]`)
          .evaluateAll((els) => els.map((e) => e.getAttribute('data-three-row'))),
        `${g}: the same tasks in the same order as in English`,
      ).toEqual(day[g]);
    await expect(three.locator(`[data-three-row="${day.important[0]}"] [data-row-kind]`)).toHaveText('اجتماع');
    const cards = await three
      .locator('[data-three-group]')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
    expect(cards[0]!.left, 'mirrored: the first card is at the right').toBeGreaterThan(cards[1]!.left);
    expect(cards[1]!.left).toBeGreaterThan(cards[2]!.left);

    const rest = page.locator('[data-today-block]');
    await expect(rest.locator('h2')).toHaveText('بقية اليوم (6)');
    await expect(rest.locator('[data-rest-kind] h3 span:first-of-type')).toHaveText([
      'اجتماعات',
      'متابعات',
      `نوع ${word}`,
      'أخرى',
    ]);
    await expect(rest.locator('[data-rest-view-option]')).toHaveText(['حسب النوع', 'حسب الأولوية']);
    expect(await sideways(page), 'PC: nothing scrolls sideways').toBeLessThanOrEqual(0);
    expect(await smallWords(three), 'PC: no word under 12 px').toBe(0);
    expect(await smallWords(rest)).toBe(0);
    await shot(page, 'ar-1440');

    // the four boxes in Arabic
    await rest.locator('[data-rest-view-option="priority"]').click();
    await expect(rest.locator('[data-today-chip]')).toHaveText([
      /^التذكيرات/,
      /^افعلها الآن/,
      /^خطّط لها/,
      /^سريعة أو فوّضها/,
      /^لاحقًا/,
      /^أساعد فيها/,
    ]);
    await rest.locator('[data-rest-view-option="kind"]').click();

    await page.setViewportSize(PHONE_390);
    await page.reload();
    await hydrated(page);
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(three.locator('h2')).toHaveText('ثلاث مهام اليوم');
    await expect(page.locator('[data-capture-open]'), 'phone: only ختام اليوم is on the banner').toBeHidden();
    const rows = await page
      .locator('[data-todays-three] [data-today-task], [data-today-block] [data-today-task]')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(rows.length).toBe(15);
    expect(Math.min(...rows), 'phone: every task row is at least 56 px tall').toBeGreaterThanOrEqual(56);
    expect(await sideways(page), 'phone: nothing scrolls sideways').toBeLessThanOrEqual(0);
    expect(await smallWords(three), 'phone: no word under 12 px').toBe(0);
    await shot(page, 'ar-390');
  });
});
