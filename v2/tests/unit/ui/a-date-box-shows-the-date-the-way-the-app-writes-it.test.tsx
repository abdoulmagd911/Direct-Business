/**
 * W-daily 13 and 12, drawn without a browser: a date box shows `14 Oct 2026` (with a time, `14 Oct 2026, 09:30`) while the
 * real date input under it keeps the value the form reads; and a row that scrolls sideways knows which edge still has
 * more. Made-up values. Sabotage: tests/sabotage/daily-use.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import ar from '../../../messages/ar.json';
import { Input } from '../../../src/ui/Input';
import { scrollMoreOf } from '../../../src/ui/use-scroll-more';

const draw = (node: React.ReactNode, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );

describe('a date box shows the date the way the app writes it', () => {
  it('shows 14 Oct 2026 and keeps the value and the type of the input under it', () => {
    const html = draw(<Input type="date" value="2026-10-14" onChange={() => undefined} name="due" />);
    expect(html).toMatch(/data-date-text[^>]*>14 Oct 2026</);
    expect(html).toContain('type="date"');
    expect(html).toContain('value="2026-10-14"');
    expect(html).toContain('name="due"');
  });
  it('shows a September date as Sep, never Sept', () => {
    expect(draw(<Input type="date" value="2026-09-03" onChange={() => undefined} />)).toMatch(/>3 Sep 2026</);
  });
  it('shows a date with a time the same way', () => {
    const html = draw(<Input type="datetime-local" value="2026-10-14T09:30" onChange={() => undefined} />);
    expect(html).toMatch(/data-date-text[^>]*>14 Oct 2026, 09:30</);
  });
  it('writes the day as it is, never padded: 4 Oct 2026, not 04 Oct 2026', () => {
    expect(draw(<Input type="date" value="2026-10-04" onChange={() => undefined} />)).toMatch(
      /data-date-text[^>]*>4 Oct 2026</,
    );
    expect(draw(<Input type="datetime-local" value="2026-10-04T09:05" onChange={() => undefined} />)).toMatch(
      /data-date-text[^>]*>4 Oct 2026, 09:05</,
    );
  });
  it('says how the date will be written while the box is empty: dd mmm yyyy in English (V653 (2))', () => {
    expect(draw(<Input type="date" value="" onChange={() => undefined} />)).toMatch(/data-date-text[^>]*>dd mmm yyyy</);
    expect(draw(<Input type="datetime-local" value="" onChange={() => undefined} />)).toMatch(
      /data-date-text[^>]*>dd mmm yyyy, hh:mm</,
    );
    expect(
      draw(<Input type="date" value="" placeholder="From" onChange={() => undefined} />),
      'a placeholder given wins',
    ).toMatch(/data-date-text[^>]*>From</);
  });
  it('keeps the dash for an empty time box, and in Arabic until its words are given; shows the Arabic month in Arabic', () => {
    expect(draw(<Input type="time" value="" onChange={() => undefined} />)).toMatch(/data-date-text[^>]*>—</);
    expect(
      draw(<Input type="date" value="" onChange={() => undefined} />, 'ar'),
      'Arabic: day month year, not a dash',
    ).toMatch(/data-date-text[^>]*>يوم شهر سنة</);
    expect(draw(<Input type="datetime-local" value="" onChange={() => undefined} />, 'ar')).toMatch(
      /data-date-text[^>]*>يوم شهر سنة، ساعة:دقيقة</,
    );
    expect(draw(<Input type="date" value="2026-10-14" onChange={() => undefined} />, 'ar')).toMatch(/>14 \S+ 2026</);
  });
  it('shows the real field, and hides the written date, while the field has keyboard focus', () => {
    const html = draw(<Input type="date" value="2026-10-14" onChange={() => undefined} />);
    expect(html).toContain('focus-visible:opacity-100');
    expect(html).toContain('peer-focus-visible:invisible');
  });
  it('writes the date beside the real field the app writes it, shown only while the field has keyboard focus', () => {
    const html = draw(<Input type="date" value="2026-10-21" onChange={() => undefined} />);
    expect(html).toMatch(/data-date-echo[^>]*><span dir="auto">21 Oct 2026</);
    expect(html, 'the chip itself keeps the box direction: only its words order themselves').not.toMatch(
      /<p[^>]*dir="auto"[^>]*data-date-echo/,
    );
    expect(html).toMatch(/data-date-echo[^>]*class="[^"]*hidden [^"]*peer-focus-visible:block"/);
    expect(draw(<Input type="date" value="" onChange={() => undefined} />)).toMatch(
      /data-date-echo[^>]*><span dir="auto">—</,
    );
  });
  it('leaves every other input as it was', () => {
    const html = draw(<Input type="text" value="x" onChange={() => undefined} />);
    expect(html).not.toContain('data-date-box');
  });
});

describe('a row that scrolls sideways says which edge has more', () => {
  const row = (scrollLeft: number) => ({ scrollLeft, scrollWidth: 600, clientWidth: 300 });
  it('more at the end at the start, both in the middle, more at the start at the end', () => {
    expect(scrollMoreOf(row(0))).toBe('end');
    expect(scrollMoreOf(row(150))).toBe('both');
    expect(scrollMoreOf(row(300))).toBe('start');
  });
  it('counts from the start in Arabic, where the scroll position is negative', () => {
    expect(scrollMoreOf(row(0))).toBe('end');
    expect(scrollMoreOf(row(-150))).toBe('both');
    expect(scrollMoreOf(row(-300))).toBe('start');
  });
  it('says nothing for a row that fits', () => {
    expect(scrollMoreOf({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 })).toBeUndefined();
  });
});
