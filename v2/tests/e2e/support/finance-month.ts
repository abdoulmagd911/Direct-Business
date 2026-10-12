import { sql } from './stack';

/**
 * A year-month long ago that nothing else uses, so a test's figures are its own and a month closes once. Unique by
 * construction: a database sequence hands out the next number and the number is a month (720 months, 1960-2019), so
 * two workers can never be given the same one however close together they ask; a month that already holds an invoice or
 * a close (from an earlier run on the same database) is skipped.
 * The sequence is made once, under a lock: `create … if not exists` alone does not stop two workers that ask in the
 * same instant on a fresh database from both trying to create it (QA-550).
 */
export async function oldMonth(sequence = 'e2e_finance_old_month'): Promise<string> {
  await sql(
    `do $$ begin perform pg_advisory_xact_lock(7231001); create sequence if not exists public.${sequence}; end $$`,
  );
  for (let i = 0; i < 720; i += 1) {
    const next = await sql<{ n: string }>(`select nextval('public.${sequence}') as n`);
    const k = Number(next[0]?.n) % 720;
    const ym = `${1960 + Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`;
    const used = await sql(`select 1 from finance.invoice where month_on = $1::date limit 1`, [`${ym}-01`]);
    const closed = await sql(`select 1 from finance.month_close where month = $1::date limit 1`, [`${ym}-01`]);
    if (!used.length && !closed.length) return ym;
  }
  throw new Error('no unused month left to seed');
}
