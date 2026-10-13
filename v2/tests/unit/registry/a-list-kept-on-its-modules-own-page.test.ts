import { describe, expect, it } from 'vitest';
import { modules } from '../../../src/core/registry/index';
import { KEPT_ON_OWN_PAGE, snapshotOf } from '../../../src/core/registry/snapshot';
import { listsOf } from '../../../src/modules/settings/groups';

// V627: a setting list is edited on a Settings page (V97, V138), with one exception — a list its module keeps on the
// module's own page, so Full on that page edits it, still shown in its Settings group. The Finance lists of V613 and
// V622 are the two; the products stay admins' (QA-534). Sabotages: tests/sabotage/list-kept-on-own-page.mjs.
const finance = () => modules.find((m) => m.key === 'finance')!;
const withEntity = (key: string, change: Record<string, unknown>) =>
  modules.map((m) =>
    m.key !== 'finance' ? m : { ...m, entities: m.entities!.map((e) => (e.key === key ? { ...e, ...change } : e)) },
  );

describe("a list kept on its module's own page", () => {
  it('keeps the two Finance lists on the finance page, shown under Settings › Finance', () => {
    const kept = finance()
      .entities!.filter((e) => e.list && e.page === 'finance')
      .map((e) => e.key)
      .sort();
    expect(kept).toEqual(['channel', 'import_map']);
    expect(listsOf('settings.finance').map((l) => l.key)).toEqual(
      expect.arrayContaining([...kept, 'product', 'status_map']),
    );
  });

  it("refuses a list on any page but its module's own, or kept there without a Settings group", () => {
    expect(() => snapshotOf(withEntity('import_map', { page: 'partners' }))).toThrow(
      'entity "import_map": a setting list is edited on a settings page',
    );
    expect(() => snapshotOf(withEntity('import_map', { shownIn: undefined }))).toThrow(
      'entity "import_map": a setting list is edited on a settings page',
    );
    expect(() => snapshotOf(withEntity('invoice', { shownIn: 'settings.finance' }))).toThrow(
      'entity "invoice": only a list kept on its module\'s own page is shown in a Settings group',
    );
  });

  it('keeps only the lists V627 names there, not any other list of any module (QA-539)', () => {
    expect([...KEPT_ON_OWN_PAGE].sort()).toEqual(['finance.channel', 'finance.import_map']);
    expect(() => snapshotOf(withEntity('service', { page: 'finance', shownIn: 'settings.finance' }))).toThrow(
      'entity "service": a setting list is edited on a settings page',
    );
  });
});
