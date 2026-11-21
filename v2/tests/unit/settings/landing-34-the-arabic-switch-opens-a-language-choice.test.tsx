/**
 * Landing 34 (the 19 Nov test round, items 11, 12 and 24) — Settings.
 * 11: turning Arabic on must OFFER each person their language, and the app must be drawn in it. The chain had two
 *     breaks on this side: the words of a request followed the cookie alone while the layout followed the person's
 *     profile (so a saved Arabic was first answered in English), and the admin who turned Arabic on was shown no
 *     choice anywhere near the switch. One rule now (personLocale), one save (saveLanguage), and the choice on the
 *     Arabic card itself.
 * 12: the page that follows a save crashed ("This page could not be drawn") when ONE of its reads failed: the reads
 *     were awaited bare. What arrives is now checked — a failed read or a shape with no settings is said in place.
 * 24: the card printed the reason typed with the change ("Applies from 8 Nov 2026 · Batch 5 session 4 restore").
 * Every value is made up.
 * Sabotage: tests/sabotage/landing-34-settings.mjs "setting-card-prints-the-stored-reason",
 * "arabic-on-offers-no-language-choice", "language-choice-shows-while-arabic-is-off",
 * "words-follow-the-cookie-not-the-profile", "arabic-off-still-answers-in-arabic",
 * "language-is-applied-before-it-is-saved", "a-failed-settings-read-is-drawn-as-settings",
 * "a-setting-without-rows-crashes-the-card".
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { Me } from '../../../src/core/auth/me';
import { personLocale, serverPrefs } from '../../../src/core/prefs/effective';
import { saveLanguage } from '../../../src/core/prefs/use-language-choice';
import { APP_DEFAULTS } from '../../../src/core/settings/app';
import { settingsAnswerOf, type SettingDefRow } from '../../../src/modules/settings/schema';
import { SettingCard, appliesLine } from '../../../src/modules/settings/screens/SettingCard';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

const arabic = (value: boolean, over: Partial<SettingDefRow> = {}): SettingDefRow => ({
  key: 'app.arabic_enabled',
  label_key: 'setting.app.arabic_enabled',
  schema: { type: 'boolean' },
  default: false,
  effective_dated: false,
  value,
  rows: [
    {
      id: 'made-up-row',
      department_id: null,
      value,
      valid_from: '2026-11-08',
      reason: 'Made-up internal note 990001',
      set_by: null,
      set_at: '2026-11-08T09:00:00+03:00',
    },
  ],
  ...over,
});

const card = (def: SettingDefRow, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
      <SettingCard def={def} departments={[]} canEdit today="2026-11-19" />
    </NextIntlClientProvider>,
  );
const words = (markup: string) => markup.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

describe('the line under a setting’s value (item 24)', () => {
  it('says Applies from and the date, and never the reason typed with the change', () => {
    const out = card(arabic(true));
    expect(words(out)).toContain('Applies from 8 Nov 2026');
    expect(out).not.toContain('Made-up internal note');
    expect(words(out)).not.toContain('8 Nov 2026 ·');
  });

  it('a setting nobody changed still says it is the default', () => {
    const words_ = { appliesFrom: 'Applies from', byDefault: 'Default' };
    expect(appliesLine(undefined, (d) => d, words_)).toBe('Default');
    expect(appliesLine({ valid_from: '2026-11-08', reason: 'default' }, (d) => d, words_)).toBe('Default');
    expect(appliesLine({ valid_from: '2026-11-08', reason: 'Made-up note' }, (d) => d, words_)).toBe(
      'Applies from 2026-11-08',
    );
  });
});

describe('Arabic on offers the language choice at once (item 11)', () => {
  it('the Arabic card offers English and العربية while Arabic is on', () => {
    const out = card(arabic(true));
    expect(out).toContain('data-language-choice');
    expect(out).toContain('data-language-option="en"');
    expect(out).toContain('data-language-option="ar"');
    expect(words(out)).toContain('Your language');
    // the language on screen is the one marked as chosen
    expect(out).toMatch(/aria-pressed="true"[^>]*data-language-option="en"/);
    expect(card(arabic(true), 'ar')).toMatch(/aria-pressed="true"[^>]*data-language-option="ar"/);
  });

  it('while Arabic is off there is nothing to choose, and no other setting carries the choice', () => {
    expect(card(arabic(false))).not.toContain('data-language-choice');
    expect(card(arabic(true, { key: 'app.made_up_switch' }))).not.toContain('data-language-choice');
  });

  it('one rule for the language: English while Arabic is off; on, the person’s own choice, and Arabic without one', () => {
    const on = { arabic_enabled: true };
    const off = { arabic_enabled: false };
    // off: English for everyone, whatever was chosen
    expect(personLocale('ar', off)).toBe('en');
    expect(personLocale('en', off)).toBe('en');
    expect(personLocale(null, off)).toBe('en');
    expect(personLocale(undefined, off)).toBe('en');
    // on: a person who chose keeps their choice, English or Arabic
    expect(personLocale('ar', on), 'a saved Arabic is answered in Arabic on the first load').toBe('ar');
    expect(personLocale('en', on), 'a person who chose English keeps English while Arabic is on').toBe('en');
    // on: the workspace is Arabic for a person who never chose (Landing 34b) — no language saved, or no profile
    expect(personLocale(null, on), 'no language saved: the workspace’s Arabic').toBe('ar');
    expect(personLocale(undefined, on), 'no profile at all: the workspace’s Arabic').toBe('ar');
    // a value that is no language is no choice
    expect(personLocale('fr' as never, on)).toBe('ar');
    expect(personLocale('' as never, on)).toBe('ar');
  });

  it('the page’s direction follows the same rule: a saved Arabic is right-to-left whatever the cookie says', () => {
    const me = { profile: { locale: 'ar', theme: null, density: null } } as unknown as Me;
    const none = () => undefined;
    expect(serverPrefs(me, { ...APP_DEFAULTS, arabic_enabled: true }, none).locale).toBe('ar');
    expect(serverPrefs(me, { ...APP_DEFAULTS, arabic_enabled: false }, none).locale).toBe('en');
  });

  it('picking a language saves it to the profile at its version, then changes the cookie and reloads', async () => {
    const did: string[] = [];
    const sent: Record<string, unknown>[] = [];
    const saved = await saveLanguage('ar', {
      rpc: async (fn, args) => {
        did.push(fn);
        sent.push(args);
        return fn === 'me' ? { status: 'ok', profile: { version: 4_001 } } : { version: 4_002 };
      },
      apply: (l) => did.push(`cookie:${l}`),
      reload: () => did.push('reload'),
      failed: () => did.push('failed'),
    });
    expect(saved).toBe(true);
    expect(did).toEqual(['me', 'profile_update', 'cookie:ar', 'reload']);
    expect(sent[1]).toMatchObject({ p_changes: { locale: 'ar' }, p_version: 4_001 });
  });

  it('a save that fails changes nothing on screen and says so', async () => {
    const did: string[] = [];
    const saved = await saveLanguage('ar', {
      rpc: async (fn) => {
        if (fn === 'profile_update') throw new Error('made-up refusal');
        return { status: 'ok', profile: null };
      },
      apply: (l) => did.push(`cookie:${l}`),
      reload: () => did.push('reload'),
      failed: () => did.push('failed'),
    });
    expect(saved).toBe(false);
    expect(did).toEqual(['failed']);
  });
});

describe('the page after a save never crashes on what it was answered (item 12)', () => {
  it('a read that failed, or an answer with no list of settings, is not an answer — the page says so in place', () => {
    expect(settingsAnswerOf(null)).toBeNull();
    expect(settingsAnswerOf(undefined)).toBeNull();
    expect(settingsAnswerOf({ can_edit: true })).toBeNull();
    expect(settingsAnswerOf([])).toBeNull();
  });

  it('an answer is kept as it came, and a setting without its rows is one with no rows', () => {
    const got = settingsAnswerOf({ can_edit: true, settings: [{ ...arabic(false), rows: undefined }, null] });
    expect(got?.can_edit).toBe(true);
    expect(got?.settings).toHaveLength(1);
    expect(got?.settings[0]?.rows).toEqual([]);
  });

  it('the card of a setting whose rows did not arrive is drawn — Arabic back to Off, the default’s words', () => {
    const bare = { ...arabic(false), rows: undefined } as unknown as SettingDefRow;
    expect(() => card(bare)).not.toThrow();
    expect(words(card(bare))).toContain('Off');
    expect(card(bare)).not.toContain('data-language-choice');
  });
});
