/**
 * W44 (#146): a Settings group with no settings and no lists says what it is in one line, "Nothing to set up here yet.",
 * never an explanation of the build. Once Finance lands (#186) no Settings group of the app is empty, so the line is
 * checked here, on the group's body, rather than on a page in the browser. Every value is made up (rule 7).
 * Sabotage: tests/sabotage/screens.mjs "settings-empty-group-explains-the-build".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const { SettingsGroup } = await import('../../../src/modules/settings/screens/SettingsGroup');

describe('an empty Settings group (W44)', () => {
  it('says what it is in one line', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <SettingsGroup settings={[]} canEdit departments={[]} lists={[]} today="2026-01-15" />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Nothing to set up here yet.');
  });
});
