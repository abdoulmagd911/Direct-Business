/**
 * The month helper the Finance specs share (QA-550): on a fresh database several workers ask for their first month in
 * the same instant, and every one of them must be given a month of its own, with no error. The probe uses a sequence of
 * its own, dropped first, so it behaves as a fresh database does without disturbing the real one.
 * Sabotage: tests/sabotage/finance.mjs "month-helper-creates-its-sequence-unlocked".
 */
import { expect, test } from '@playwright/test';
import { oldMonth } from './support/finance-month';
import { sql } from './support/stack';

test('first calls at the same instant on a fresh database each get a month of their own', async () => {
  const probe = 'e2e_month_helper_probe';
  // many fresh starts, because the race is a matter of a few microseconds
  for (let round = 0; round < 40; round += 1) {
    await sql(`drop sequence if exists public.${probe}`);
    const months = await Promise.all(Array.from({ length: 4 }, () => oldMonth(probe)));
    expect(new Set(months).size, 'every caller was given a different month').toBe(4);
  }
  await sql(`drop sequence if exists public.${probe}`);
});
