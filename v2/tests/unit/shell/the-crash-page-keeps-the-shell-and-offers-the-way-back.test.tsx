/**
 * A screen that crashes while drawing shows the app's own page inside the shell (item 11 of the visual review): the
 * words come from the catalog, the buttons are the app's — Try again and Go to My day — and it lives inside the app
 * layout's error boundary, so the drawer and the top bar stay. When the frame itself cannot load (the data API down —
 * QA-184), the root boundary says so in the same words and buttons, and the last boundary brings its own page.
 */
import { readFileSync } from 'node:fs';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import AppError from '../../../src/app/(app)/error';
import RootError from '../../../src/app/error';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

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

  it('says so in the app’s words when the frame itself cannot load (QA-184)', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <RootError error={new Error('made up')} reset={() => {}} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('data-root-error');
    expect(html).toContain('Something went wrong');
    expect(html).toContain('could not reach its data');
    expect(html).toContain('Try again');
    expect(html).toContain('href="/my-day"');
    expect(html, 'no raw error text on screen').not.toContain('made up');
  });

  it('has a root boundary and a last one that brings its own page, font and words', () => {
    const root = readFileSync(new URL('../../../src/app/error.tsx', import.meta.url), 'utf8');
    expect(root).toContain("'use client'");
    const last = readFileSync(new URL('../../../src/app/global-error.tsx', import.meta.url), 'utf8');
    for (const part of ['<html', '<body', 'fontClassNames', 'globals.css', 'NextIntlClientProvider'])
      expect(last, part).toContain(part);
  });
});
