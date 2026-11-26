/**
 * Landing 53's fixtures: one made-up person's day as the boards draw it — nine own tasks for Today's three (two of
 * them typed, so their rows carry a kind tag), and a rest of today spread over kinds: two meetings, a call-like
 * made-up type, a follow-up task, two tasks with no type. Written straight into the stack, as the other specs' are.
 */
import { mkdirSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { seedTask, type Staff } from './landing-34';
import { sql } from './stack';

export const PHONE_390 = { width: 390, height: 844 };

/** Give a seeded task its kind: one of the Settings list's types, by key. */
export const typed = (number: string, key: string) =>
  sql(`update work.task set type_id = (select id from work.task_type where key = $2) where number = $1`, [number, key]);

/** A made-up type in the Settings list (the list is data: an admin adds a type the same way). */
export async function madeUpType(by: string, key: string, en: string, ar: string) {
  await sql(
    `insert into work.task_type (key, name_en, name_ar, sort, created_by) values ($1, $2, $3, 55, $4)
     on conflict (key) do nothing`,
    [key, en, ar, by],
  );
}

export type Day = {
  important: string[];
  short: string[];
  maintenance: string[];
  rest: { meetings: string[]; madeUp: string; followUp: string; untyped: string[] };
};

export async function seedDay(owner: Staff, word: string, madeUpKey: string): Promise<Day> {
  const make = (title: string, offset: number | null, starred = false) =>
    seedTask(owner, `Made-up ${word} ${title}`, { offset, starred });
  // the three: three starred (Important), three due today (Short), three long overdue (Maintenance)
  // the third has no due day and no type: its row is the title alone — the shortest row there is, which is what the
  // phone's 56 px rule is measured on
  const important = [await make('star A', 0, true), await make('star B', 1, true), await make('star C', null, true)];
  const short = [await make('soon A', 0), await make('soon B', 0), await make('soon C', 0)].sort();
  const maintenance = [await make('old A', -30), await make('old B', -20), await make('old C', -10)];
  await typed(important[0]!, 'meeting');
  await typed(short[0]!, 'follow_up');
  // the rest of today: due tomorrow and the day after, so the Today list holds them and the three (full) does not
  const meetings = [await make('meeting one', 1), await make('meeting two', 2)];
  for (const n of meetings) await typed(n, 'meeting');
  const madeUp = await make('made-up kind task', 1);
  await typed(madeUp, madeUpKey);
  const followUp = await make('follow-up task', 1);
  await typed(followUp, 'follow_up');
  const untyped = [await make('plain one', 1), await make('plain two', 2)];
  return { important, short, maintenance, rest: { meetings, madeUp, followUp, untyped } };
}

/** With L53_SHOTS set to a folder, a view is saved there as a picture (for the builder's own look; nothing reads it). */
export async function shot(target: Page | Locator, name: string) {
  const dir = process.env.L53_SHOTS;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  if ('goto' in target) await target.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
  else await target.screenshot({ path: `${dir}/${name}.png` });
}

/** How many words in a part of the page are drawn under 12 px. */
export const smallWords = (part: Locator) =>
  part.evaluate(
    (el) =>
      [...el.querySelectorAll('*')].filter(
        (n) =>
          n.children.length === 0 &&
          (n.textContent ?? '').trim() !== '' &&
          parseFloat(getComputedStyle(n).fontSize) < 12,
      ).length,
  );
