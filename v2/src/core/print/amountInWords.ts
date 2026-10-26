import type { Lang } from './report/model';

/**
 * An amount of Saudi riyals in words, as Direct's financial documents state every figure — in numbers and in words
 * ("فقط ألفا ريال لا غير" · "Two thousand Saudi riyals only"), from 0 to 999,999,999,999.99, halalas included.
 * The old app printed "مليون" (a million) for a billion (js/67 until its fix); here every range to the billions is
 * tested by reading the words back into a number (tests/unit/export/an-amount-in-words-…).
 *
 * The Arabic follows the counted-noun rules: 1 and 2 are the noun itself (ريال واحد, ريالان, ألف, ألفان); 3–10 count
 * a plural with the number's opposite gender (ثلاثة آلاف, ثلاث هللات); 11–99 an accusative singular (أحد عشر ألفاً,
 * خمس عشرة هللة); 100s and round numbers a genitive singular (مائة ألف, ثلاثمائة ريال). A word followed directly by
 * the noun it counts takes its construct form (مائتا ريال, ألفا ريال, أحد عشر ألف ريال). The riyal is masculine,
 * the halala feminine (إحدى وعشرون هللة). English keeps the old documents' style: "one hundred and five",
 * "twenty-one", "Saudi riyals", "halalas", "only".
 */
export const MAX_AMOUNT_IN_WORDS = 999_999_999_999.99;

// ---------------------------------------------------------------- Arabic

type Noun = {
  /** Genitive singular, and the noun itself for one: ريال, ألف. */
  one: string;
  /** The dual: ريالان, ألفان. */
  two: string;
  /** The dual followed by the noun it counts: ألفا (ريال). */
  twoOf: string;
  /** The plural counted by 3–10: ريالات, آلاف. */
  few: string;
  /** The accusative singular counted by 11–99. */
  many: string;
  feminine: boolean;
};

// check-allow: one-copy — the accusative's tanween (ريالاً) is how these words are spelled, not a folding table
const ACCUSATIVE = { riyal: 'ريالاً', thousand: 'ألفاً', million: 'مليوناً', billion: 'ملياراً' } as const;

const RIYAL: Noun = {
  one: 'ريال',
  two: 'ريالان',
  twoOf: 'ريالا',
  few: 'ريالات',
  many: ACCUSATIVE.riyal,
  feminine: false,
};
const HALALA: Noun = { one: 'هللة', two: 'هللتان', twoOf: 'هللتا', few: 'هللات', many: 'هللة', feminine: true };
const THOUSAND: Noun = {
  one: 'ألف',
  two: 'ألفان',
  twoOf: 'ألفا',
  few: 'آلاف',
  many: ACCUSATIVE.thousand,
  feminine: false,
};
const MILLION: Noun = {
  one: 'مليون',
  two: 'مليونان',
  twoOf: 'مليونا',
  few: 'ملايين',
  many: ACCUSATIVE.million,
  feminine: false,
};
const BILLION: Noun = {
  one: 'مليار',
  two: 'ملياران',
  twoOf: 'مليارا',
  few: 'مليارات',
  many: ACCUSATIVE.billion,
  feminine: false,
};

/** Units counting a masculine noun (3–10 take the feminine-looking form: ثلاثة ريالات). */
const ONES_M = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const ONES_F = ['', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثماني', 'تسع'];
const TEENS_M = [
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];
const TEENS_F = [
  'عشر',
  'إحدى عشرة',
  'اثنتا عشرة',
  'ثلاث عشرة',
  'أربع عشرة',
  'خمس عشرة',
  'ست عشرة',
  'سبع عشرة',
  'ثماني عشرة',
  'تسع عشرة',
];
const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
/** Two hundred followed by the noun it counts: مائتا ريال, مائتا ألف. */
const TWO_HUNDRED_OF = 'مائتا';

function under100(n: number, feminine: boolean): string {
  if (n < 10) return (feminine ? ONES_F : ONES_M)[n]!;
  if (n < 20) return (feminine ? TEENS_F : TEENS_M)[n - 10]!;
  const unit = n % 10;
  const tens = TENS[Math.floor(n / 10)]!;
  if (!unit) return tens;
  // In a compound the feminine one is إحدى: إحدى وعشرون هللة.
  const first = feminine && unit === 1 ? 'إحدى' : (feminine ? ONES_F : ONES_M)[unit]!;
  return `${first} و${tens}`;
}

/** 1–999 as a number word; `of` when the counted noun follows at once and the number ends in two hundred. */
function under1000(n: number, feminine: boolean, of = false): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const hundreds = h === 2 && !rest && of ? TWO_HUNDRED_OF : HUNDREDS[h]!;
  if (!h) return under100(rest, feminine);
  return rest ? `${hundreds} و${under100(rest, feminine)}` : hundreds;
}

/**
 * `n` (1–999) of `noun`: its text alone, and its construct form (`of`) when the next noun follows it directly.
 * `alone` — the whole amount is this count: 1 riyal is "ريال واحد", while 1,001 riyals are "ألف وريال".
 */
function counted(n: number, noun: Noun, alone: boolean): { text: string; of: string } {
  if (n === 1) {
    const text =
      alone && (noun === RIYAL || noun === HALALA) ? `${noun.one} ${noun.feminine ? 'واحدة' : 'واحد'}` : noun.one;
    return { text, of: noun.one };
  }
  if (n === 2) return { text: noun.two, of: noun.twoOf };
  const last2 = n % 100;
  if (n < 100 && last2 >= 3 && last2 <= 10) {
    const t = `${under1000(n, noun.feminine)} ${noun.few}`;
    return { text: t, of: t };
  }
  if (n < 100) {
    const words = under1000(n, noun.feminine);
    return { text: `${words} ${noun.many}`, of: `${words} ${noun.one}` };
  }
  if (last2 === 0) {
    const t = `${under1000(n, noun.feminine, true)} ${noun.one}`;
    return { text: t, of: t };
  }
  const words = under1000(n, noun.feminine);
  if (last2 <= 2) return { text: `${words} ${noun.one}`, of: `${words} ${noun.one}` };
  if (last2 <= 10) return { text: `${words} ${noun.few}`, of: `${words} ${noun.few}` };
  return { text: `${words} ${noun.many}`, of: `${words} ${noun.one}` };
}

function riyalsAr(riyals: number): string {
  const groups: [number, Noun][] = [
    [Math.floor(riyals / 1e9), BILLION],
    [Math.floor(riyals / 1e6) % 1000, MILLION],
    [Math.floor(riyals / 1e3) % 1000, THOUSAND],
  ];
  const units = riyals % 1000;
  const parts = groups.filter(([n]) => n > 0).map(([n, noun]) => counted(n, noun, false));
  if (units) {
    parts.push(counted(units, RIYAL, parts.length === 0));
    return parts.map((p) => p.text).join(' و');
  }
  // A round amount: the last scale word is followed by the riyal it counts — ألف ريال, ألفا ريال, أحد عشر ألف ريال.
  const last = parts.pop()!;
  return [...parts.map((p) => p.text), `${last.of} ${RIYAL.one}`].join(' و');
}

function amountAr(riyals: number, halalas: number): string {
  const parts: string[] = [];
  if (riyals) parts.push(riyalsAr(riyals));
  if (halalas) parts.push(counted(halalas, HALALA, true).text);
  return parts.length ? parts.join(' و') : `صفر ${RIYAL.one}`;
}

// ---------------------------------------------------------------- English

const EN_ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function enUnder1000(n: number): string {
  const out: string[] = [];
  if (n >= 100) out.push(`${EN_ONES[Math.floor(n / 100)]} hundred`);
  const rest = n % 100;
  if (rest) {
    const words =
      rest < 20 ? EN_ONES[rest]! : EN_TENS[Math.floor(rest / 10)]! + (rest % 10 ? `-${EN_ONES[rest % 10]}` : '');
    out.push(n >= 100 ? `and ${words}` : words);
  }
  return out.join(' ');
}

function enWords(n: number): string {
  if (!n) return 'zero';
  const out: string[] = [];
  for (const [scale, name] of [
    [1e9, 'billion'],
    [1e6, 'million'],
    [1e3, 'thousand'],
  ] as const) {
    const g = Math.floor(n / scale) % 1000;
    if (g) out.push(`${enUnder1000(g)} ${name}`);
  }
  if (n % 1000) out.push(enUnder1000(n % 1000));
  return out.join(' ');
}

function amountEn(riyals: number, halalas: number): string {
  const parts: string[] = [];
  if (riyals) parts.push(`${enWords(riyals)} Saudi riyal${riyals === 1 ? '' : 's'}`);
  if (halalas) parts.push(`${enWords(halalas)} halala${halalas === 1 ? '' : 's'}`);
  const text = parts.length ? parts.join(' and ') : 'zero Saudi riyals';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------- the amount

/**
 * `amount` riyals in words in `lang`, rounded to the halala: "فقط … لا غير" / "… only"; a negative amount says
 * "سالب" / "Minus". An amount beyond 999,999,999,999.99, or not a number, is refused by name — a document never prints
 * the wrong words for it.
 */
export function amountInWords(amount: number, lang: Lang): string {
  if (!Number.isFinite(amount) || Math.abs(amount) > MAX_AMOUNT_IN_WORDS + 0.004)
    throw new RangeError(`amountInWords: ${amount} is outside 0 to ${MAX_AMOUNT_IN_WORDS.toLocaleString('en')}`);
  const cents = Math.round(Math.abs(amount) * 100);
  const riyals = Math.floor(cents / 100);
  const halalas = cents % 100;
  const negative = amount < 0 && cents > 0;
  if (lang === 'ar') return `${negative ? 'سالب' : 'فقط'} ${amountAr(riyals, halalas)} لا غير`;
  const en = amountEn(riyals, halalas);
  return `${negative ? `Minus ${en.charAt(0).toLowerCase()}${en.slice(1)}` : en} only`;
}
