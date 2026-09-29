/**
 * A screen that crashes while drawing shows the app's own page inside the shell (item 11 of the visual review): the
 * words come from the catalog, the buttons are the app's — Try again and Go to My day — and it lives inside the app
 * layout's error boundary, so the drawer and the top bar stay.
 */
import { readFileSync } from 'node:fs';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import AppError from '../../../src/app/(app)/error';

describe('the crash page', () => {
  it('says what happened in the app font and offers Try again and Go to My day', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <AppError error={new Error('made up')} reset={() => {}} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('Something went wrong');
    expect(html).toContain('data-crash-retry');
    expect(html).toContain('Try again');
    expect(html).toContain('href="/my-day"');
    expect(html).toContain('Go to My day');
    expect(html, 'no raw error text on screen').not.toContain('made up');
  });

  it('is the app layout’s error boundary, so the shell stays around it', () => {
    const source = readFileSync(new URL('../../../src/app/(app)/error.tsx', import.meta.url), 'utf8');
    expect(source).toContain("'use client'");
    expect(source).toContain('PageFrame');
  });
});
