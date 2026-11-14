/**
 * The shared diff renderer with next-intl's own translator (the 13 Nov sweep): `has` is true for a GROUP of words too
 * (`setting.files`, `cap.clients`), and `t` on a group answers the key's own path — so a change whose key was "files"
 * read "setting.files" on the Activity page, and next-intl logged INSUFFICIENT_PATH. A group is no word now; a real
 * word still reads. Every value is made up.
 */
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json';
import { keyWord, settingLabel, type WordT } from '../../../src/ui/record/diff-words';

const errors: string[] = [];
const t = createTranslator({
  locale: 'en',
  messages: en,
  onError: (e) => errors.push(e.code),
}) as unknown as WordT;

describe('a key that names a group of words is no word', () => {
  it('reads no word for a group, and logs nothing', () => {
    errors.length = 0;
    expect(keyWord(t, 'files')).toBeNull();
    expect(settingLabel(t, 'files')).toBeNull();
    // cap.clients is a group; "clients" still reads as the Partners start page, never as "cap.clients"
    expect(keyWord(t, 'clients')).toBe(en.activity.startPage.clients);
    expect(errors).toEqual([]);
  });
  it('still reads a real word', () => {
    expect(keyWord(t, 'my_day')).toBe(en.activity.startPage.my_day);
    expect(settingLabel(t, 'files.max_mb')).toBe(en.setting.files.max_mb);
  });
});
