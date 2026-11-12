/**
 * The shared diff renderer (D36(a), Landing 15 Group C): a change's values read in words — a start page by its
 * word, a setting or capability key by its wording, a list of people by name — never raw. Every value is made up.
 * Sabotages: tests/sabotage/screens.mjs "history-reads-a-start-page-raw", "history-reads-a-shared-with-id-raw".
 */
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import {
  fieldLabel,
  keyWord,
  makeValueWords,
  settingLabel,
  settingValueWords,
  type WordT,
} from '../../../src/ui/record/diff-words';

/** next-intl's `t` over the messages file, flat dotted keys and nested ones alike. */
const lookup = (messages: unknown, key: string): unknown => {
  let node: unknown = messages;
  const parts = key.split('.');
  for (let i = 0; i < parts.length; i++) {
    if (!node || typeof node !== 'object') return undefined;
    const rest = parts.slice(i).join('.');
    if (rest in (node as Record<string, unknown>)) return (node as Record<string, unknown>)[rest];
    node = (node as Record<string, unknown>)[parts[i]!];
  }
  return node;
};
const fakeT = (messages: Record<string, unknown>): WordT => {
  const fn = ((key: string) => {
    const v = lookup(messages, key);
    if (typeof v !== 'string') throw new Error(`no word for ${key}`);
    return v;
  }) as WordT;
  fn.has = (key: string) => typeof lookup(messages, key) === 'string';
  return fn;
};

const t = fakeT(en as unknown as Record<string, unknown>);
const tar = fakeT(ar as unknown as Record<string, unknown>);

const PERSON_A = '11111111-1111-4111-8111-111111111111';
const PERSON_B = '22222222-2222-4222-8222-222222222222';
const UNKNOWN = '33333333-3333-4333-8333-333333333333';
const people = { [PERSON_A]: { displayName: 'TEST Person A' }, [PERSON_B]: { displayName: 'TEST Person B' } };
const words = makeValueWords({ t, locale: 'en', people });
const wordsAr = makeValueWords({ t: tar, locale: 'ar', people });

describe('a field label', () => {
  it('reads a file hash as SHA-256, and an unknown field in plain words', () => {
    expect(fieldLabel(t, 'sha256')).toBe('SHA-256');
    expect(fieldLabel(t, 'manager_id')).toBe('Reports to');
    expect(fieldLabel(t, 'made_up_field')).toBe('Made up field');
  });
});

describe('a key in words', () => {
  it('names a setting, a capability and a start page', () => {
    expect(keyWord(t, 'app.arabic_enabled')).toBe('Arabic');
    expect(keyWord(t, 'tasks.assign_own')).toBe('Assign a task I own or created');
    expect(keyWord(t, 'my_day')).toBe('My day');
    expect(keyWord(t, 'no_such_key')).toBeNull();
  });
  it('has the same words in Arabic', () => {
    expect(keyWord(tar, 'app.arabic_enabled')).toBe('العربية');
    expect(keyWord(tar, 'my_day')).toBe('يومي');
  });
});

describe('a value in words', () => {
  it('reads a start page, a theme, a density and a language by their words (F-B5-13(a))', () => {
    expect(words('start_page', 'my_day')).toBe('My day');
    expect(words('start_page', 'tasks')).toBe('Tasks');
    expect(words('theme', 'dark')).toBe('Dark');
    expect(words('density', 'compact')).toBe('Compact');
    expect(words('locale', 'ar')).toBe('العربية');
    expect(wordsAr('start_page', 'my_day')).toBe('يومي');
  });
  it('reads a setting key and a capability key by their words', () => {
    expect(words('key', 'app.arabic_enabled')).toBe('Arabic');
    expect(words('key', 'notify.kinds_enabled')).toBe('Notifications sent');
    expect(words('capability_key', 'clients.assign_own')).toBe('Bulk-assign clients I own');
  });
  it('names a person for their id, and says nothing for an unknown one', () => {
    expect(words('owner_id', PERSON_A)).toBe('TEST Person A');
    expect(words('owner_id', UNKNOWN)).toBe('—');
  });
  it('names every person in a list, never a raw id (F-B2-02)', () => {
    expect(words('shared_with', [PERSON_A, PERSON_B])).toBe('TEST Person A, TEST Person B');
    expect(words('shared_with', [PERSON_A, UNKNOWN])).toBe('TEST Person A, —');
    expect(words('shared_with', [])).toBe('—');
  });
  it('keeps a checklist item by its text, marked done, and a date the one way', () => {
    expect(
      words('checklist', [
        { text: 'Call them', done: true },
        { text: 'Send it', done: false },
      ]),
    ).toBe('Call them (Done), Send it');
    expect(words('due_on', '2026-11-07')).toBe('7 Nov 2026');
    expect(words('done', true)).toBe('Yes');
    expect(words('done', false)).toBe('No');
    expect(words('title', null)).toBe('—');
  });
  it('reads a grouped value by its named parts, with the key inside them in words', () => {
    expect(words('change', { key: 'app.arabic_enabled', value: true })).toBe('Key: Arabic, Value: Yes');
  });
});

describe('a setting value in words', () => {
  it('names the notification kinds a setting lists, and a default theme and start page', () => {
    expect(settingValueWords(t, 'notify.kinds_enabled', ['assigned', 'mentioned'], words)).toBe(
      'Assigned to me, Mentioned',
    );
    expect(settingValueWords(t, 'notify.kinds_enabled', [], words)).toBe('—');
    expect(settingValueWords(t, 'app.default_theme', 'dark', words)).toBe('Dark');
    expect(settingValueWords(t, 'app.default_start_page', 'my_day', words)).toBe('My day');
    expect(settingValueWords(t, 'app.arabic_enabled', false, words)).toBe('No');
    expect(settingValueWords(t, 'files.max_mb', 30, words)).toBe('30');
  });
  it('a setting label is its wording, else nothing', () => {
    expect(settingLabel(t, 'notify.kinds_enabled')).toBe('Notifications sent');
    expect(settingLabel(t, 'no_such_setting')).toBeNull();
  });
});
