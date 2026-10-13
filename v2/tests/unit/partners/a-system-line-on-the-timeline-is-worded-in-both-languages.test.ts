/**
 * D5: the database sends a task's event on a client's timeline as a type and values; the screen words it, in English and in
 * Arabic, with the task's title — never a sentence from the database. Every title is made up.
 * Sabotage: tests/sabotage/timeline-events.mjs "timeline-event-has-no-words".
 */
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { eventWords } from '../../../src/modules/partners/event-words';

const added = { type: 'task_added', values: { task_id: 't1', number: 'TSK-2026-0001', title: 'Call the hotel' } };
const done = { type: 'task_done', values: { task_id: 't1', number: 'TSK-2026-0001', title: 'Call the hotel' } };

const words = (locale: 'en' | 'ar', event: Parameters<typeof eventWords>[0]) => {
  const t = createTranslator({ locale, messages: locale === 'en' ? en : ar });
  return eventWords(event, t as never);
};

describe('eventWords', () => {
  it('words a task added and a task done in English, with the title', () => {
    expect(words('en', added)).toBe('Task added: Call the hotel');
    expect(words('en', done)).toBe('Task done: Call the hotel');
  });
  it('words them in Arabic, with the title', () => {
    expect(words('ar', added)).toContain('Call the hotel');
    expect(words('ar', added)).not.toBe(words('en', added));
    expect(words('ar', done)).toContain('Call the hotel');
    expect(words('ar', done)).not.toBe(words('ar', added));
  });
  it('is nothing for a person’s note, or for a type it has no words for', () => {
    expect(words('en', null)).toBeNull();
    expect(words('en', { type: 'task_unknown', values: null })).toBeNull();
  });
  it('falls back to the number when the title is not there', () => {
    expect(words('en', { type: 'task_added', values: { task_id: 't', number: 'TSK-2026-0002', title: null } })).toBe(
      'Task added: TSK-2026-0002',
    );
  });
});
