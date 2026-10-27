/**
 * The Arabic sweep of 27 Oct: every catalog word English has, Arabic has, for the screens that are live — My day,
 * notes, the bell, Clients and Tasks lists, Settings, the refusals shown in a toast on any of them, saved views and the
 * save-conflict box. A missing one would be drawn as its raw key. The namespaces still waiting for their Arabic
 * (Activity, My profile, the sign-in door, Finance) are named below, so a new word in any other namespace fails here.
 * Sabotages: tests/sabotage/arabic-sweep.mjs.
 */
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

const flat = (o: unknown, p = ''): string[] =>
  Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`],
  );

/** Not yet worded in Arabic, by owner: each is its own job, listed so the rest stays covered. */
const WAITING = [
  'activity.', // the change log (Activity page)
  'profile.', // My profile
  'sign_in.', // the sign-in door
  'finance.', // Finance (not live)
  'errors.finance.', // Finance refusals (not live)
  'common.datePlaceholder', // QA-600, PR #360
  'common.dateTimePlaceholder', // QA-600, PR #360
];

describe('every word of the live screens exists in Arabic (27 Oct sweep)', () => {
  const have = new Set(flat(ar));
  const missing = flat(en).filter((k) => !have.has(k) && !WAITING.some((w) => k === w || k.startsWith(w)));

  it('has every English word outside the waiting namespaces', () => {
    expect(missing, 'English words with no Arabic on a live screen').toEqual([]);
  });

  it('really is looking at the whole catalog', () => {
    expect(flat(en).length).toBeGreaterThan(1500);
    expect(have.has('notifications.markAllRead')).toBe(true);
    expect(have.has('pages.tasks.layout.calendar')).toBe(true);
  });
});
