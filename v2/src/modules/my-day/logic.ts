import { TURN_KINDS, type MyNote, type NoteKind, type NoteLink, type TurnKind, type WrapChoice } from './types';

/** Every block on My day draws this many rows at most, then a "more" link (V433: 5–7 rows, Comfortable, never cramped). */
export const BLOCK_ROWS = 7;

export function blockOf<T>(rows: T[], total: number): { rows: T[]; more: boolean } {
  return { rows: rows.slice(0, BLOCK_ROWS), more: Math.max(total, rows.length) > BLOCK_ROWS };
}

/**
 * Turn into (V433): a logged meeting or call and a reminder now; a task and an action item arrive with Tasks (P5-2); an
 * achievement with the KPIs page, now that its dialog and its database door are in (V379, QA-517 — it waited on its own
 * flag until then, V222). Until its page is built the menu leaves it out.
 */
export const TURN_NEEDS: Partial<Record<TurnKind, string>> = {
  task: 'tasks',
  action_item: 'tasks',
  achievement: 'kpis',
};

export function turnLive(kind: TurnKind, built: ReadonlySet<string>): boolean {
  const page = TURN_NEEDS[kind];
  return !page || built.has(page);
}

/** The Turn into kinds the menu offers: a kind whose page is not built is left out, never greyed (GC-1, cut 3). */
export const liveKinds = (built: ReadonlySet<string>): TurnKind[] => TURN_KINDS.filter((k) => turnLive(k, built));

/** The capture row's "/" words: "/meeting Kick-off" makes a meeting note titled "Kick-off"; plain words, a note. */
export const SLASH: Record<string, NoteKind> = { '/note': 'sticky', '/meeting': 'meeting', '/checklist': 'checklist' };

export function parseCapture(text: string, kind: NoteKind): { kind: NoteKind; title: string } {
  const t = text.trim();
  const [head, ...rest] = t.split(/\s+/);
  const slashed = head ? SLASH[head.toLowerCase()] : undefined;
  return slashed ? { kind: slashed, title: rest.join(' ') } : { kind, title: t };
}

/** A note's line: its title, else its first words, else its first checklist row. */
export function noteTitle(n: Pick<MyNote, 'title' | 'body' | 'items'>): string {
  return (
    n.title?.trim() || n.body?.trim().split('\n')[0]?.trim() || n.items.find((i) => i.text.trim())?.text.trim() || ''
  );
}

/** The whole note as one text, for the line of the activity it becomes. */
export function noteText(n: Pick<MyNote, 'title' | 'body' | 'items'>): string {
  return [n.title?.trim(), n.body?.trim(), ...n.items.map((i) => `- ${i.text.trim()}`)].filter(Boolean).join('\n');
}

export function checklistCount(n: Pick<MyNote, 'items'>): { done: number; total: number } {
  return { done: n.items.filter((i) => i.done).length, total: n.items.length };
}

/** Where a "turned into" chip leads: a logged call or meeting opens its organisation's record; a reminder has no page. */
export function linkRoute(link: NoteLink): string | null {
  if (link.entity === 'activity' && link.partner_id) return `/partners/${link.partner_id}`;
  if (link.entity === 'achievement') return `/kpis/achievements/${link.id}`;
  return null;
}

/** A note's own page, under My day: where a "from note" chip and a note's row lead. */
export const noteRoute = (id: string) => `/my-day/notes/${id}`;

/**
 * Wrap up today (V433) walks my open captures: api.my_day's Me answer is already the notes not done and due by today, and
 * what a meeting finished or a note turned into something has been handled.
 */
export function openCaptures(notes: MyNote[]): MyNote[] {
  return notes.filter((n) => n.mine && !n.finished_at && n.links.length === 0);
}

/** The choices api.note_wrap_up takes: only those made. */
export function wrapUpChoices(choices: Record<string, WrapChoice | undefined>) {
  return Object.entries(choices)
    .filter((e): e is [string, WrapChoice] => e[1] === 'carry' || e[1] === 'done')
    .map(([note, choice]) => ({ note, choice }));
}

/** The next working day in Riyadh: Sunday after a Thursday (OLD-WRK-022; Friday and Saturday are the weekend). */
export function nextWorkingDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 5 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}
