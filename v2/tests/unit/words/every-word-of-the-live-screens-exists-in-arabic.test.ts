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

describe('every word of the app exists in Arabic (27 Oct sweep, whole catalog since 31 Oct)', () => {
  const have = new Set(flat(ar));
  const missing = flat(en).filter((k) => !have.has(k));

  it('has every English word', () => {
    expect(missing, 'English words with no Arabic').toEqual([]);
  });

  it('really is looking at the whole catalog', () => {
    expect(flat(en).length).toBeGreaterThan(1500);
    expect(have.has('notifications.markAllRead')).toBe(true);
    expect(have.has('pages.tasks.layout.calendar')).toBe(true);
  });
});
