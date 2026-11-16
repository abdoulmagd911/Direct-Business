/**
 * Landing 31: the four cards over the partners list — Active · Prospects · Stale · Quiet. A card is one of the list's
 * own filters written into the address: pressing it filters, the pressed card says so, pressing it again clears it,
 * the search and the other filters stay, and the address reads back to the same filters (Back and a shared link
 * work). The figures are the ones the page counted; a figure that is not known is "—", never 0.
 * Sabotage: tests/sabotage/landing-31-partners-list.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import {
  addressOf,
  emptyFilters,
  filtersOf,
  readFilters,
  type ListFilters,
} from '../../../src/modules/partners/list/filters';
import { KpiCards, PhoneChips } from '../../../src/modules/partners/list/KpiCards';
import {
  countsFromRows,
  countsOf,
  kpiOf,
  pressKpi,
  withCounts,
  type KpiCounts,
} from '../../../src/modules/partners/list/kpi';

const f = (patch: Partial<ListFilters> = {}): ListFilters => ({ ...emptyFilters(), ...patch });
const COUNTS: KpiCounts = { all: 6, active: 5, prospects: 1, stale: 2, quiet: 3 };

/** The filters an address reads back to, as the page reads them. */
const read = (address: string): ListFilters =>
  filtersOf(Object.fromEntries(new URL(address, 'http://made-up.test').searchParams));

const draw = (filters: ListFilters, counts: KpiCounts = COUNTS, locale: 'en' | 'ar' = 'en') => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'en' ? en : ar}>
      <KpiCards base="/partners" side="client" filters={filters} counts={counts} />
      <PhoneChips base="/partners" filters={filters} counts={counts} />
    </NextIntlClientProvider>,
  );
  const tag = (attr: string) => html.match(new RegExp(`<(a|li)\\b[^>]*${attr}[^>]*>`))?.[0] ?? '';
  const href = (attr: string) => (tag(attr).match(/href="([^"]*)"/)?.[1] ?? '').replace(/&amp;/g, '&');
  /** A card's own markup: from its hook to the end of its list item. */
  const card = (k: string) => html.slice(html.indexOf(`data-kpi="${k}"`)).split('</li>')[0]!;
  return { html, tag, href, card };
};

describe('pressing a card writes its filter into the address', () => {
  it('each card is one of the list’s own filters', () => {
    expect(addressOf('/partners', pressKpi(f(), 'active'))).toBe('/partners?status=active');
    expect(addressOf('/partners', pressKpi(f(), 'prospects'))).toBe('/partners?status=prospect');
    expect(addressOf('/partners', pressKpi(f(), 'stale'))).toBe('/partners?stale=1');
    expect(addressOf('/partners', pressKpi(f(), 'quiet'))).toBe('/partners?quiet=1');
  });
  it('Quiet is asked of the database as Stale is', () => {
    expect(readFilters('client', pressKpi(f({ q: 'najd' }), 'quiet'))).toEqual({
      side: 'client',
      q: 'najd',
      quiet: true,
    });
    expect(readFilters('client', f({ stale: true, quiet: true }))).toEqual({
      side: 'client',
      stale: true,
      quiet: true,
    });
    expect(readFilters('client', f())).toEqual({ side: 'client' });
  });
  it('the search and the other filters stay; only the cards’ own filter changes', () => {
    const before = f({ q: 'najd', types: ['corporate'], owners: ['made-up-owner'], key_partner: true });
    const after = pressKpi(before, 'stale');
    expect(after).toEqual({ ...before, stale: true });
    expect(addressOf('/partners', after)).toBe('/partners?q=najd&type=corporate&owner=made-up-owner&key=1&stale=1');
  });
  it('one card at a time: a second card replaces the first', () => {
    const after = pressKpi(pressKpi(f({ q: 'x' }), 'active'), 'stale');
    expect(after.statuses).toEqual([]);
    expect(after.stale).toBe(true);
    expect(pressKpi(after, 'prospects')).toMatchObject({ statuses: ['prospect'], stale: false, q: 'x' });
    const quiet = pressKpi(after, 'quiet');
    expect(quiet).toMatchObject({ statuses: [], stale: false, quiet: true, q: 'x' });
    expect(pressKpi(quiet, 'stale')).toMatchObject({ stale: true, quiet: false });
    expect(pressKpi(quiet, 'active')).toMatchObject({ statuses: ['active'], quiet: false });
  });
  it('pressing the card that is on clears it, and leaves the rest', () => {
    const on = f({ q: 'najd', statuses: ['active'] });
    expect(pressKpi(on, 'active')).toEqual(f({ q: 'najd' }));
    expect(pressKpi(f({ stale: true }), 'stale')).toEqual(f());
    expect(pressKpi(f({ q: 'najd', quiet: true }), 'quiet')).toEqual(f({ q: 'najd' }));
  });
  it('a saved view’s name goes when a card changes its filters', () => {
    expect(pressKpi(f({ view: 'made-up-view' }), 'active').view).toBe('');
  });
});

describe('the card that is on is read from the address', () => {
  it('knows which card an address holds', () => {
    expect(kpiOf(f())).toBeNull();
    expect(kpiOf(f({ statuses: ['active'] }))).toBe('active');
    expect(kpiOf(f({ statuses: ['prospect'] }))).toBe('prospects');
    expect(kpiOf(f({ stale: true }))).toBe('stale');
    expect(kpiOf(f({ quiet: true }))).toBe('quiet');
  });
  it('a status filter that is not one card’s own lights no card', () => {
    expect(kpiOf(f({ statuses: ['active', 'at_risk'] }))).toBeNull();
    expect(kpiOf(f({ statuses: ['lost'] }))).toBeNull();
    expect(kpiOf(f({ statuses: ['active'], stale: true }))).toBeNull();
    expect(kpiOf(f({ statuses: ['active'], quiet: true }))).toBeNull();
    expect(kpiOf(f({ stale: true, quiet: true })), 'More filters can ask for both: neither card alone').toBeNull();
  });
  it('the address round-trips: what a press writes is what the page reads back', () => {
    for (const k of ['active', 'prospects', 'stale', 'quiet'] as const) {
      const pressed = pressKpi(f({ q: 'waha foods', types: ['corporate', 'agencies'], archived: true }), k);
      const back = read(addressOf('/partners', pressed));
      expect(back, k).toEqual(pressed);
      expect(kpiOf(back), k).toBe(k);
      // and Back: the address before the press reads to the filters before it
      expect(read(addressOf('/partners', pressKpi(back, k)))).toEqual(
        f({ q: 'waha foods', types: ['corporate', 'agencies'], archived: true }),
      );
    }
  });
});

describe('the cards as drawn', () => {
  it('shows the four cards with the counted figures', () => {
    const { card } = draw(f());
    expect(card('active')).toContain('Active');
    expect(card('active')).toMatch(/>5</);
    expect(card('active')).toContain('Partners we work with now');
    expect(card('prospects')).toMatch(/>1</);
    expect(card('prospects')).toContain('Not signed yet');
    expect(card('stale')).toMatch(/>2</);
    expect(card('quiet')).toContain('Quiet');
    expect(card('quiet')).toMatch(/>3</);
    expect(card('quiet')).toContain('Too long without a paid invoice');
    expect(card('quiet')).not.toContain('not counted yet');
  });
  it('each card links to the list with its filter, carrying the search along', () => {
    const { href } = draw(f({ q: 'najd' }));
    expect(href('data-kpi="active"')).toBe('/partners?q=najd&status=active');
    expect(href('data-kpi="prospects"')).toBe('/partners?q=najd&status=prospect');
    expect(href('data-kpi="stale"')).toBe('/partners?q=najd&stale=1');
    expect(href('data-kpi="quiet"')).toBe('/partners?q=najd&quiet=1');
  });
  it('the card that is on says so, and its link clears it', () => {
    const { tag, href, card } = draw(f({ q: 'najd', statuses: ['active'] }));
    expect(tag('data-kpi="active"')).toContain('aria-current="true"');
    expect(tag('data-kpi="active"')).toContain('data-kpi-on');
    expect(card('active'), 'a tick, not colour alone').toContain('data-kpi-tick');
    expect(href('data-kpi="active"')).toBe('/partners?q=najd');
    for (const k of ['prospects', 'stale', 'quiet']) {
      expect(tag(`data-kpi="${k}"`), k).not.toContain('aria-current');
      expect(card(k), k).not.toContain('data-kpi-tick');
    }
  });
  it('no card is on when the address holds none', () => {
    const { html } = draw(f({ q: 'najd' }));
    expect(html).not.toContain('data-kpi-on');
    expect(html).not.toContain('data-kpi-tick');
  });
  it('a figure that is not known is a dash, never 0', () => {
    const { card } = draw(f(), { all: 6, active: null, prospects: 0, stale: 2, quiet: 0 });
    expect(card('active')).toContain('—');
    expect(card('active')).not.toMatch(/>0</);
    expect(card('prospects'), 'a true zero is drawn as 0').toMatch(/>0</);
  });
  it('Quiet is a card like the others: its figure, a link, and a tick when it is on', () => {
    const off = draw(f({ q: 'najd' }));
    expect(off.tag('data-kpi="quiet"').startsWith('<a')).toBe(true);
    expect(off.card('quiet')).toMatch(/>3</);
    expect(off.card('quiet'), 'a true zero is a figure too').not.toContain('—');
    const on = draw(f({ q: 'najd', quiet: true }));
    expect(on.tag('data-kpi="quiet"')).toContain('aria-current="true"');
    expect(on.card('quiet')).toContain('data-kpi-tick');
    expect(on.href('data-kpi="quiet"'), 'pressing it again clears it').toBe('/partners?q=najd');
    expect(on.tag('data-kpi="stale"')).not.toContain('aria-current');
    expect(draw(f(), { ...COUNTS, quiet: 0 }).card('quiet')).toMatch(/>0</);
  });
  it('Quiet that is not known (below View on Finance): a dash, never 0, and nothing to press', () => {
    const { tag, card } = draw(f(), { ...COUNTS, quiet: null });
    expect(tag('data-kpi="quiet"').startsWith('<li')).toBe(true);
    expect(card('quiet')).not.toContain('href=');
    expect(card('quiet')).toContain('—');
    expect(card('quiet')).not.toMatch(/>0</);
    // an address that already carries it can still be cleared from the card
    const on = draw(f({ quiet: true }), { ...COUNTS, quiet: null });
    expect(on.tag('data-kpi="quiet"').startsWith('<a')).toBe(true);
    expect(on.href('data-kpi="quiet"')).toBe('/partners');
  });
  it('reads in Arabic with Latin figures', () => {
    const { card } = draw(f({ stale: true }), COUNTS, 'ar');
    expect(card('active')).toContain('نشط');
    expect(card('active')).toMatch(/>5</);
    expect(card('prospects')).toContain('محتملون');
    expect(card('stale')).toContain('راكد');
    expect(card('quiet')).toContain('هادئ');
  });
});

describe('the phone’s three chips are the same filters', () => {
  it('All · Prospects · Needs attention, each with its count', () => {
    const { html, href } = draw(f({ q: 'najd' }));
    const chips = html.slice(html.indexOf('data-partner-kpi-chips'));
    expect(chips).toMatch(/All<span[^>]*>6</);
    expect(chips).toMatch(/Prospects<span[^>]*>1</);
    expect(chips).toMatch(/Needs attention<span[^>]*>2</);
    expect(href('data-kpi-chip="prospects"')).toBe('/partners?q=najd&status=prospect');
    expect(href('data-kpi-chip="attention"')).toBe('/partners?q=najd&stale=1');
  });
  it('All is on with no card, and clears the card that is on', () => {
    expect(draw(f()).tag('data-kpi-chip="all"')).toContain('aria-current="true"');
    const on = draw(f({ q: 'najd', stale: true }));
    expect(on.tag('data-kpi-chip="all"')).not.toContain('aria-current');
    expect(on.tag('data-kpi-chip="attention"')).toContain('aria-current="true"');
    expect(on.href('data-kpi-chip="all"')).toBe('/partners?q=najd');
    const quiet = draw(f({ q: 'najd', quiet: true }));
    expect(quiet.tag('data-kpi-chip="all"'), 'Quiet on is not All').not.toContain('aria-current');
    expect(quiet.href('data-kpi-chip="all"')).toBe('/partners?q=najd');
  });
  it('a chip is a finger tall', () => {
    expect(draw(f()).tag('data-kpi-chip="all"')).toContain('h-11');
  });
});

describe('the figures are counted, not made up', () => {
  const rows = [
    { status: 'active' as const, flags: [] },
    { status: 'active' as const, flags: ['stale'] },
    { status: 'prospect' as const, flags: ['stale', 'contract_expiring'] },
    { status: 'at_risk' as const, flags: ['contract_expiring'] },
    { status: null, flags: [] },
  ];
  it('from the rows of a whole list, when the read gave no counts — Quiet is then not known', () => {
    expect(countsFromRows(rows, 5)).toEqual({ all: 5, active: 2, prospects: 1, stale: 2, quiet: null });
    expect(countsFromRows([], 0)).toEqual({ all: 0, active: 0, prospects: 0, stale: 0, quiet: null });
  });
  it('by the list read itself: asked for with the list’s own filters, and read off its answer', () => {
    const read = { side: 'client', q: 'najd', types: ['corporate'], statuses: ['active'], stale: true };
    expect(withCounts(read)).toEqual({ ...read, counts: true });
    expect(countsOf({ counts: { all: 40, active: 12, prospect: 3, stale: 7, quiet: 5 } })).toEqual({
      all: 40,
      active: 12,
      prospects: 3,
      stale: 7,
      quiet: 5,
    });
  });
  it('a figure the read did not give is not known, never 0', () => {
    expect(countsOf({ counts: { all: 4, active: 0, prospect: 1, stale: 0, quiet: null } })).toEqual({
      all: 4,
      active: 0,
      prospects: 1,
      stale: 0,
      quiet: null,
    });
    expect(countsOf({}), 'an answer with no counts at all').toBeNull();
    expect(countsOf(null)).toBeNull();
  });
});
