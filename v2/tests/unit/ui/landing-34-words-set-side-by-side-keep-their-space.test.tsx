/**
 * Landing 34, item 15 (the 19 Nov test round, on a phone): "Provisional4,200·3 units", "0 comments·0 files", a tab's
 * name and its count with nothing between them. ONE cause: words that are children of a flex box. A flex box drops the
 * white space between its children and at the edges of each, so the `{' '}` and the " · " the code wrote never
 * reached the screen — and on a phone the tap-target rule (globals.css) turned every plain link into a flex box, which
 * is why it showed there and nowhere else. The shared parts now keep such words in one run of text, and the phone
 * rule no longer makes a flex box of a link that holds more than plain words.
 * Sabotage: tests/sabotage/landing-34-shell.mjs.
 */
import { readFileSync } from 'node:fs';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import ar from '../../../messages/ar.json';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/ui/use-scroll-more', () => ({ useScrollMore: () => ({}) }));

const { Tabs } = await import('../../../src/ui/Tabs');
const { RecordHeaderCounts } = await import('../../../src/ui/record/Comments');

/** What a screen reader, a copy or a test reads: the text of the markup, exactly — no space is added between tags. */
const text = (html: string) => html.replace(/<[^>]+>/g, '');
const draw = (node: React.ReactNode, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );

describe('a tab’s name and its count', () => {
  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'items', label: 'Action items', count: 0 },
    { value: 'discussion', label: 'Discussion', count: 12 },
  ];
  it('read "Action items 0", with a real space, on link tabs', () => {
    const html = draw(
      <Tabs label="Sections" value="overview" tabs={tabs.map((t) => ({ ...t, href: `/tasks/X?tab=${t.value}` }))} />,
    );
    expect(text(html)).toBe('OverviewAction items 0Discussion 12');
    // the name and the count are one run of words inside the tab, not two flex children of it
    expect(html).toMatch(/<span data-tab-face="true">Action items <span[^>]*data-tab-count="true">0<\/span><\/span>/);
  });
  it('and on button tabs', () => {
    const html = draw(<Tabs label="Sections" value="overview" tabs={tabs} onValueChange={() => {}} />);
    expect(text(html)).toBe('OverviewAction items 0Discussion 12');
  });
  it('a tab with no count is its name alone', () => {
    const html = draw(<Tabs label="Sections" value="overview" tabs={[tabs[0]!]} onValueChange={() => {}} />);
    expect(html).not.toContain('data-tab-face');
    expect(text(html)).toBe('Overview');
  });
});

describe('a record header’s two counts', () => {
  it('read "0 comments · 0 files" in English and keep the spaces round the dot in Arabic', () => {
    const html = draw(
      <RecordHeaderCounts comments={0} files={0} href={(f) => `/tasks/X?tab=discussion&filter=${f}`} />,
    );
    expect(text(html)).toBe('0 comments · 0 files');
    expect(html, 'words in a line, not flex children').not.toMatch(/<p class="[^"]*\bflex\b/);
    const arabic = text(draw(<RecordHeaderCounts comments={2} files={3} href={(f) => `/tasks/X?filter=${f}`} />, 'ar'));
    expect(arabic).toMatch(/\S · \S/);
  });
  it('one count alone has no dot', () => {
    const html = draw(<RecordHeaderCounts comments={4} files={null} href={() => '/tasks/X'} />);
    expect(text(html)).toBe('4 comments');
  });
});

describe('the phone’s tap-target rule (globals.css)', () => {
  const css = readFileSync('src/ui/globals.css', 'utf8').replace(/\s+/g, ' ');
  it('still makes a plain link a 44 px flex box', () => {
    expect(css).toContain(
      ':where(a[href]:not([role])):not(p a, [data-inline-link], [data-inline-link] a) { display: inline-flex; align-items: center;',
    );
  });
  it('makes a link that holds more than plain words an inline block instead, so its spaces stay', () => {
    const rule =
      ':where(a[href]:not([role]):has(> :not(svg, img))):not(p a, [data-inline-link], [data-inline-link] a) { display: inline-block; align-content: center; }';
    expect(css).toContain(rule);
    // it comes after the flex rule, so at the same weight it is the one that holds
    expect(css.indexOf(rule)).toBeGreaterThan(css.indexOf('display: inline-flex; align-items: center;'));
  });
});
