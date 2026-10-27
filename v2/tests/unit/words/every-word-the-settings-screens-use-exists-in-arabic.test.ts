/**
 * QA-591, the gate: every catalog key the Settings screens ask for — read from their source, so a new `t('…')` is
 * covered the day it is written — exists in Arabic as well as English; so does every key built from a list of
 * choices (levels, tabs, record tabs, sign-in results). A key with no Arabic would be drawn as its raw address.
 * Sabotages: tests/sabotage/settings-in-arabic.mjs "arabic-gate-*".
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

const V2 = path.resolve(__dirname, '..', '..', '..');
/** The Settings area: its screens, the organisation screens its tabs and person page are made of, and its pages. */
const SOURCES = [
  'src/modules/settings/screens',
  'src/modules/settings/words.ts',
  'src/modules/org/screens/OrgAccess.tsx',
  'src/modules/org/screens/PersonRecord.tsx',
  'src/app/(app)/settings',
  'src/app/(app)/people',
];
/** Screens of other pages that live in the same folders (Activity, Recently deleted): their words are their own jobs. */
const NOT_SETTINGS = new Set(['ActivityScreen.tsx', 'RecentlyDeleted.tsx']);
/** Keys built from a list of choices in those sources, spelt out. */
const FAMILIES: Record<string, string[]> = {
  'levels.': ['none', 'view', 'own', 'full'],
  'settings.tabs.': ['people', 'teams', 'access', 'roles', 'signIn'],
  'record.': ['overview', 'activity', 'related'],
  'activity.signIn.results.': [
    'ok',
    'not_listed',
    'switched_off',
    'code_invalid',
    'code_expired',
    'provider_error',
    'signed_out',
    'rate_limited',
    'wrong_password',
    'locked',
  ],
  'settings.setting.values.': ['true', 'false'],
};

const filesOf = (p: string): string[] => {
  const full = path.join(V2, p);
  if (fs.statSync(full).isFile()) return [p];
  return fs
    .readdirSync(full, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? filesOf(path.join(p, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(p, e.name)] : [],
    )
    .filter((f) => !NOT_SETTINGS.has(path.basename(f)));
};
const wordOf = (catalog: unknown, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], catalog);

/** Every literal key the sources pass to t(…) or t.has(…): `t('a.b')`, with no `${…}` in it. */
export function keysAsked(): { key: string; file: string }[] {
  const out: { key: string; file: string }[] = [];
  for (const file of SOURCES.flatMap(filesOf))
    for (const m of fs.readFileSync(path.join(V2, file), 'utf8').matchAll(/\bt(?:\.has)?\(\s*(['"`])([^'"`$]+)\1/g))
      if (/^[a-zA-Z_]+(\.[a-zA-Z_0-9]+)+$/.test(m[2]!)) out.push({ key: m[2]!, file });
  return out;
}

describe('every word the Settings screens use exists in Arabic (QA-591)', () => {
  const asked = keysAsked();

  it('reads a real number of keys from the screens (the scan is not blind)', () => {
    expect(asked.length).toBeGreaterThan(150);
    expect(asked.map((a) => a.key)).toContain('settings.setting.change');
    expect(asked.map((a) => a.key)).toContain('settings.people.signInLog');
  });

  it('has each key in Arabic and in English', () => {
    const keys = [
      ...asked.map((a) => `${a.key}  (${a.file})`),
      ...Object.entries(FAMILIES).flatMap(([prefix, names]) => names.map((n) => `${prefix}${n}`)),
    ];
    const missing = keys.flatMap((k) => {
      const key = k.split('  ')[0]!;
      return [
        ...(typeof wordOf(ar, key) === 'string' ? [] : [`ar: ${k}`]),
        ...(typeof wordOf(en, key) === 'string' ? [] : [`en: ${k}`]),
      ];
    });
    expect(missing, 'keys the Settings screens draw with no wording').toEqual([]);
  });
});
