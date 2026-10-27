/**
 * QA 2, 26 Oct: on a phone in Arabic the link on a note turned into a task drew its raw key
 * (pages.myDay.note.linkTask). Every word of My day that English has, Arabic has; and the three link words are worded
 * with their values. All values are made up.
 * Sabotages: tests/sabotage/my-day-note-links-arabic.mjs.
 */
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

const flat = (o: unknown, p = ''): string[] =>
  Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`],
  );
const say = createTranslator({ locale: 'ar', messages: ar as never }) as unknown as (
  key: string,
  values?: Record<string, string>,
) => string;

describe('the My day note links in Arabic', () => {
  it('words the link of a note turned into a task, into an action item, and the Make-a-task title', () => {
    expect(say('pages.myDay.note.linkTask', { number: 'T-12', title: 'اتصال بالعميل' })).toBe(
      'مهمة T-12 · اتصال بالعميل',
    );
    expect(say('pages.myDay.note.linkActionItem', { number: 'T-12', text: 'إرسال العرض' })).toBe(
      'بند عمل في T-12 · إرسال العرض',
    );
    expect(say('pages.myDay.turn.taskTitle')).not.toContain('pages.myDay');
  });

  it('has in Arabic every My day word that English has', () => {
    const have = new Set(flat((ar as { pages: { myDay: unknown } }).pages.myDay));
    const missing = flat((en as { pages: { myDay: unknown } }).pages.myDay).filter((k) => !have.has(k));
    expect(missing, 'My day words with no Arabic').toEqual([]);
  });
});
