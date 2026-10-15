/**
 * W-daily 14: a reminder for a later day on My day says Done, as the alert and the Today block do — not Remove — and its
 * words wrap on a phone instead of being cut off. The date beside it is written the one way (`18 Oct 2026, 09:00`).
 * Names are made up. Sabotage: tests/sabotage/daily-use.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { MyDay } from '../../../src/modules/my-day/screens/MyDay';
import type { MyDayAnswer } from '../../../src/modules/my-day/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }), usePathname: () => '/my-day' }));

const LONG =
  'Ask the made-up Dune Foods buyer about the renewal terms and the new delivery schedule for the autumn season';
const answer = {
  day: '2026-10-14',
  notes: [],
  reminders: [{ id: 'p1', note_id: 'n1', text: LONG, remind_at: '2026-10-18T09:00:00+03:00' }],
  since: [],
  more: false,
} as unknown as MyDayAnswer;
const draw = (locale: 'en' | 'ar') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
      <MyDay
        data={{
          title: 'Wednesday',
          scope: 'me',
          answer,
          all: false,
          people: [],
          statuses: [],
          due: { due: [], next_at: null },
        }}
      />
    </NextIntlClientProvider>,
  );

describe('a reminder for a later day on My day', () => {
  const html = draw('en');
  const row = html.slice(html.indexOf('data-reminder="p1"'), html.indexOf('</li>', html.indexOf('data-reminder="p1"')));
  it('says Done, not Remove', () => {
    expect(row).toContain('data-reminder-done-later');
    expect(row).toContain('>Done<');
    expect(row).not.toContain('Remove');
    expect(html).not.toContain('data-reminder-remove');
  });
  it('wraps its words instead of cutting them off', () => {
    expect(row).toContain(LONG);
    expect(row).toMatch(/class="[^"]*break-words[^"]*"[^>]*>Ask the made-up/);
    expect(row).not.toMatch(/class="[^"]*truncate[^"]*"[^>]*>Ask the made-up/);
  });
  it('writes its date the one way', () => {
    expect(row).toContain('18 Oct 2026');
  });
  it('says the same in Arabic', () => {
    expect(draw('ar')).toContain('data-reminder-done-later');
  });
});
