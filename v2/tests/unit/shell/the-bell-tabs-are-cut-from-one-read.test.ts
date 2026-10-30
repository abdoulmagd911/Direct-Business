/**
 * The bell's tabs are cut from one read of everything, so every tab's number comes from the same rows as the badge
 * (the owner saw 14 and 15 with Mentions saying Nothing new). Sabotage: tests/sabotage/screens.mjs "mentions-tab-shows-everything".
 */
import { describe, expect, it } from 'vitest';
import { NOTIFICATION_TABS, tabHas } from '../../../src/core/notify/useNotifications';

const kinds = ['assigned', 'helper_added', 'mentioned', 'changed_by_other', 'followed_change'];

describe('the bell tabs', () => {
  it('show every kind under All, only mentions under Mentions, only assignments under Assigned', () => {
    const per = (tab: (typeof NOTIFICATION_TABS)[number]) => kinds.filter((k) => tabHas(tab, k));
    expect(per('all')).toEqual(kinds);
    expect(per('mentions')).toEqual(['mentioned']);
    expect(per('assigned')).toEqual(['assigned', 'helper_added']);
  });

  it('never count a row in Mentions or Assigned that All would not show: the badge is the All number', () => {
    for (const k of kinds) for (const t of NOTIFICATION_TABS) if (tabHas(t, k)) expect(tabHas('all', k)).toBe(true);
  });
});
