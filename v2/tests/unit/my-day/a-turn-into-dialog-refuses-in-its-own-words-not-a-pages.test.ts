/**
 * V662: when Turn into is saved on something the person can only view, the notice says so in a sentence of its own —
 * "You can only view this task, so you cannot add to its checklist." — not "You need more access on this page", because a
 * dialog is not a page. Every Turn into dialog has its line, in English and Arabic; every other refusal keeps its words.
 * Sabotage: tests/sabotage/turn-into-refusal.mjs.
 */
import { readFileSync } from 'node:fs';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

const failed = vi.fn();
vi.mock('@/ui/Toast', () => ({
  toast: { failed: (...a: unknown[]) => failed(...a), success: vi.fn(), info: vi.fn() },
}));

const { command } = await import('../../../src/core/commands/command');
const { withRefusal } = await import('../../../src/core/commands/refusal');
const { DbError } = await import('../../../src/core/db/errors');

const KINDS = ['activity', 'finish', 'reminder', 'task', 'action_item', 'achievement'] as const;
const catalogs = { en, ar } as const;

/** The words a dialog's command gets: its own line for "not enough access", the catalog for everything else. */
const wordsFor = (locale: 'en' | 'ar', kind: (typeof KINDS)[number]) => {
  const t = createTranslator({ locale, messages: catalogs[locale] as never });
  const base = {
    done: 'Saved',
    undo: 'Undo',
    undone: 'Undone',
    has: (k: string) => t.has(k as never),
    failed: (k: string, d: string) => (t as (k: string, v?: object) => string)(k, { detail: d }),
  };
  return withRefusal(base, t(`pages.myDay.turn.refused.${kind}` as never));
};
const refuse = async (
  words: ReturnType<typeof wordsFor>,
  key: string,
  kind: 'PermissionDenied' | 'NotFound' = 'PermissionDenied',
) => {
  failed.mockClear();
  await command(words, () => Promise.reject(new DbError(kind, key)));
  return failed.mock.calls[0]?.[0] as string;
};

describe('a Turn into dialog refused for lack of access', () => {
  beforeEach(() => failed.mockClear());
  for (const locale of ['en', 'ar'] as const) {
    for (const kind of KINDS) {
      it(`${locale} · ${kind}: says its own sentence, with no page in it`, async () => {
        const said = await refuse(wordsFor(locale, kind), 'access.needs_level');
        expect(said).toBe(catalogs[locale].pages.myDay.turn.refused[kind]);
        expect(said).not.toBe(catalogs[locale].errors.access.needs_level);
        expect(said).not.toMatch(locale === 'en' ? /page/i : /صفحة/);
      });
    }
  }
  it('says it in the supervisor’s words for a task that is only viewed', async () => {
    expect(await refuse(wordsFor('en', 'action_item'), 'access.needs_level')).toBe(
      'You can only view this task, so you cannot add to its checklist.',
    );
  });
  it('leaves every other refusal in the catalog’s words', async () => {
    expect(await refuse(wordsFor('en', 'action_item'), 'access.needs_capability')).toBe(
      en.errors.access.needs_capability,
    );
    expect(await refuse(wordsFor('ar', 'activity'), 'common.not_found', 'NotFound')).toBe(ar.errors.kind.NotFound);
  });
});

describe('every Turn into dialog uses its line', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  const turn = read('src/modules/my-day/screens/TurnDialogs.tsx');
  it('the call or meeting, the finished meeting, the reminder and the checklist item dialogs', () => {
    for (const kind of ['activity', 'finish', 'reminder', 'action_item']) {
      expect(turn, kind).toContain(`pages.myDay.turn.refused.${kind}`);
    }
    expect(turn).toContain("finish ? 'pages.myDay.turn.refused.finish' : 'pages.myDay.turn.refused.activity'");
  });
  it('the task made from a note and the achievement made from a note', () => {
    expect(read('src/modules/tasks/screens/QuickAdd.tsx')).toContain("'pages.myDay.turn.refused.task'");
    expect(read('src/modules/perf/screens/AchievementFromNote.tsx')).toContain("tt('refused.achievement')");
  });
});
