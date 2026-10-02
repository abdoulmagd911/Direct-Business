/**
 * UI-*: every kit component in the four themes, both densities, at 400 and 1,500 px — screenshots
 * for the oversight's review beside the design system page; axe finds no serious issue; in Direct
 * nothing draws text on the accent fill (V7). Screenshots land in test-results/screenshots/ (SCREENSHOT_DIR=tests/e2e/screenshots refreshes the committed set).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { THEMES, expectNoConsoleErrors, fitToPage, open, setPrefs, shot } from './helpers';

for (const theme of THEMES) {
  for (const width of [1500, 400] as const) {
    test(`kit · ${theme} · comfortable · ${width}px`, async ({ page, context }) => {
      await setPrefs(context, { theme, density: 'comfortable' });
      await page.setViewportSize({ width, height: 900 });
      await expectNoConsoleErrors(page, async () => {
        await open(page, '/kit');
        await expect(page.locator('[data-kit-section="Table"] tr[data-index]').first()).toBeVisible();
      });
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await fitToPage(page, width);
      await page.screenshot({ path: shot(`kit-${theme}-comfortable-${width}`), fullPage: false });
    });
  }
  test(`kit · ${theme} · compact · 1500px`, async ({ page, context }) => {
    await setPrefs(context, { theme, density: 'compact' });
    await page.setViewportSize({ width: 1500, height: 900 });
    await open(page, '/kit');
    const row = page.locator('[data-kit-section="Table"] tr[data-index]').first();
    await expect(row).toBeVisible();
    expect((await row.boundingBox())!.height, 'compact rows are 32 px').toBeCloseTo(32, 0);
    await fitToPage(page, 1500);
    await page.screenshot({ path: shot(`kit-${theme}-compact-1500`) });
  });

  test(`axe · kit · ${theme}`, async ({ page, context }) => {
    await setPrefs(context, { theme });
    await page.setViewportSize({ width: 1500, height: 900 });
    await open(page, '/kit');
    await expect(page.locator('[data-kit-section="Table"] tr[data-index]').first()).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(
      serious.map(
        (v) =>
          `${v.id}: ${v.help} — ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(' | ')}`,
      ),
    ).toEqual([]);
  });
}

test('comfortable rows are 48 px and the 2,500-row table is virtualized', async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/kit');
  const rows = page.locator('[data-kit-section="Table"] tr[data-index]');
  await expect(rows.first()).toBeVisible();
  expect((await rows.first().boundingBox())!.height).toBeCloseTo(48, 0);
  expect(await rows.count()).toBeLessThan(120);
});

test('Direct never puts text on the accent fill', async ({ page, context }) => {
  await setPrefs(context, { theme: 'direct' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/kit');
  await expect(page.locator('[data-kit-section="Table"] tr[data-index]').first()).toBeVisible();
  const offenders = await page.evaluate(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const probe = document.createElement('i');
    probe.style.color = accent;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (getComputedStyle(el).backgroundColor !== rgb) continue;
      const text = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent?.trim() ?? '')
        .join('');
      if (text) out.push(`${el.tagName.toLowerCase()}.${el.className}: "${text}"`);
    }
    return out;
  });
  expect(offenders).toEqual([]);
});

// The chip's theme switch left with the employee view (V217, cut 5; the one-theme change follows): a theme the profile
// holds is drawn from the first paint and survives a reload.
test('a chosen theme draws with its own tokens and survives a reload', async ({ page, context }) => {
  await setPrefs(context, { theme: 'dark' });
  await page.setViewportSize({ width: 1500, height: 900 });
  await open(page, '/kit');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(22, 27, 27)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
