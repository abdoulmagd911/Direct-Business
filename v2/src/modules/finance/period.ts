// The Overview's period switch: month, quarter or year to date, or two dates of the person's own. Dates are Riyadh
// days as `YYYY-MM-DD` (D20); the database snaps both ends to month starts, the screen asks for days.

export type PeriodKey = 'mtd' | 'qtd' | 'ytd' | 'custom';
export type PeriodAsk = { key: PeriodKey; from: string; to: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const real = (s: string) => DAY.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());

/** Today in Riyadh as `YYYY-MM-DD`. */
export function riyadhDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(now);
}

/** The first day of the month a day is in. */
export const monthStart = (day: string) => `${day.slice(0, 7)}-01`;

/** The period an address asks for; anything unreadable is the year to date, never an error page. */
export function periodAsk(q: { period?: string; from?: string; to?: string }, today: string): PeriodAsk {
  const year = today.slice(0, 4);
  const month = Number(today.slice(5, 7));
  if (q.period === 'custom' && q.from && q.to && real(q.from) && real(q.to) && q.from <= q.to)
    return { key: 'custom', from: q.from, to: q.to };
  if (q.period === 'mtd') return { key: 'mtd', from: monthStart(today), to: today };
  if (q.period === 'qtd') {
    const first = Math.floor((month - 1) / 3) * 3 + 1;
    return { key: 'qtd', from: `${year}-${String(first).padStart(2, '0')}-01`, to: today };
  }
  return { key: 'ytd', from: `${year}-01-01`, to: today };
}

/** Every month start from `from` to `to`, oldest first — the months a period draws, with or without units. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}-01`);
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
