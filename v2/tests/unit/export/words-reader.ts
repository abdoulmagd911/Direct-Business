/**
 * Reads an amount in words back into a number — independently of the writer: a lexicon of word values and the plain
 * rule "numbers add, a scale word multiplies what came before it, a currency noun closes its count". If the writer
 * says "million" for a billion, drops a group or miscounts a construct form, the number read back differs.
 */
const AR_NUMBER: Record<string, number> = {
  واحد: 1,
  واحدة: 1,
  أحد: 1,
  إحدى: 1,
  اثنان: 2,
  اثنتان: 2,
  اثنا: 2,
  اثنتا: 2,
  ثلاثة: 3,
  ثلاث: 3,
  أربعة: 4,
  أربع: 4,
  خمسة: 5,
  خمس: 5,
  ستة: 6,
  ست: 6,
  سبعة: 7,
  سبع: 7,
  ثمانية: 8,
  ثماني: 8,
  تسعة: 9,
  تسع: 9,
  عشرة: 10,
  عشر: 10,
  عشرون: 20,
  ثلاثون: 30,
  أربعون: 40,
  خمسون: 50,
  ستون: 60,
  سبعون: 70,
  ثمانون: 80,
  تسعون: 90,
  مائة: 100,
  مائتان: 200,
  مائتا: 200,
  ثلاثمائة: 300,
  أربعمائة: 400,
  خمسمائة: 500,
  ستمائة: 600,
  سبعمائة: 700,
  ثمانمائة: 800,
  تسعمائة: 900,
  صفر: 0,
};

/** Scale words: [multiplier, the count the word carries alone (1, or 2 for a dual)]. */
const AR_SCALE: Record<string, [number, number]> = {};
const AR_NOUN: Record<string, ['riyal' | 'halala', number]> = {};
for (const [forms, mult] of [
  [['ألف', 'آلاف', 'ألفاً', 'ألفان', 'ألفا'], 1e3],
  [['مليون', 'ملايين', 'مليوناً', 'مليونان', 'مليونا'], 1e6],
  [['مليار', 'مليارات', 'ملياراً', 'ملياران', 'مليارا'], 1e9],
] as const)
  forms.forEach((f, i) => (AR_SCALE[f] = [mult, i >= 3 ? 2 : 1]));
for (const [forms, which] of [
  [['ريال', 'ريالات', 'ريالاً', 'ريالان', 'ريالا'], 'riyal'],
  [['هللة', 'هللات', 'هللة', 'هللتان', 'هللتا'], 'halala'],
] as const)
  forms.forEach((f, i) => (AR_NOUN[f] = [which, i >= 3 ? 2 : 1]));

export function readArabicAmount(text: string): number {
  const words = text.split(' ');
  const sign = words[0] === 'سالب' ? -1 : 1;
  if (!['فقط', 'سالب'].includes(words[0]!) || words.at(-2) !== 'لا' || words.at(-1) !== 'غير')
    throw new Error(`not framed as an amount: ${text}`);
  const amount = { riyal: 0, halala: 0 };
  let total = 0;
  let current = 0;
  let zero = false;
  for (let i = 1; i < words.length - 2; i++) {
    let w = words[i]!;
    let joined = false;
    if (!(w in AR_NUMBER) && !(w in AR_SCALE) && !(w in AR_NOUN) && w.startsWith('و')) {
      w = w.slice(1);
      joined = true;
    }
    if (w === 'صفر') zero = true;
    else if (w in AR_NUMBER) current += AR_NUMBER[w]!;
    else if (w in AR_SCALE) {
      const [mult, alone] = AR_SCALE[w]!;
      total += (current || alone) * mult;
      current = 0;
    } else if (w in AR_NOUN) {
      const [which, alone] = AR_NOUN[w]!;
      const next = words[i + 1];
      let count: number;
      if (zero)
        count = 0; // صفر ريال
      else if (current)
        count = total + current; // ثلاثة ريالات · مائة وواحد ريال
      else if (alone === 1 && (next === 'واحد' || next === 'واحدة')) {
        count = total + 1; // ريال واحد · وهللة واحدة
        i++;
      } else if (joined || !total)
        count = total + alone; // ألف وريال · ريالان · وهللتان
      else count = total; // after a scale word, in construct: مليون ريال · ألفا ريال
      amount[which] += count;
      total = 0;
      current = 0;
      zero = false;
    } else throw new Error(`unknown word "${w}" in: ${text}`);
  }
  if (total || current) throw new Error(`a count with no noun in: ${text}`);
  return sign * (amount.riyal + amount.halala / 100);
}

const EN_NUMBER: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const EN_SCALE: Record<string, number> = { thousand: 1e3, million: 1e6, billion: 1e9 };

export function readEnglishAmount(text: string): number {
  const words = text.toLowerCase().split(/[ -]/);
  if (words.at(-1) !== 'only') throw new Error(`not framed as an amount: ${text}`);
  const sign = words[0] === 'minus' ? -1 : 1;
  const amount = { riyal: 0, halala: 0 };
  let total = 0;
  let current = 0;
  for (const w of words.slice(sign < 0 ? 1 : 0, -1)) {
    if (w === 'and' || w === 'saudi') continue;
    if (w in EN_NUMBER) current += EN_NUMBER[w]!;
    else if (w === 'hundred') current *= 100;
    else if (w in EN_SCALE) {
      total += current * EN_SCALE[w]!;
      current = 0;
    } else if (/^riyals?$/.test(w) || /^halalas?$/.test(w)) {
      amount[w.startsWith('r') ? 'riyal' : 'halala'] += total + current;
      total = 0;
      current = 0;
    } else throw new Error(`unknown word "${w}" in: ${text}`);
  }
  if (total || current) throw new Error(`a count with no noun in: ${text}`);
  return sign * (amount.riyal + amount.halala / 100);
}
