/**
 * QA-591: the Change dialog of every setting in Arabic — each choice a setting offers, each field of an object setting,
 * the On and Off words — has its Arabic word in the catalog, not a fallback (the value itself, or its key spelt out in
 * English). The editor is drawn for every setting and read like a person reads it. All values are made up.
 * Sabotages: tests/sabotage/settings-in-arabic.mjs.
 */
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import { SchemaEditor, SchemaValue } from '../../../src/modules/settings/screens/SchemaEditor';
import { keyWordKey, valueText, valueWord, valueWordKeys, type Say } from '../../../src/modules/settings/words';
import { choicesOf, fieldNamesOf, latinLeft, registrySettings, wordsOf } from './arabic-words';

const say = createTranslator({ locale: 'ar', messages: ar as never }) as unknown as Say;
const has = (k: string) => say.has(k);

describe('every choice and field of a setting has an Arabic word', () => {
  const settings = registrySettings();

  it('gives each fixed choice of each setting its word in the catalog', () => {
    const noWord = settings.flatMap((s) =>
      choicesOf(s.def.schema, s.def.key)
        .filter((c) => !valueWordKeys(c.settingKey, c.value).some(has))
        .map((c) => `${c.settingKey} = ${c.value}`),
    );
    expect(noWord, 'choices that would be drawn as their raw value').toEqual([]);
  });

  it('gives each field of each object setting its word in the catalog', () => {
    const noWord = [...new Set(settings.flatMap((s) => fieldNamesOf(s.def.schema)))].filter((k) => !has(keyWordKey(k)));
    expect(noWord, 'fields that would be drawn as their key spelt out in English').toEqual([]);
  });

  it('words On and Off, and an empty value, in Arabic', () => {
    expect(valueWord(say, 'app.arabic_enabled', true)).toBe(ar.settings.setting.values.true);
    expect(valueWord(say, 'app.arabic_enabled', false)).toBe(ar.settings.setting.values.false);
    expect(valueText(say, 'app.go_live_on', '')).toBe(ar.settings.setting.notSet);
  });

  it('draws the value and the editor of every setting with no word left in English', () => {
    for (const s of settings) {
      const out = wordsOf(
        renderToStaticMarkup(
          <NextIntlClientProvider locale="ar" messages={ar} timeZone="Asia/Riyadh">
            <SchemaValue settingKey={s.def.key} value={s.def.value} />
            <SchemaEditor
              settingKey={s.def.key}
              schema={s.def.schema}
              value={s.def.value}
              onChange={() => undefined}
              label="تسمية"
            />
          </NextIntlClientProvider>,
        ),
      );
      expect(latinLeft(out, s.typed), `${s.def.key} as drawn: ${out}`).toEqual([]);
    }
  });
});
