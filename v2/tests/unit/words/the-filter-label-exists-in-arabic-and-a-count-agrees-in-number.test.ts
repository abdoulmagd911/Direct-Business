/**
 * The oversight's sweep of 12 Oct: the Filter button has an Arabic word (it showed its key), and "1 organisation" is
 * singular in English while the Arabic count keeps its own plural forms. Every value is made up.
 * Sabotage: tests/sabotage/sweep.mjs "arabic-filter-label-missing".
 */
import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

const say = (locale: 'en' | 'ar', messages: object, key: string, values?: Record<string, number>) =>
  createTranslator({ locale, messages: messages as never })(key as never, values as never);

describe('the Filter label', () => {
  it('has a word in Arabic, not only in English', () => {
    expect((ar as { common: Record<string, string> }).common.filter, 'the Arabic Filter label exists').toBeTruthy();
    expect((en as { common: Record<string, string> }).common.filter).toBe('Filter');
  });
});

describe('a count agrees in number', () => {
  it('says 1 organisation and 2 organisations', () => {
    expect(say('en', en, 'partners.count', { count: 1 })).toBe('1 organisation');
    expect(say('en', en, 'partners.count', { count: 2 })).toBe('2 organisations');
    expect(say('en', en, 'partners.bulk.title', { count: 1 })).toBe('Assign 1 organisation');
  });

  it('says one person, one device, one entry in the places that counted them', () => {
    expect(say('en', en, 'activity.groupedChanges', { count: 1 })).toBe('1 change');
    expect(say('en', en, 'profile.devices.othersSignedOut', { count: 1 })).toBe('1 device signed out');
    expect(say('en', en, 'settings.list.entries', { count: 1 })).toBe('1 entry');
  });
});
