import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Landing 31: the figures on the partners list's four cards are real, and they come with the list read itself. The
 * one partners read is asked for `counts`; the database answers {all, active, prospect, stale, quiet} over the search
 * and the other filters, without the cards' own choice (QUIET-02) — so a render is one partners read whatever card is
 * on (FIX-45), and pressing a card does not change the other cards' figures. Quiet is the daily alert's rule
 * (QUIET-01); below View on Finance it is "not known", never 0. An answer with no counts (a database not yet
 * migrated) falls back to its rows only when they are the whole, unfiltered list. Made-up answers only.
 * Sabotage: tests/sabotage/landing-31-partners-list.mjs.
 */
type Call = { fn: string; args: { p_filters?: Record<string, unknown>; p_limit?: number } };
const calls: Call[] = [];
let partners: (args: Call['args']) => unknown = () => ({ total: 0, rows: [] });
vi.mock('@/core/db/server-rpc', () => ({
  serverRpc: vi.fn(async (fn: string, args: Call['args']) => {
    calls.push({ fn, args });
    if (fn === 'org') return { people: [], departments: [] };
    if (fn === 'partners') return partners(args);
    return [];
  }),
}));
const me = {
  person: { id: 'made-up-person' },
  levels: { clients: 'full', suppliers_partners: 'view' },
  capabilities: [],
};
vi.mock('server-only', () => ({}));
vi.mock('@/core/auth/require-me', () => ({ requireMe: vi.fn(async () => me) }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (k: string) => k }));
const nothing = () => null;
vi.mock('@/modules/partners/screens/PartnersList', () => ({ PartnersList: nothing }));
vi.mock('@/modules/partners/list/SideTabs', () => ({ SideTabs: nothing }));
vi.mock('@/ui/DataState', () => ({ DataState: nothing }));
vi.mock('@/ui/PageHeader', () => ({ PageHeader: nothing }));
vi.mock('@/ui/shell/Page', () => ({ Page: nothing }));

const { PartnersListPage } = await import('@/modules/partners/screens/list-page');

const row = (status: string | null, flags: string[] = []) => ({ id: `made-up-${Math.random()}`, status, flags });
const ROWS = [row('active'), row('active', ['stale']), row('prospect'), row('at_risk', ['stale', 'quiet']), row(null)];
const COUNTS = { all: 40, active: 12, prospect: 3, stale: 7, quiet: 5 };

/** What the page hands the list: its props, read off the element the page returns. */
async function open(q: Record<string, string>) {
  const el = (await PartnersListPage({ side: 'client', searchParams: Promise.resolve(q) })) as {
    props: { children: { props: { counts: unknown; answer: { total: number } | null; failed: boolean } } };
  };
  return el.props.children.props;
}
const partnerReads = () => calls.filter((c) => c.fn === 'partners');

beforeEach(() => {
  calls.length = 0;
  partners = () => ({ total: ROWS.length, rows: ROWS, counts: COUNTS });
});

describe('the cards’ figures come from the list read', () => {
  it('as the list opens: the one partners read is asked for its counts, and they are the figures', async () => {
    const props = await open({});
    expect(props.counts).toEqual({ all: 40, active: 12, prospects: 3, stale: 7, quiet: 5 });
    expect(partnerReads()).toHaveLength(1);
    expect(partnerReads()[0]!.args.p_filters).toEqual({ side: 'client', counts: true });
  });

  it('a search rides along in that one read', async () => {
    const props = await open({ q: 'najd', type: 'corporate' });
    expect(props.counts).toEqual({ all: 40, active: 12, prospects: 3, stale: 7, quiet: 5 });
    expect(partnerReads()).toHaveLength(1);
    expect(partnerReads()[0]!.args.p_filters).toEqual({
      side: 'client',
      q: 'najd',
      types: ['corporate'],
      counts: true,
    });
  });

  it('with a card on: still one partners read, and the figures are the read’s, not the card’s rows', async () => {
    partners = () => ({ total: 2, rows: [row('active'), row('active', ['stale'])], counts: COUNTS });
    const props = await open({ q: 'najd', status: 'active' });
    expect(props.counts).toEqual({ all: 40, active: 12, prospects: 3, stale: 7, quiet: 5 });
    expect(props.answer?.total, 'the list itself is the pressed card’s rows').toBe(2);
    expect(partnerReads(), 'no count reads beside the list read').toHaveLength(1);
    expect(partnerReads()[0]!.args.p_filters).toEqual({
      side: 'client',
      q: 'najd',
      statuses: ['active'],
      counts: true,
    });
  });

  it('the Stale and the Quiet cards are filtered by the database, in the same one read', async () => {
    await open({ stale: '1' });
    expect(partnerReads().map((c) => c.args.p_filters)).toEqual([{ side: 'client', stale: true, counts: true }]);
    calls.length = 0;
    const props = await open({ quiet: '1' });
    expect(partnerReads().map((c) => c.args.p_filters)).toEqual([{ side: 'client', quiet: true, counts: true }]);
    expect(props.counts).toMatchObject({ quiet: 5, stale: 7 });
  });

  it('past the row cap the figures are still the whole list’s, not the rows on screen', async () => {
    partners = () => ({
      total: 612,
      rows: ROWS,
      counts: { all: 612, active: 400, prospect: 150, stale: 30, quiet: 44 },
    });
    const props = await open({});
    expect(props.counts, 'not the 2 / 1 / 2 / 1 of the five rows on screen').toEqual({
      all: 612,
      active: 400,
      prospects: 150,
      stale: 30,
      quiet: 44,
    });
    expect(partnerReads()).toHaveLength(1);
  });

  it('Quiet the read does not tell of is not known — never 0 — and the list still shows', async () => {
    partners = () => ({ total: 1, rows: [row('prospect')], counts: { ...COUNTS, quiet: null } });
    const props = await open({ status: 'prospect' });
    expect(props.counts).toEqual({ all: 40, active: 12, prospects: 3, stale: 7, quiet: null });
    expect(props.failed).toBe(false);
    expect(props.answer?.total).toBe(1);
  });

  it('an answer with no counts falls back to its rows only when they are the whole, unfiltered list', async () => {
    partners = () => ({ total: ROWS.length, rows: ROWS });
    expect((await open({})).counts).toEqual({ all: 5, active: 2, prospects: 1, stale: 2, quiet: null });
    expect((await open({ q: 'najd' })).counts, 'a search is still the whole list of what it found').toMatchObject({
      all: 5,
      active: 2,
    });
    const none = { all: null, active: null, prospects: null, stale: null, quiet: null };
    expect((await open({ status: 'active' })).counts, 'a card’s rows are not the list: not known').toEqual(none);
    partners = () => ({ total: 612, rows: ROWS });
    expect((await open({})).counts, 'nor are the first rows of a capped list').toEqual(none);
    expect(partnerReads(), 'and never a second read to find out').toHaveLength(4);
  });

  it('a list that could not be read has no figures at all', async () => {
    partners = () => {
      throw new Error('made-up failure');
    };
    const props = await open({});
    expect(props.failed).toBe(true);
    expect(props.counts).toEqual({ all: null, active: null, prospects: null, stale: null, quiet: null });
  });
});
