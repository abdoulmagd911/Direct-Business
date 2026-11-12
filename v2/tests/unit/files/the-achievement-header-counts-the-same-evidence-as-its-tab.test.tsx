/**
 * F-B2-03: the achievement header counts the same evidence its Evidence tab counts — files plus
 * references — so "2 files" in the header no longer sits beside "(3)" on the tab. The header's number
 * lands on the Evidence tab; a partner's header still counts files. Made-up values.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import { RecordHeaderCounts } from '../../../src/ui/record/Comments';

const draw = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      {node}
    </NextIntlClientProvider>,
  );

const href = (f: 'all' | 'files') => `/x?tab=discussion${f === 'files' ? '&filter=files' : ''}`;

describe('the achievement header counts the same evidence as its tab (F-B2-03)', () => {
  it('counts files plus references, and lands on the Evidence tab', () => {
    const html = draw(
      <RecordHeaderCounts
        comments={1}
        evidence={{ count: 3, href: '/kpis/achievements/a-1?tab=evidence' }}
        href={href}
      />,
    );
    expect(html).toContain('3 evidence items');
    expect(html).toContain('href="/kpis/achievements/a-1?tab=evidence"');
    expect(html).not.toContain('files');
  });
  it('says one evidence item in the singular', () => {
    const html = draw(
      <RecordHeaderCounts comments={null} evidence={{ count: 1, href: '/x?tab=evidence' }} href={href} />,
    );
    expect(html).toContain('1 evidence item');
    expect(html).not.toContain('1 evidence items');
  });
  it('leaves the count out when the files read failed, never zero', () => {
    const html = draw(
      <RecordHeaderCounts comments={2} evidence={{ count: null, href: '/x?tab=evidence' }} href={href} />,
    );
    expect(html).toContain('2 comments');
    expect(html).not.toContain('evidence');
  });
  it('a partner header still counts files, landing on the Files filter', () => {
    const html = draw(<RecordHeaderCounts comments={1} files={2} href={href} />);
    expect(html).toContain('2 files');
    expect(html).toContain('href="/x?tab=discussion&amp;filter=files"');
    expect(html).not.toContain('evidence');
  });
  it('renders nothing when both reads failed', () => {
    expect(draw(<RecordHeaderCounts comments={null} files={null} href={href} />)).toBe('');
  });
});
