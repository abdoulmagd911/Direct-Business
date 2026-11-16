/**
 * Landing 31: a quiet partner says so on its row — the word Quiet with its icon (the card's moon), after Stale when it
 * is both — in the narrow list and in the table alike; with Quiet on, its card is on and the filter can be cleared
 * like any other. The flag itself comes from the list read (QUIET-01). Made-up rows only.
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
// a place 500 px wide: under a table's width, so the rows are drawn as the cards of one list (and so in a test)
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
            ? { all: answer.total, active: answer.rows.length, prospects: 0, stale: 1, quiet: 1 }
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

const QUIET = /<span[^>]*data-flag="quiet"[^>]*>.*?<\/span>/;

describe('a quiet row says so on the list', () => {
  const answer = { total: 2, rows: [row(1, { flags: ['stale', 'quiet'] }), row(2)] };
  it('in a word with its icon, after Stale, on the quiet row only', () => {
    const html = draw({ answer });
    const flag = html.match(QUIET)?.[0] ?? '';
    expect(flag).toContain('Quiet');
    expect(flag, 'an icon beside the word, never colour alone').toContain('<svg');
    expect(html.match(/data-flag="quiet"/g), 'only the quiet row').toHaveLength(1);
    expect(html.indexOf('data-flag="stale"')).toBeLessThan(html.indexOf('data-flag="quiet"'));
    expect(html.match(/<span[^>]*data-flag="stale"[^>]*>.*?<\/span>/)?.[0], 'Stale keeps its own word').toContain(
      'Stale',
    );
  });
  it('in Arabic too', () => {
    expect(draw({ answer, locale: 'ar' }).match(QUIET)?.[0]).toContain('هادئة');
  });
  it('with Quiet on: its card is on, and the filter can be cleared like any other', () => {
    const html = draw({ answer, filters: { quiet: true } });
    expect(html).toMatch(/aria-current="true"[^>]*data-kpi="quiet"/);
    expect(html).toContain('data-partners-clear');
    expect(draw({ answer }), 'no filter, nothing to clear').not.toContain('data-partners-clear');
  });
});
