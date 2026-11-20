/**
 * Landing 34 (test-round fixes), the partners list on screen:
 *  - item 25: every row carries its Actions button, always drawn — for a reader who may only view as well;
 *  - items 26/34: an organisation's name is read whole: it wraps, it is never cut with "…";
 *  - item 13: a row's status is drawn whatever view is on — the All view included;
 *  - item 7: the search box is a search field (Enter and the phone's Search key submit it);
 *  - items 2/3: a failed list says why with its reference and a Try again; a refusal is said as no access; a read
 *    beside the list that failed (the owners, the types) does not take the list down.
 * Made-up rows only. Sabotage: tests/sabotage/landing-34-partners.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import ar from '../../../messages/ar.json';
import { emptyFilters, type ListFilters } from '../../../src/modules/partners/list/filters';
import type { ReadFailure } from '../../../src/modules/partners/read-failure';
import type { PartnerRow, PartnersAnswer } from '../../../src/modules/partners/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
// 500 px: under a table's width, the rows are the cards of one list (and so drawn in a test); 0 is the full table
vi.mock('@/modules/partners/list/useElementWidth', () => ({ useElementWidth: () => [{ current: null }, WIDTH.px] }));
const WIDTH = vi.hoisted(() => ({ px: 500 }));
const nothing = () => null;
vi.mock('@/ui/SavedViewsBar', () => ({ SavedViewsBar: nothing }));
vi.mock('@/ui/BulkBar', () => ({ BulkBar: nothing }));
vi.mock('@/modules/partners/screens/NewPartnerDialog', () => ({ NewPartnerDialog: nothing }));
vi.mock('@/modules/partners/screens/PartnerHover', () => ({
  PartnerHover: ({ children }: { children: unknown }) => children,
}));

const { PartnersList } = await import('../../../src/modules/partners/screens/PartnersList');

const LONG = 'Made-up International Business Travel and Tourism Organisation of the North';
const row = (n: number, patch: Partial<PartnerRow> = {}): PartnerRow => ({
  id: `made-up-${n}`,
  number: `DK-P-99000${n}`,
  trade_name_en: `Made-up Org ${n}`,
  trade_name_ar: null,
  type: 'corporate',
  status: 'active',
  owner_id: null,
  sides: [],
  priority_id: null,
  key_partner: false,
  logo_file_id: null,
  last_activity_on: '2026-11-04',
  flags: [],
  archived: false,
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  ...patch,
});

function draw({
  answer,
  failed = false,
  failure = null,
  partial = false,
  filters = {},
  level = 'full',
  locale = 'en',
  width = 500,
}: {
  answer: PartnersAnswer | null;
  failed?: boolean;
  failure?: ReadFailure | null;
  partial?: boolean;
  filters?: Partial<ListFilters>;
  level?: 'full' | 'view';
  locale?: 'en' | 'ar';
  width?: number;
}) {
  WIDTH.px = width;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar}>
      <PartnersList
        me={{ person: { id: 'made-up-person' }, levels: { clients: level }, capabilities: [] } as never}
        side="client"
        title="Partners"
        filters={{ ...emptyFilters(), ...filters }}
        answer={answer}
        failed={failed}
        failure={failure}
        partial={partial}
        counts={
          answer
            ? { all: answer.total, active: answer.rows.length, prospects: 0, stale: 0, quiet: 0 }
            : { all: null, active: null, prospects: null, stale: null, quiet: null }
        }
        org={{ people: [], departments: [] } as never}
        types={[]}
        sideTypes={[]}
        tiers={[]}
        priorities={[]}
      />
    </NextIntlClientProvider>,
  );
}

const answer: PartnersAnswer = {
  total: 3,
  rows: [row(1, { trade_name_en: LONG }), row(2, { status: 'prospect' }), row(3, { archived: true, status: 'lost' })],
};

describe('every row has its Actions, always drawn', () => {
  it('one Actions button on each row, named for its organisation', () => {
    const html = draw({ answer });
    expect(html.match(/data-partner-actions="/g)).toHaveLength(3);
    for (const r of answer.rows) expect(html).toContain(`data-partner-actions="${r.id}"`);
    expect(html).toContain('aria-label="Actions · Made-up Org 2"');
  });
  it('a reader who may only view has it too (Open is theirs)', () => {
    expect(draw({ answer, level: 'view' }).match(/data-partner-actions="/g)).toHaveLength(3);
  });
  it('it is not hidden until hover', () => {
    const button = draw({ answer }).match(/<button[^>]*data-partner-actions="made-up-1"[^>]*>/)?.[0] ?? '';
    expect(button).not.toBe('');
    expect(button).not.toMatch(/opacity-0|invisible|group-hover|hidden/);
  });
  it('the table has its Actions column for every reader', () => {
    for (const level of ['full', 'view'] as const)
      expect(draw({ answer, level, width: 0 }), level).toMatch(/<th[^>]*><span class="sr-only">Actions<\/span><\/th>/);
  });
  it('in Arabic too', () => {
    expect(draw({ answer, locale: 'ar' })).toContain('aria-label="الإجراءات · Made-up Org 2"');
  });
});

describe('a name is read whole', () => {
  it('a long name is drawn in full and is not cut with an ellipsis', () => {
    const html = draw({ answer });
    const link = html.match(/<a[^>]*data-partner-link="made-up-1"[^>]*>.*?<\/a>/)?.[0] ?? '';
    expect(link).toContain(LONG);
    expect(link, 'no cut with "…"').not.toMatch(/truncate|line-clamp|text-ellipsis|whitespace-nowrap/);
    expect(link, 'the name wraps').toContain('break-words');
  });
});

describe('a status the read gave is drawn on every view', () => {
  it('on the All view', () => {
    const html = draw({ answer });
    const card = html.match(/<li[^>]*data-partner-card="made-up-2"[^>]*>.*?<\/li>/)?.[0] ?? '';
    expect(card).toContain('Prospect');
  });
  it('and on the archived view, where the row says Archived as well', () => {
    const html = draw({ answer, filters: { archived: true } });
    const card = html.match(/<li[^>]*data-partner-card="made-up-3"[^>]*>.*?<\/li>/)?.[0] ?? '';
    expect(card).toContain('Lost');
    expect(card).toContain('data-flag="archived"');
  });
});

describe('the search box is a search field', () => {
  it('Enter and the phone’s Search key submit it', () => {
    const input = draw({ answer }).match(/<input[^>]*data-partners-search[^>]*>/)?.[0] ?? '';
    expect(input).toContain('type="search"');
    expect(input).toContain('enterKeyHint="search"');
  });
  it('nothing says loading while nothing is', () => {
    const html = draw({ answer });
    expect(html).not.toContain('data-partners-pending');
    expect(html).not.toMatch(/data-partners-rows[^>]*aria-busy|aria-busy[^>]*data-partners-rows/);
  });
});

describe('a failed list says why', () => {
  it('a read stopped for time: the reason, its reference and Try again', () => {
    const html = draw({ answer: null, failed: true, failure: { kind: 'timeout', ref: 'Unavailable · 57014' } });
    expect(html).toContain('data-state="failed"');
    expect(html).toContain('Organisations could not load. It took too long and was stopped.');
    expect(html).toMatch(/data-failure-ref[^>]*>Unavailable · 57014</);
    expect(html).toContain('data-read-retry');
  });
  it('a refusal is said as no access, with no Try again', () => {
    const html = draw({
      answer: null,
      failed: true,
      failure: { kind: 'refused', ref: 'PermissionDenied · access.needs_level' },
    });
    expect(html).toContain('data-state="no-access"');
    expect(html).toContain('You do not have access to Partners');
    expect(html).not.toContain('data-read-retry');
    expect(html).not.toContain('data-state="failed"');
  });
  it('a read beside the list that failed does not take the list down', () => {
    const html = draw({ answer, partial: true });
    expect(html).toContain('data-partners-partial');
    expect(html).toContain('Owners and types did not load.');
    expect(html).toContain('data-partners-partial-retry');
    expect(html.match(/data-partner-card="/g), 'the rows are still drawn').toHaveLength(3);
    expect(draw({ answer })).not.toContain('data-partners-partial');
  });
  it('in Arabic too', () => {
    const html = draw({
      answer: null,
      failed: true,
      failure: { kind: 'unavailable', ref: 'Unavailable' },
      locale: 'ar',
    });
    expect(html).toContain('تعذّر تحميل الجهات. لم يستجب الخادم.');
  });
});
