/**
 * V380, QA-516: Log achievement never shows an empty Category list. Where the department has no plan for the year it
 * names the department and the year, and an admin gets "Open the {year} plan"; where the person has no department at
 * all, it says to set one, and offers no Open button that could only fail. Every value is made up.
 * Sabotage: tests/sabotage/achievements.mjs "no-department-offers-a-dead-button".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { LogAchievement } from '../../../src/modules/perf/screens/LogAchievement';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const html = (department: { id: string; name: string }, canOpenPlan: boolean) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <LogAchievement
        categories={[]}
        year={2026}
        people={[]}
        systems={[]}
        meId="00000000-0000-4000-8000-000000000001"
        full={false}
        department={department}
        canOpenPlan={canOpenPlan}
      />
    </NextIntlClientProvider>,
  );

describe('Log achievement with no categories', () => {
  it("names the department and the year, and offers an admin the year's plan", () => {
    const out = html({ id: '00000000-0000-4000-8000-0000000000d1', name: 'Made-up Sales' }, true);
    expect(out).toContain('No categories for Made-up Sales in 2026 yet.');
    expect(out).toContain('Open the 2026 plan');
  });
  it('tells everyone else to ask an admin', () => {
    const out = html({ id: '00000000-0000-4000-8000-0000000000d1', name: 'Made-up Sales' }, false);
    expect(out).toContain('Ask an admin to open it.');
    expect(out).not.toContain('Open the 2026 plan');
  });
  it('says to set a department when the person has none, with no Open button', () => {
    const out = html({ id: '', name: '' }, true);
    expect(out).toContain('Your profile has no department yet.');
    expect(out, 'no Open button without a department').not.toContain('Open the 2026 plan');
    expect(out).not.toContain('No categories for');
  });
});
