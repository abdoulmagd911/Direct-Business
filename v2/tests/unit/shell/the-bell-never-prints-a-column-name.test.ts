/**
 * QA-577: a change to a note read "Ahmed changed Body, Entity, Entity table, Happened on, Id, Kind on Note" (database
 * column names). The bell names only fields the app has a word for; with none it says "Ahmed edited a note".
 * Sabotage: tests/sabotage/screens.mjs "bell-prints-column-names".
 */
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { Notification } from '../../../src/core/notify/useNotifications';
import { bellLine } from '../../../src/ui/shell/bell-line';

const say = (locale: 'en' | 'ar') => {
  const tr = createTranslator({ locale, messages: locale === 'en' ? en : ar });
  return Object.assign((k: string, v?: Record<string, string | number>) => tr(k as never, v as never), {
    has: (k: string) => tr.has(k as never),
  });
};
const note = (over: Partial<Notification>): Notification =>
  ({
    id: 'n1',
    kind: 'changed_by_other',
    entity: 'note',
    entity_id: 'x',
    actor_name_en: 'Ahmed',
    actor_name_ar: 'أحمد',
    title: null,
    title_ar: null,
    fields: ['body', 'entity', 'entity_table', 'happened_on', 'id', 'kind'],
    ...over,
  }) as Notification;

describe('the bell in words', () => {
  it('says a note was edited when its changed fields have no words', () => {
    const line = bellLine(note({}), say('en'), 'en');
    expect(line).toBe('Ahmed edited a note');
    for (const raw of ['Entity', 'Happened on', 'Body', 'Id']) expect(line).not.toContain(raw);
  });
  it('names the record when it has a name', () => {
    expect(bellLine(note({ title: 'Visa call' }), say('en'), 'en')).toBe('Ahmed edited Visa call');
  });
  it('still names the fields it has words for', () => {
    const line = bellLine(note({ fields: ['theme', 'id'], entity: 'person', title: 'Test person' }), say('en'), 'en');
    expect(line).toContain('Theme');
    expect(line).not.toContain('Id');
  });
  it('still reads a plain field as "changed Status on <record>"', () => {
    const line = bellLine(note({ fields: ['status'], entity: 'task', title: 'TSK-1 · Visa call' }), say('en'), 'en');
    expect(line).toBe('Ahmed changed Status on TSK-1 · Visa call');
  });
  it('reads in Arabic too', () => {
    expect(bellLine(note({}), say('ar'), 'ar')).toContain('أحمد');
  });
});
