/**
 * QA-591: every Settings group — Organisations, Targets, Finance, Work, App — drawn in Arabic shows Arabic words:
 * the setting names, today's values, the department rows, the lists and their entries, the Add and Archive words. A
 * raw key (a setting's address, a choice such as `last_activity`) or a word left in English fails here. All values
 * are made up. Sabotages: tests/sabotage/settings-in-arabic.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import { listsOf, settingsGroups } from '../../../src/modules/settings/groups';
import { SettingsGroup } from '../../../src/modules/settings/screens/SettingsGroup';
import type { ListEntry } from '../../../src/modules/settings/screens/ListEditor';
import { latinLeft, registrySettings, wordsOf } from './arabic-words';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const departments = [{ id: 'dept-1', name_en: 'Commercial', name_ar: 'الإدارة التجارية' }];
const ENTRY_NAMES = Array.from({ length: 4 }, (_, i) => `English entry ${i}`);
const entries = (key: string): ListEntry[] =>
  ['client', 'supplier_partner', 'at_risk', 'lost'].map((v, i) => ({
    id: `${key}-${i}`,
    key: `entry_${i}`,
    name_en: ENTRY_NAMES[i]!,
    name_ar: `بند ${i + 1}`,
    sort: i + 1,
    active: true,
    version: 1,
    side: i < 2 ? v : undefined,
    status: i >= 2 ? v : undefined,
  }));

const drawGroup = (page: string) => {
  const mine = registrySettings().filter((s) => s.group === page);
  const lists = listsOf(page).map((l) => ({ ...l, rows: entries(l.key) }));
  return {
    mine,
    text: wordsOf(
      renderToStaticMarkup(
        <NextIntlClientProvider locale="ar" messages={ar} timeZone="Asia/Riyadh">
          <SettingsGroup
            settings={mine.map((s) => ({
              ...s.def,
              // a department keeps its own value too, so the department row is drawn
              rows: [
                ...s.def.rows,
                { ...s.def.rows[0]!, id: `dept-${s.def.key}`, department_id: 'dept-1', reason: null },
              ],
            }))}
            canEdit
            departments={departments}
            lists={lists}
            today="2026-10-26"
          />
        </NextIntlClientProvider>,
      ),
    ),
  };
};

describe('Settings in Arabic (QA-591)', () => {
  for (const group of settingsGroups()) {
    it(`${group.slug}: every word is Arabic, and no raw key is drawn`, () => {
      const { mine, text } = drawGroup(group.page);
      expect(text.length, 'the page drew something').toBeGreaterThan(20);
      for (const s of mine) {
        expect(text, `${s.def.key} is drawn by its Arabic name, not its address`).not.toContain(s.def.key);
        expect(text, `${s.def.key} is drawn by its Arabic name, not its label key`).not.toContain(s.def.label_key);
      }
      expect(text, 'no catalog key').not.toMatch(/\b[a-z]+(?:_[a-z]+)*\.[a-z_]+(?:\.[a-zA-Z_]+)*\b/);
      expect(
        latinLeft(text, [...mine.flatMap((s) => s.typed), ...ENTRY_NAMES]),
        'words left in English or raw',
      ).toEqual([]);
    });
  }

  it('draws the Add, Edit and Archive words of a list in Arabic', () => {
    const { text } = drawGroup('settings.work');
    for (const word of [ar.settings.list.add, ar.settings.list.archive, ar.common.edit])
      expect(text, word).toContain(word);
  });
});
