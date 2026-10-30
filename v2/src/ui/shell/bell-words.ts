import type { Notification } from '@/core/notify/useNotifications';

export type Group = 'today' | 'yesterday' | 'earlier';

const DAY_MS = 86_400_000;
export const riyadhDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });

/** Today, yesterday and tomorrow are Riyadh days counted from the SERVER's clock (V40, QA-74): the browser's clock and zone decide nothing. */
export const groupOf = (at: string, now: Date): Group => {
  const day = riyadhDay(new Date(at));
  const today = riyadhDay(now);
  const yesterday = riyadhDay(new Date(now.getTime() - DAY_MS));
  return day === today ? 'today' : day === yesterday ? 'yesterday' : 'earlier';
};

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * The record's NAME for the line, never its type (26 Oct): what the server named for a reader who may see it (QA-553),
 * else the name the notice itself carries in its label arguments (a task's title, a client's name), else — only when
 * there is no name at all — the kind's word.
 */
export function recordName(n: Notification, locale: 'en' | 'ar', kindWord: string): string {
  const own = (locale === 'ar' ? n.title_ar : n.title) ?? n.title;
  if (text(own)) return text(own)!;
  const a = (n.label_args ?? {}) as Record<string, unknown>;
  const named = text(a.title) ?? text(a.name) ?? text(a.record) ?? text(a.label);
  return named ?? kindWord;
}

/**
 * A due-date notice says where its day stands NOW, not where it stood when it was made: past its day it is overdue,
 * on its day it is due today, before it, coming due (26 Oct). Null for any other notice.
 */
export function dueState(n: Notification, now: Date): 'overdue' | 'today' | 'coming' | null {
  if (n.kind !== 'alert_due_tomorrow') return null;
  const due = text(((n.label_args ?? {}) as Record<string, unknown>).due_on);
  if (!due) return 'coming';
  const today = riyadhDay(now);
  return due < today ? 'overdue' : due === today ? 'today' : 'coming';
}
