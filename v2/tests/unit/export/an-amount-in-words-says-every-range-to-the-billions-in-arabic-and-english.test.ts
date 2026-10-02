import { describe, expect, it } from 'vitest';
import { amountInWords, MAX_AMOUNT_IN_WORDS } from '@/core/print/amountInWords';
import { readArabicAmount, readEnglishAmount } from './words-reader';

/**
 * Amounts in words (oversight, 29 Sep: "test the Arabic amount-in-words at every range up to billions — the old app
 * printed 'million' for a billion"). Two proofs: the exact words at the edge of every range, in both languages, and
 * the words read back into the same number by an independent reader — every amount from 0 to 2,000 and 3,000 seeded
 * amounts in each of the thousands, millions and billions, halalas included.
 * Sabotages: `words-say-million-for-a-billion`, `words-drop-the-construct-form`, `words-count-halalas-as-riyals`,
 * `words-lose-the-accusative` (tests/sabotage/export.mjs).
 */
const ar = (n: number) => amountInWords(n, 'ar');
const en = (n: number) => amountInWords(n, 'en');

describe('the Arabic words', () => {
  it.each([
    [0, 'فقط صفر ريال لا غير'],
    [0.01, 'فقط هللة واحدة لا غير'],
    [0.02, 'فقط هللتان لا غير'],
    [0.03, 'فقط ثلاث هللات لا غير'],
    [0.1, 'فقط عشر هللات لا غير'],
    [0.11, 'فقط إحدى عشرة هللة لا غير'],
    [0.21, 'فقط إحدى وعشرون هللة لا غير'],
    [0.22, 'فقط اثنتان وعشرون هللة لا غير'],
    [0.99, 'فقط تسع وتسعون هللة لا غير'],
    [1, 'فقط ريال واحد لا غير'],
    [2, 'فقط ريالان لا غير'],
    [3, 'فقط ثلاثة ريالات لا غير'],
    [10, 'فقط عشرة ريالات لا غير'],
    [11, 'فقط أحد عشر ريالاً لا غير'],
    [12, 'فقط اثنا عشر ريالاً لا غير'],
    [21, 'فقط واحد وعشرون ريالاً لا غير'],
    [99, 'فقط تسعة وتسعون ريالاً لا غير'],
    [100, 'فقط مائة ريال لا غير'],
    [101, 'فقط مائة وواحد ريال لا غير'],
    [103, 'فقط مائة وثلاثة ريالات لا غير'],
    [111, 'فقط مائة وأحد عشر ريالاً لا غير'],
    [200, 'فقط مائتا ريال لا غير'],
    [250.5, 'فقط مائتان وخمسون ريالاً وخمسون هللة لا غير'],
    [1000, 'فقط ألف ريال لا غير'],
    [1001, 'فقط ألف وريال لا غير'],
    [1002, 'فقط ألف وريالان لا غير'],
    [2000, 'فقط ألفا ريال لا غير'],
    [2200, 'فقط ألفان ومائتا ريال لا غير'],
    [3000, 'فقط ثلاثة آلاف ريال لا غير'],
    [11000, 'فقط أحد عشر ألف ريال لا غير'],
    [11500, 'فقط أحد عشر ألفاً وخمسمائة ريال لا غير'],
    [100000, 'فقط مائة ألف ريال لا غير'],
    [200000, 'فقط مائتا ألف ريال لا غير'],
    [1e6, 'فقط مليون ريال لا غير'],
    [2e6, 'فقط مليونا ريال لا غير'],
    [3e6, 'فقط ثلاثة ملايين ريال لا غير'],
    [1e9, 'فقط مليار ريال لا غير'],
    [2e9, 'فقط مليارا ريال لا غير'],
    [3e9, 'فقط ثلاثة مليارات ريال لا غير'],
    [11e9, 'فقط أحد عشر مليار ريال لا غير'],
    [
      1_234_567_890.25,
      'فقط مليار ومائتان وأربعة وثلاثون مليوناً وخمسمائة وسبعة وستون ألفاً وثمانمائة وتسعون ريالاً وخمس وعشرون هللة لا غير',
    ],
    [
      MAX_AMOUNT_IN_WORDS,
      'فقط تسعمائة وتسعة وتسعون ملياراً وتسعمائة وتسعة وتسعون مليوناً وتسعمائة وتسعة وتسعون ألفاً وتسعمائة وتسعة وتسعون ريالاً وتسع وتسعون هللة لا غير',
    ],
    [-11500, 'سالب أحد عشر ألفاً وخمسمائة ريال لا غير'],
  ])('%d is "%s"', (n, words) => {
    expect(ar(n)).toBe(words);
  });

  it('says billion for a billion, never million (the old app’s defect)', () => {
    for (const n of [1e9, 1_000_000_001, 5e9, 999e9]) {
      expect(ar(n)).toMatch(/مليار/);
      expect(ar(n)).not.toMatch(/مليون|ملايين/);
    }
  });
});

describe('the English words', () => {
  it.each([
    [0, 'Zero Saudi riyals only'],
    [0.01, 'One halala only'],
    [0.5, 'Fifty halalas only'],
    [1, 'One Saudi riyal only'],
    [2, 'Two Saudi riyals only'],
    [21, 'Twenty-one Saudi riyals only'],
    [105, 'One hundred and five Saudi riyals only'],
    [1001, 'One thousand one Saudi riyals only'],
    [1e9, 'One billion Saudi riyals only'],
    [
      1_234_567_890.25,
      'One billion two hundred and thirty-four million five hundred and sixty-seven thousand eight hundred and ninety Saudi riyals and twenty-five halalas only',
    ],
    [-11500, 'Minus eleven thousand five hundred Saudi riyals only'],
  ])('%d is "%s"', (n, words) => {
    expect(en(n)).toBe(words);
  });
});

/** A seeded generator, so a failure names an amount that fails again. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('the words read back into the same amount', () => {
  const check = (n: number) => {
    expect(readArabicAmount(ar(n)), `${n}: ${ar(n)}`).toBeCloseTo(n, 2);
    expect(readEnglishAmount(en(n)), `${n}: ${en(n)}`).toBeCloseTo(n, 2);
  };

  it('for every amount from 0 to 2,000 riyals, and every halala of one riyal', () => {
    for (let n = 0; n <= 2000; n++) check(n);
    for (let h = 0; h < 100; h++) check(1 + h / 100);
  });

  it.each([
    ['thousands', 1e3, 1e6],
    ['millions', 1e6, 1e9],
    ['billions', 1e9, 1e12],
  ])('for 3,000 seeded amounts in the %s, with halalas', (_, from, to) => {
    const next = seeded(from);
    for (let i = 0; i < 3000; i++) {
      const riyals = Math.floor(from + next() * (to - from));
      check(riyals + Math.floor(next() * 100) / 100);
    }
  });

  it('at the edges of every group: round numbers, one more, one less', () => {
    for (let p = 0; p <= 11; p++)
      for (const k of [1, 2, 3, 10, 11, 12, 99, 100, 101, 200, 999]) {
        const n = k * 10 ** p;
        if (n > MAX_AMOUNT_IN_WORDS) continue;
        for (const m of [n - 1, n, n + 1]) if (m >= 0 && m <= MAX_AMOUNT_IN_WORDS) check(m);
      }
  });
});

describe('what cannot be said', () => {
  it.each([1e12, -1e12, Number.NaN, Infinity])('refuses %d by name', (n) => {
    expect(() => ar(n)).toThrow(RangeError);
    expect(() => en(n)).toThrow(/outside 0 to 999,999,999,999.99/);
  });

  it('rounds to the halala, and a halala past .99 carries into the riyal', () => {
    expect(ar(0.294)).toBe(ar(0.29));
    expect(ar(1.999)).toBe(ar(2));
    expect(en(0.1 + 0.2)).toBe('Thirty halalas only');
  });
});
