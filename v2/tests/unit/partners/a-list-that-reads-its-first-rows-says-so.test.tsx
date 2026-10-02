/**
 * QA-506: the list reads a fixed number of rows while the header shows the full total; past the cap a line says how many
 * are shown of how many, and that a search or a filter narrows them. Sabotage: tests/sabotage/screens.mjs
 * "capped-list-says-nothing".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import { CappedNote } from '../../../src/modules/partners/screens/CappedNote';

const html = (shown: number, total: number) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <CappedNote shown={shown} total={total} />
    </NextIntlClientProvider>,
  );

describe('the capped-list line', () => {
  it('says how many it shows of how many, and what narrows them', () => {
    const out = html(500, 612);
    expect(out, 'says how many it shows of how many').toContain('Showing 500 of 612');
    expect(out).toContain('search or filter');
  });
  it('says nothing when every row is shown', () => {
    expect(html(500, 500)).toBe('');
    expect(html(3, 3)).toBe('');
  });
});
