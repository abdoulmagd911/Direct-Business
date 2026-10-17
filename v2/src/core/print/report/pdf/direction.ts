import type { Lang } from '../model';

/**
 * react-pdf has no logical properties and no layout direction (its Yoga binding never sets one), so a document
 * mirrors itself: rows run from the reading start, text aligns to the reading start, and the start/end paddings and
 * borders swap sides in Arabic. This file is the one place where a logical side becomes a physical one (§2.5 keeps
 * physical CSS out of everything else); each physical name below carries its waiver.
 */
export interface Direction {
  rtl: boolean;
  /** `direction` for text runs: the bidi algorithm's paragraph level. */
  text: 'rtl' | 'ltr';
  /** A row that starts at the reading start. */
  row: 'row' | 'row-reverse';
  /** Text aligned to the reading start / end. */
  alignStart: 'left' | 'right';
  alignEnd: 'left' | 'right';
  /** A flex row's main-axis alignment to the reading start / end (a `row` already follows the reading order). */
  justifyStart: 'flex-start';
  justifyEnd: 'flex-end';
  paddingStart: (v: number) => Record<string, number>;
  paddingEnd: (v: number) => Record<string, number>;
  marginStart: (v: number) => Record<string, number>;
  marginEnd: (v: number) => Record<string, number>;
  borderStart: (width: number, color: string) => Record<string, string | number>;
  insetStart: (v: number) => Record<string, number>;
  insetEnd: (v: number) => Record<string, number>;
}

export function direction(lang: Lang): Direction {
  const rtl = lang === 'ar';
  const start = rtl ? 'right' : 'left'; // check-allow: no-physical-css — react-pdf has no logical sides; this maps them
  const end = rtl ? 'left' : 'right'; // check-allow: no-physical-css — react-pdf has no logical sides; this maps them
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return {
    rtl,
    text: rtl ? 'rtl' : 'ltr',
    row: rtl ? 'row-reverse' : 'row',
    alignStart: start,
    alignEnd: end,
    justifyStart: 'flex-start',
    justifyEnd: 'flex-end',
    paddingStart: (v) => ({ [`padding${cap(start)}`]: v }),
    paddingEnd: (v) => ({ [`padding${cap(end)}`]: v }),
    marginStart: (v) => ({ [`margin${cap(start)}`]: v }),
    marginEnd: (v) => ({ [`margin${cap(end)}`]: v }),
    borderStart: (width, color) => ({ [`border${cap(start)}Width`]: width, [`border${cap(start)}Color`]: color }),
    insetStart: (v) => ({ [start]: v }),
    insetEnd: (v) => ({ [end]: v }),
  };
}
