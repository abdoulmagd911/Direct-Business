/**
 * Landing 31: the partners list's states in the new look. A list with rows carries the four cards; a side with no
 * organisation yet says so with its one action (and no cards of four zeros); a filter that finds nothing keeps the
 * cards — so the card that is on can be pressed off — and offers Clear all; a list that could not be read says which
 * read failed with Try again, and draws no figures. Made-up rows only.
 * Sabotage: tests/sabotage/landing-31-partners-list.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import ar from '../../../messages/ar.json';
import { emptyFilters, type ListFilters } from '../../../src/modules/partners/list/filters';
import type { PartnerRow, PartnersAnswer } from '../../../src/modules/partners/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
const nothing = () => null;
vi.mock('@/ui/SavedViewsBar', () => ({ SavedViewsBar: nothing }));
vi.mock('@/ui/BulkBar', () => ({ BulkBar: nothing }));
vi.mock('@/modules/partners/screens/NewPartnerDialog', () => ({ NewPartnerDialog: nothing }));
vi.mock('@/modules/partners/screens/PartnerHover', () => ({
  PartnerHover: ({ children }: { children: unknown }) => children,
}));

const { PartnersList } = await import('../../../src/modules/partners/screens/PartnersList');

const row = (n: number, patch: Partial<PartnerRow> = {}): PartnerRow => ({
  id: `made-up-${n}`,
  number: `DK-P-000${n}`,
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
const me = (level: 'full' | 'view') =>
  ({ person: { id: 'made-up-person' }, levels: { clients: level }, capabilities: [] }) as never;

function draw({
  answer,
  failed = false,
  filters = {},
  level = 'full',
  locale = 'en',
}: {
  answer: PartnersAnswer | null;
  failed?: boolean;
  filters?: Partial<ListFilters>;
  level?: 'full' | 'view';
  locale?: 'en' | 'ar';
}) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar}>
      <PartnersList
        me={me(level)}
        side="client"
        title="Partners"
        filters={{ ...emptyFilters(), ...filters }}
        answer={answer}
        failed={failed}
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

describe('the partners list has every state in the new look', () => {
  it('a list with rows carries the four cards and the phone’s chips over it', () => {
    const html = draw({ answer: { total: 2, rows: [row(1), row(2)] } });
    expect(html).toContain('data-partner-kpis');
    expect(html.match(/data-kpi="/g)).toHaveLength(4);
    expect(html).toContain('data-partner-kpi-chips');
    expect(html, 'the cards are not drawn on a phone, the chips only there').toMatch(
      /<ul class="[^"]*max-sm:hidden[^"]*"[^>]*data-partner-kpis/,
    );
    expect(html).toMatch(/<nav class="[^"]*sm:hidden[^"]*"[^>]*data-partner-kpi-chips/);
  });

  it('a side with no organisation yet says so with its one action, and no cards of four zeros', () => {
    const html = draw({ answer: { total: 0, rows: [] } });
    expect(html).toContain('data-state="empty"');
    expect(html).toContain('No partners yet.');
    expect(html).toContain('data-partner-new-empty');
    expect(html).not.toContain('data-partner-kpis');
    expect(html).not.toContain('data-partner-kpi-chips');
  });

  it('someone who may only view is not offered New there', () => {
    const html = draw({ answer: { total: 0, rows: [] }, level: 'view' });
    expect(html).toContain('No partners yet.');
    expect(html).not.toContain('data-partner-new-empty');
  });

  it('a filter that finds nothing keeps the cards, so the one that is on can be pressed off, and offers Clear all', () => {
    const html = draw({ answer: { total: 0, rows: [] }, filters: { stale: true } });
    expect(html).toContain('No organisations match');
    expect(html).not.toContain('No partners yet.');
    expect(html).toContain('data-partners-clear-empty');
    expect(html).not.toContain('data-partner-new-empty');
    expect(html).toMatch(/aria-current="true"[^>]*data-kpi="stale"/);
  });

  it('a list that could not be read says so with Try again, and draws no figures', () => {
    const html = draw({ answer: null, failed: true });
    expect(html).toContain('data-state="failed"');
    expect(html).toContain('Organisations could not load.');
    expect(html).toContain('Try again');
    expect(html).not.toContain('data-partner-kpis');
    expect(html).not.toContain('data-partners-total');
  });

  it('says the same in Arabic', () => {
    expect(draw({ answer: { total: 0, rows: [] }, locale: 'ar' })).toContain('لا يوجد شركاء بعد.');
    expect(draw({ answer: null, failed: true, locale: 'ar' })).toContain('تعذّر تحميل الجهات.');
  });
});
